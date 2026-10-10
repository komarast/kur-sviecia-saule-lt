import type {
  StationInfo,
  StationObservation,
  PlaceSummary,
  SunnySummaryResponse,
  NearestSunResponse,
  Coordinates,
  ForecastTimestamp
} from '../types.js';
import {
  calculateDistanceKm,
  classifySunshine,
  generateGoogleMapsUrl,
  generateWazeUrl,
  getConditionNames
} from '../utils/geo.js';

const DEFAULT_BASE_URL = 'https://api.meteo.lt/v1';

// Key places for broad geographical and resort coverage
export const MAJOR_PLACES_CODES = [
  'vilnius',
  'kaunas',
  'klaipeda',
  'siauliai',
  'panevezys',
  'palanga',
  'nida',
  'druskininkai',
  'birstonas',
  'anyksciai',
  'trakai',
  'zarasai',
  'utena',
  'telsiai',
  'taurage',
  'marijampole',
  'alytus',
  'sventoji',
  'juodkrante',
  'kedainiai',
  'mazeikiai',
  'rokiskis',
  'ignalina',
  'visaginas',
  'plunge',
  'kretinga',
  'silute',
  'varena',
  'moletai'
];

export interface PlaceListItem {
  code: string;
  name: string;
  administrativeDivision?: string;
  coordinates: Coordinates;
}

interface RawObservation {
  observationTimeUtc: string;
  airTemperature?: number;
  feelsLikeTemperature?: number;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
  cloudCover?: number;
  seaLevelPressure?: number;
  relativeHumidity?: number;
  conditionCode?: string;
}

interface RawForecast {
  forecastTimeUtc: string;
  airTemperature: number;
  feelsLikeTemperature?: number;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
  cloudCover: number;
  totalPrecipitation?: number;
  conditionCode: string;
}

interface RawPlaceForecast {
  place: {
    code: string;
    name: string;
    administrativeDivision: string;
    countryCode: string;
    coordinates: Coordinates;
  };
  forecastTimestamps: RawForecast[];
}

export interface MeteoServiceOptions {
  baseUrl?: string;
  /** After this age the cache is refreshed in the background (stale data is still served). */
  cacheTtlMs?: number;
  /** Background refresh interval. */
  refreshIntervalMs?: number;
  /** Pause between upstream requests to stay far below meteo.lt's rate limit. */
  requestDelayMs?: number;
  /** Stations fetched concurrently. */
  stationBatchSize?: number;
  fetchTimeoutMs?: number;
}

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((res) => setTimeout(res, ms)) : Promise.resolve());

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export class MeteoService {
  private readonly baseUrl: string;
  private readonly cacheTtlMs: number;
  private readonly refreshIntervalMs: number;
  private readonly requestDelayMs: number;
  private readonly stationBatchSize: number;
  private readonly fetchTimeoutMs: number;

  private stations: StationObservation[] = [];
  private majorCities: PlaceSummary[] = [];
  private allPlaces: PlaceListItem[] = [];
  private lastUpdated = 0;

  private refreshPromise: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: MeteoServiceOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.cacheTtlMs = options.cacheTtlMs ?? 8 * 60 * 1000;
    this.refreshIntervalMs = options.refreshIntervalMs ?? 7 * 60 * 1000;
    this.requestDelayMs = options.requestDelayMs ?? 100;
    this.stationBatchSize = options.stationBatchSize ?? 6;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? 8000;
  }

  /** Starts the initial load and the periodic background refresh. */
  public start(): void {
    void this.refreshAllData();
    if (!this.timer) {
      this.timer = setInterval(() => void this.refreshAllData(), this.refreshIntervalMs);
      this.timer.unref();
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public get hasData(): boolean {
    return this.stations.length > 0;
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'KurSvieciaSauleLT/1.0 (weather app)' }
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildForecast(f: RawForecast, coords: Coordinates): ForecastTimestamp {
    const names = getConditionNames(f.conditionCode);
    const cls = classifySunshine(f.cloudCover, f.conditionCode, coords, f.forecastTimeUtc);
    return {
      forecastTimeUtc: f.forecastTimeUtc,
      airTemperature: f.airTemperature,
      feelsLikeTemperature: f.feelsLikeTemperature,
      windSpeed: f.windSpeed,
      windGust: f.windGust,
      windDirection: f.windDirection,
      cloudCover: f.cloudCover,
      totalPrecipitation: f.totalPrecipitation,
      conditionCode: f.conditionCode,
      conditionNameLt: names.lt,
      conditionNameEn: names.en,
      ...cls
    };
  }

  private buildPlace(data: RawPlaceForecast): PlaceSummary {
    const hourly = data.forecastTimestamps
      .slice(0, 25)
      .map((f) => this.buildForecast(f, data.place.coordinates));
    return {
      code: data.place.code,
      name: data.place.name,
      administrativeDivision: data.place.administrativeDivision,
      countryCode: data.place.countryCode,
      coordinates: data.place.coordinates,
      currentForecast: hourly[0],
      hourlyForecast: hourly,
      googleMapsUrl: generateGoogleMapsUrl(data.place.coordinates),
      wazeUrl: generateWazeUrl(data.place.coordinates)
    };
  }

  private async fetchStationObservation(st: StationInfo): Promise<StationObservation | null> {
    const data = await this.fetchJson<{ observations?: RawObservation[] }>(
      `${this.baseUrl}/stations/${st.code}/observations/latest`
    );
    const observations = data?.observations;
    if (!observations || observations.length === 0) return null;

    const latest = observations[observations.length - 1];
    const conditionCode = latest.conditionCode || 'null';
    const names = getConditionNames(conditionCode);
    const cloudCover = latest.cloudCover ?? 100;
    const cls = classifySunshine(cloudCover, conditionCode, st.coordinates, latest.observationTimeUtc);

    return {
      stationCode: st.code,
      stationName: st.name.replace(' AMS', ''),
      coordinates: st.coordinates,
      observationTimeUtc: latest.observationTimeUtc,
      airTemperature: latest.airTemperature ?? 0,
      feelsLikeTemperature: latest.feelsLikeTemperature ?? latest.airTemperature ?? 0,
      windSpeed: latest.windSpeed ?? 0,
      windGust: latest.windGust ?? 0,
      windDirection: latest.windDirection ?? 0,
      cloudCover,
      seaLevelPressure: latest.seaLevelPressure ?? 1013,
      relativeHumidity: latest.relativeHumidity ?? 70,
      conditionCode,
      conditionNameLt: names.lt,
      conditionNameEn: names.en,
      ...cls,
      googleMapsUrl: generateGoogleMapsUrl(st.coordinates),
      wazeUrl: generateWazeUrl(st.coordinates)
    };
  }

  /**
   * Refreshes all cached data. Concurrent callers share the same in-flight refresh,
   * so a request arriving during the initial load waits for it instead of getting empty data.
   * Never rejects: on upstream failure the previous cache is kept.
   */
  public refreshAllData(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh()
        .catch((err) => console.error('Error in refreshAllData:', err))
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<void> {
    // 1. Live station observations
    const stationsList = await this.fetchJson<StationInfo[]>(`${this.baseUrl}/stations`);
    if (!stationsList || stationsList.length === 0) {
      console.warn('Failed to fetch stations list from meteo.lt');
    } else {
      const results: StationObservation[] = [];
      for (let i = 0; i < stationsList.length; i += this.stationBatchSize) {
        const batch = stationsList.slice(i, i + this.stationBatchSize);
        const resolved = await Promise.all(batch.map((st) => this.fetchStationObservation(st)));
        for (const r of resolved) if (r) results.push(r);
        await sleep(this.requestDelayMs);
      }
      if (results.length > 0) {
        this.stations = results;
        this.lastUpdated = Date.now();
      }
    }

    // 2. Forecasts for major places (small concurrent batches, same politeness as stations)
    const cities: PlaceSummary[] = [];
    for (let i = 0; i < MAJOR_PLACES_CODES.length; i += this.stationBatchSize) {
      const batch = MAJOR_PLACES_CODES.slice(i, i + this.stationBatchSize);
      const resolved = await Promise.all(
        batch.map((code) => this.fetchJson<RawPlaceForecast>(`${this.baseUrl}/places/${code}/forecasts/long-term`))
      );
      for (const data of resolved) if (data?.forecastTimestamps?.length) cities.push(this.buildPlace(data));
      await sleep(this.requestDelayMs);
    }
    if (cities.length > 0) this.majorCities = cities;

    // 3. Place list for search (only once)
    if (this.allPlaces.length === 0) {
      const places = await this.fetchJson<Array<PlaceListItem & { countryCode?: string }>>(`${this.baseUrl}/places`);
      if (places && places.length > 0) {
        this.allPlaces = places
          .filter((p) => p.countryCode === 'LT' || !p.countryCode)
          .map((p) => ({
            code: p.code,
            name: p.name,
            administrativeDivision: p.administrativeDivision,
            coordinates: p.coordinates
          }));
      }
    }

    console.log(`Weather data refreshed. Stations: ${this.stations.length}, Cities: ${this.majorCities.length}`);
  }

  /**
   * Stale-while-revalidate: with no data we wait for the in-flight/initial refresh;
   * with stale data we serve it immediately and refresh in the background.
   */
  private async ensureData(): Promise<void> {
    const initialLoadInFlight = this.refreshPromise !== null && this.majorCities.length === 0;
    if (this.stations.length === 0 || initialLoadInFlight) {
      await this.refreshAllData();
    } else if (Date.now() - this.lastUpdated > this.cacheTtlMs) {
      void this.refreshAllData();
    }
  }

  public async getStationsData(): Promise<StationObservation[]> {
    await this.ensureData();
    return this.stations;
  }

  public async getSunnySummary(): Promise<SunnySummaryResponse> {
    await this.ensureData();

    const sorted = [...this.stations].sort(
      (a, b) => b.sunshineScore - a.sunshineScore || a.cloudCover - b.cloudCover
    );

    return {
      updatedAt: new Date(this.lastUpdated || Date.now()).toISOString(),
      totalStations: sorted.length,
      sunnyStationsCount: sorted.filter((s) => s.isSunny).length,
      clearStationsCount: sorted.filter((s) => s.isClear).length,
      stations: sorted,
      topSunnyLocations: sorted.slice(0, 10),
      majorCities: this.majorCities
    };
  }

  public async findNearestSunny(userCoords: Coordinates): Promise<NearestSunResponse> {
    const stations = await this.getStationsData();

    let candidates = stations.filter((s) => s.isSunny);
    const noSunnyNow = candidates.length === 0;
    if (noSunnyNow) {
      // Nothing sunny (night / overcast everywhere): fall back to the least cloudy stations
      candidates = [...stations].sort((a, b) => a.cloudCover - b.cloudCover).slice(0, 5);
    }

    const withDistances = candidates
      .map((station) => ({ station, distanceKm: calculateDistanceKm(userCoords, station.coordinates) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const nearest = withDistances[0] ?? null;
    // ~70 km/h average driving speed in Lithuania
    const eta = nearest ? Math.round((nearest.distanceKm / 70) * 60) : null;

    return {
      userLocation: userCoords,
      nearestSunnyStation: nearest ? nearest.station : null,
      distanceKm: nearest ? nearest.distanceKm : null,
      drivingEtaMinutesEstimate: eta,
      noSunnyNow,
      allNearbySunny: withDistances.slice(0, 5)
    };
  }

  /** Diacritic- and case-insensitive place search. */
  public searchPlaces(query: string): PlaceListItem[] {
    const q = normalize((query ?? '').trim());
    if (!q) return [];
    return this.allPlaces
      .filter(
        (p) =>
          normalize(p.name).includes(q) ||
          (p.administrativeDivision ? normalize(p.administrativeDivision).includes(q) : false)
      )
      .slice(0, 15);
  }

  public async getPlaceForecast(placeCode: string): Promise<PlaceSummary | null> {
    const data = await this.fetchJson<RawPlaceForecast>(
      `${this.baseUrl}/places/${encodeURIComponent(placeCode)}/forecasts/long-term`
    );
    if (!data?.forecastTimestamps?.length) return null;
    return this.buildPlace(data);
  }
}
