import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MeteoService } from './meteoService.js';

const DAY = '2026-06-21 10:00:00'; // 13:00 local, sun high
const NIGHT = '2026-06-21 00:00:00'; // 03:00 local, sun down

const STATIONS = [
  { code: 'vilniaus-ams', name: 'Vilniaus AMS', coordinates: { latitude: 54.625992, longitude: 25.107064 } },
  { code: 'klaipedos-ams', name: 'Klaipedos AMS', coordinates: { latitude: 55.7, longitude: 21.1 } },
  { code: 'nidos-ams', name: 'Nidos AMS', coordinates: { latitude: 55.30221, longitude: 21.00736 } }
];

type Obs = { time: string; cloudCover: number; conditionCode: string };

let realFetch: typeof fetch;
let calls: string[];
let observations: Record<string, Obs>;
let upstreamDown: boolean;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function installFetchMock() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    // tiny delay so concurrent callers genuinely overlap
    await new Promise((r) => setTimeout(r, 5));
    if (upstreamDown) return json({ error: 'down' }, 500);

    if (url.endsWith('/stations')) return json(STATIONS);

    const obsMatch = url.match(/\/stations\/([^/]+)\/observations\/latest$/);
    if (obsMatch) {
      const o = observations[obsMatch[1]];
      if (!o) return json({ error: 'nope' }, 404);
      return json({
        observations: [
          {
            observationTimeUtc: o.time,
            airTemperature: 20,
            cloudCover: o.cloudCover,
            conditionCode: o.conditionCode
          }
        ]
      });
    }

    if (url.endsWith('/places')) {
      return json([
        { code: 'siauliai', name: 'Šiauliai', administrativeDivision: 'Šiaulių miesto savivaldybė', countryCode: 'LT', coordinates: { latitude: 55.93, longitude: 23.31 } },
        { code: 'sejny', name: 'Sejny', administrativeDivision: 'Powiat', countryCode: 'PL', coordinates: { latitude: 54.1, longitude: 23.3 } }
      ]);
    }

    if (url.endsWith('/places/vilnius/forecasts/long-term')) {
      return json({
        place: { code: 'vilnius', name: 'Vilnius', administrativeDivision: 'Vilnius', countryCode: 'LT', coordinates: { latitude: 54.6872, longitude: 25.2797 } },
        forecastTimestamps: Array.from({ length: 30 }, (_, i) => ({
          forecastTimeUtc: DAY,
          airTemperature: 20 + i,
          cloudCover: 10,
          conditionCode: 'clear'
        }))
      });
    }

    return json({ error: 'nope' }, 404);
  }) as typeof fetch;
}

function makeService() {
  return new MeteoService({ requestDelayMs: 0, fetchTimeoutMs: 2000 });
}

beforeEach(() => {
  realFetch = globalThis.fetch;
  calls = [];
  upstreamDown = false;
  observations = {
    'vilniaus-ams': { time: DAY, cloudCover: 0, conditionCode: 'clear' },
    'klaipedos-ams': { time: DAY, cloudCover: 100, conditionCode: 'rain' },
    'nidos-ams': { time: NIGHT, cloudCover: 0, conditionCode: 'clear' } // clear but NIGHT
  };
  installFetchMock();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('cold start: concurrent requests share one refresh and all receive data (not empty)', async () => {
  const svc = makeService();
  const [a, b, c] = await Promise.all([svc.getSunnySummary(), svc.getSunnySummary(), svc.getStationsData()]);

  assert.equal(a.totalStations, 3);
  assert.equal(b.totalStations, 3);
  assert.equal(c.length, 3);
  assert.equal(calls.filter((u) => u.endsWith('/stations')).length, 1, 'upstream stations list fetched once');
});

test('only daytime stations with good weather count as sunny; clear-at-night does not', async () => {
  const svc = makeService();
  const s = await svc.getSunnySummary();

  assert.equal(s.sunnyStationsCount, 1);
  assert.equal(s.clearStationsCount, 1);
  const byCode = Object.fromEntries(s.stations.map((st) => [st.stationCode, st]));
  assert.equal(byCode['vilniaus-ams'].isSunny, true);
  assert.equal(byCode['klaipedos-ams'].isSunny, false);
  assert.equal(byCode['nidos-ams'].isSunny, false);
  assert.equal(byCode['nidos-ams'].isDaylight, false);
  assert.equal(byCode['nidos-ams'].sunshineScore, 0);
  assert.equal(s.stations[0].stationCode, 'vilniaus-ams', 'sunniest is ranked first');
});

test('station name has " AMS" suffix removed and map links contain coordinates', async () => {
  const svc = makeService();
  const s = await svc.getSunnySummary();
  const vilnius = s.stations.find((st) => st.stationCode === 'vilniaus-ams')!;
  assert.equal(vilnius.stationName, 'Vilniaus');
  assert.ok(vilnius.googleMapsUrl.includes('54.625992,25.107064'));
  assert.ok(vilnius.wazeUrl.includes('54.625992,25.107064'));
});

test('stations with no observations are skipped without failing the refresh', async () => {
  delete observations['klaipedos-ams'];
  const svc = makeService();
  const s = await svc.getSunnySummary();
  assert.equal(s.totalStations, 2);
});

test('nearest sun: picks the closest sunny station', async () => {
  observations['klaipedos-ams'] = { time: DAY, cloudCover: 5, conditionCode: 'clear' };
  const svc = makeService();
  // user in Klaipeda area -> Klaipeda station is closest sunny one
  const r = await svc.findNearestSunny({ latitude: 55.71, longitude: 21.13 });
  assert.equal(r.noSunnyNow, false);
  assert.equal(r.nearestSunnyStation?.stationCode, 'klaipedos-ams');
  assert.ok((r.distanceKm ?? 99) < 5);
  assert.ok(r.drivingEtaMinutesEstimate !== null);
});

test('nearest sun: skips closer non-sunny station in favour of a sunny one', async () => {
  const svc = makeService();
  // user next to Klaipeda (rainy) -> must still return Vilnius (only sunny station)
  const r = await svc.findNearestSunny({ latitude: 55.71, longitude: 21.13 });
  assert.equal(r.nearestSunnyStation?.stationCode, 'vilniaus-ams');
  assert.equal(r.noSunnyNow, false);
});

test('nearest sun: when nothing is sunny (night/overcast) flags noSunnyNow and returns least cloudy', async () => {
  for (const k of Object.keys(observations)) observations[k] = { time: NIGHT, cloudCover: 50, conditionCode: 'cloudy' };
  observations['nidos-ams'].cloudCover = 10;
  const svc = makeService();
  const r = await svc.findNearestSunny({ latitude: 54.69, longitude: 25.28 });
  assert.equal(r.noSunnyNow, true);
  assert.ok(r.nearestSunnyStation, 'still returns a fallback station');
});

test('forecast includes 25 hourly entries (now .. +24h) and daylight flags', async () => {
  const svc = makeService();
  const s = await svc.getSunnySummary();
  const vilnius = s.majorCities.find((c) => c.code === 'vilnius')!;
  assert.equal(vilnius.hourlyForecast?.length, 25);
  assert.equal(vilnius.currentForecast?.isSunny, true);
});

test('search: case/diacritic-insensitive, Lithuania only', async () => {
  const svc = makeService();
  await svc.getSunnySummary();
  assert.deepEqual(svc.searchPlaces('siauliai').map((p) => p.code), ['siauliai']);
  assert.deepEqual(svc.searchPlaces('ŠIAULIAI').map((p) => p.code), ['siauliai']);
  assert.deepEqual(svc.searchPlaces('sejny'), [], 'non-LT places are excluded');
  assert.deepEqual(svc.searchPlaces(''), []);
  assert.deepEqual(svc.searchPlaces('   '), []);
});

test('upstream completely down on cold start: no throw, empty data', async () => {
  upstreamDown = true;
  const svc = makeService();
  const s = await svc.getSunnySummary();
  assert.equal(s.totalStations, 0);
  assert.equal(svc.hasData, false);
});

test('upstream failure after a good load keeps serving the previous data', async () => {
  const svc = makeService();
  await svc.getSunnySummary();
  assert.equal(svc.hasData, true);

  upstreamDown = true;
  await svc.refreshAllData();

  const s = await svc.getSunnySummary();
  assert.equal(s.totalStations, 3, 'stale cache preserved');
});

test('getPlaceForecast: returns data for known place, null for unknown', async () => {
  const svc = makeService();
  const ok = await svc.getPlaceForecast('vilnius');
  assert.equal(ok?.name, 'Vilnius');
  assert.equal(await svc.getPlaceForecast('atlantis'), null);
});

test('start()/stop() schedule and clear the background timer without leaking', async () => {
  const svc = new MeteoService({ requestDelayMs: 0, refreshIntervalMs: 60_000 });
  svc.start();
  await svc.refreshAllData();
  svc.stop();
  assert.equal(svc.hasData, true);
});

test('request arriving mid-initial-load waits for the full load (stations AND forecasts)', async () => {
  const svc = makeService();
  svc.start(); // kicks off the initial refresh in the background

  // wait until stations are loaded but the forecast phase is still running
  const deadline = Date.now() + 5000;
  while (!svc.hasData && Date.now() < deadline) await new Promise((r) => setTimeout(r, 1));
  assert.equal(svc.hasData, true);

  const s = await svc.getSunnySummary();
  assert.equal(s.totalStations, 3);
  assert.ok(s.majorCities.length > 0, 'forecast cities must be present, not an empty list');
  svc.stop();
});
