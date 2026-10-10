import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp, type AppOptions, type WeatherService } from './app.js';
import type { StationObservation, SunnySummaryResponse, NearestSunResponse } from './types.js';

const station: StationObservation = {
  stationCode: 'vilniaus-ams',
  stationName: 'Vilniaus',
  coordinates: { latitude: 54.62, longitude: 25.1 },
  observationTimeUtc: '2026-06-21 10:00:00',
  airTemperature: 20,
  feelsLikeTemperature: 20,
  windSpeed: 2,
  windGust: 4,
  windDirection: 180,
  cloudCover: 0,
  seaLevelPressure: 1010,
  relativeHumidity: 50,
  conditionCode: 'clear',
  conditionNameLt: 'Giedra',
  conditionNameEn: 'Clear / Sunny',
  sunshineScore: 100,
  isDaylight: true,
  isSunny: true,
  isClear: true,
  googleMapsUrl: 'g',
  wazeUrl: 'w'
};

function summaryOf(stations: StationObservation[]): SunnySummaryResponse {
  return {
    updatedAt: new Date().toISOString(),
    totalStations: stations.length,
    sunnyStationsCount: stations.filter((s) => s.isSunny).length,
    clearStationsCount: stations.filter((s) => s.isClear).length,
    stations,
    topSunnyLocations: stations,
    majorCities: []
  };
}

interface FakeState {
  stations: StationObservation[];
  throwOnSummary: boolean;
  refreshCalls: number;
  searchedWith: string[];
}

function fakeService(state: FakeState): WeatherService {
  return {
    async getSunnySummary() {
      if (state.throwOnSummary) throw new Error('secret internal detail');
      return summaryOf(state.stations);
    },
    async getStationsData() {
      return state.stations;
    },
    async findNearestSunny(coords): Promise<NearestSunResponse> {
      const nearest = state.stations[0] ?? null;
      return {
        userLocation: coords,
        nearestSunnyStation: nearest,
        distanceKm: nearest ? 10 : null,
        drivingEtaMinutesEstimate: nearest ? 9 : null,
        noSunnyNow: false,
        allNearbySunny: nearest ? [{ station: nearest, distanceKm: 10 }] : []
      };
    },
    searchPlaces(q: string) {
      state.searchedWith.push(q);
      return q ? [{ code: 'x', name: 'X', coordinates: { latitude: 1, longitude: 2 } }] : [];
    },
    async getPlaceForecast(code: string) {
      if (code === 'vilnius') {
        return { code: 'vilnius', name: 'Vilnius', coordinates: { latitude: 54.6, longitude: 25.2 }, googleMapsUrl: 'g', wazeUrl: 'w' };
      }
      return null;
    },
    async refreshAllData() {
      state.refreshCalls++;
    }
  };
}

const servers: Server[] = [];

async function boot(overrides: Partial<AppOptions> = {}, stateOverrides: Partial<FakeState> = {}) {
  const state: FakeState = { stations: [station], throwOnSummary: false, refreshCalls: 0, searchedWith: [], ...stateOverrides };
  const app = createApp({ service: fakeService(state), rateLimitPerMinute: 1000, ...overrides });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, state };
}

after(() => {
  for (const s of servers) s.close();
});

// Silence expected error logging from the error-handler test
const origError = console.error;

test('GET /api/health', async () => {
  const { base } = await boot();
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', service: 'kur-sviecia-saule-lt' });
});

test('GET /api/sunny-summary returns data with cache header', async () => {
  const { base } = await boot();
  const res = await fetch(`${base}/api/sunny-summary`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control') ?? '', /max-age=60/);
  const body = (await res.json()) as SunnySummaryResponse;
  assert.equal(body.totalStations, 1);
  assert.equal(body.stations[0].stationCode, 'vilniaus-ams');
});

test('GET /api/sunny-summary -> 503 (not 200 with empty data) when no data is available', async () => {
  const { base } = await boot({}, { stations: [] });
  const res = await fetch(`${base}/api/sunny-summary`);
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('GET /api/stations/live: 200 with data, 503 without', async () => {
  const ok = await boot();
  const r1 = await fetch(`${ok.base}/api/stations/live`);
  assert.equal(r1.status, 200);
  assert.equal(((await r1.json()) as { count: number }).count, 1);

  const empty = await boot({}, { stations: [] });
  assert.equal((await fetch(`${empty.base}/api/stations/live`)).status, 503);
});

test('GET /api/nearest-sun validates input', async () => {
  const { base } = await boot();
  for (const qs of ['', '?lat=54.6', '?lon=25.2', '?lat=abc&lon=25', '?lat=91&lon=25', '?lat=54&lon=181', '?lat=Infinity&lon=1']) {
    const res = await fetch(`${base}/api/nearest-sun${qs}`);
    assert.equal(res.status, 400, `expected 400 for "${qs}"`);
  }
});

test('GET /api/nearest-sun returns result for valid input', async () => {
  const { base } = await boot();
  const res = await fetch(`${base}/api/nearest-sun?lat=54.6872&lon=25.2797`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as NearestSunResponse;
  assert.equal(body.nearestSunnyStation?.stationCode, 'vilniaus-ams');
  assert.equal(body.distanceKm, 10);
});

test('GET /api/nearest-sun -> 503 when there is no data', async () => {
  const { base } = await boot({}, { stations: [] });
  assert.equal((await fetch(`${base}/api/nearest-sun?lat=54&lon=25`)).status, 503);
});

test('GET /api/search passes query through, truncates long input', async () => {
  const { base, state } = await boot();
  const res = await fetch(`${base}/api/search?q=vil`);
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as unknown[]).length, 1);

  await fetch(`${base}/api/search?q=${'a'.repeat(500)}`);
  assert.equal(state.searchedWith.at(-1)?.length, 60);

  const none = await fetch(`${base}/api/search`);
  assert.deepEqual(await none.json(), []);
});

test('GET /api/places/forecast/:code: 200 / 404 / 400 for bad code', async () => {
  const { base } = await boot();
  assert.equal((await fetch(`${base}/api/places/forecast/vilnius`)).status, 200);
  assert.equal((await fetch(`${base}/api/places/forecast/atlantis`)).status, 404);
  assert.equal((await fetch(`${base}/api/places/forecast/${encodeURIComponent('../../etc/passwd')}`)).status, 400);
  assert.equal((await fetch(`${base}/api/places/forecast/${'a'.repeat(100)}`)).status, 400);
});

test('POST /api/refresh: disabled (404) when no token is configured', async () => {
  const { base, state } = await boot();
  const res = await fetch(`${base}/api/refresh`, { method: 'POST', headers: { 'x-refresh-token': 'anything' } });
  assert.equal(res.status, 404);
  assert.equal(state.refreshCalls, 0);
});

test('POST /api/refresh: 401 for missing/wrong token, 202 for correct token', async () => {
  const { base, state } = await boot({ refreshToken: 's3cret' });

  assert.equal((await fetch(`${base}/api/refresh`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${base}/api/refresh`, { method: 'POST', headers: { 'x-refresh-token': 'wrong' } })).status, 401);
  assert.equal(state.refreshCalls, 0);

  const ok = await fetch(`${base}/api/refresh`, { method: 'POST', headers: { 'x-refresh-token': 's3cret' } });
  assert.equal(ok.status, 202);
  assert.equal(state.refreshCalls, 1);
});

test('POST /api/refresh is rate limited (5/min)', async () => {
  const { base } = await boot({ refreshToken: 's3cret' });
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) {
    codes.push((await fetch(`${base}/api/refresh`, { method: 'POST', headers: { 'x-refresh-token': 's3cret' } })).status);
  }
  assert.equal(codes.filter((c) => c === 202).length, 5);
  assert.equal(codes.filter((c) => c === 429).length, 2);
});

test('API rate limit returns 429 after the configured number of requests', async () => {
  const { base } = await boot({ rateLimitPerMinute: 3 });
  const codes: number[] = [];
  for (let i = 0; i < 5; i++) codes.push((await fetch(`${base}/api/health`)).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});

test('unknown /api routes return JSON 404', async () => {
  const { base } = await boot();
  const res = await fetch(`${base}/api/does-not-exist`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type') ?? '', /json/);
});

test('security headers are set and x-powered-by is hidden', async () => {
  const { base } = await boot();
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  const csp = res.headers.get('content-security-policy') ?? '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /tile\.openstreetmap\.org/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('CORS: no headers by default; allowed origin is echoed; other origins are not', async () => {
  const none = await boot();
  const r0 = await fetch(`${none.base}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(r0.headers.get('access-control-allow-origin'), null);

  const cfg = await boot({ corsOrigins: ['https://sun.example'] });
  const r1 = await fetch(`${cfg.base}/api/health`, { headers: { Origin: 'https://sun.example' } });
  assert.equal(r1.headers.get('access-control-allow-origin'), 'https://sun.example');
  const r2 = await fetch(`${cfg.base}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.notEqual(r2.headers.get('access-control-allow-origin'), 'https://evil.example');
});

test('service errors become a generic 500 without leaking details', async () => {
  console.error = () => {};
  try {
    const { base } = await boot({}, { throwOnSummary: true });
    const res = await fetch(`${base}/api/sunny-summary`);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.ok(!text.includes('secret internal detail'));
    assert.deepEqual(JSON.parse(text), { error: 'Internal server error' });
  } finally {
    console.error = origError;
  }
});

test('static client: serves index.html, SPA fallback, assets; API 404s stay JSON', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ksl-client-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>app</title>');
  fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');

  try {
    const { base } = await boot({ clientDistDir: dir });

    const root = await fetch(`${base}/`);
    assert.equal(root.status, 200);
    assert.match(await root.text(), /<title>app<\/title>/);
    assert.equal(root.headers.get('cache-control'), 'no-cache');

    const deep = await fetch(`${base}/some/client/route`);
    assert.equal(deep.status, 200);
    assert.match(await deep.text(), /<title>app<\/title>/);

    const asset = await fetch(`${base}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control') ?? '', /immutable/);

    const api = await fetch(`${base}/api/nope`);
    assert.equal(api.status, 404);
    assert.match(api.headers.get('content-type') ?? '', /json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('without a client build, non-API paths are 404 (API-only mode)', async () => {
  const { base } = await boot({ clientDistDir: path.join(os.tmpdir(), 'definitely-missing-dir') });
  assert.equal((await fetch(`${base}/`)).status, 404);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
});
