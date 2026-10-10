export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface StationObservation {
  stationCode: string;
  stationName: string;
  coordinates: Coordinates;
  observationTimeUtc: string;
  airTemperature: number;
  feelsLikeTemperature: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  cloudCover: number;
  seaLevelPressure: number;
  relativeHumidity: number;
  conditionCode: string;
  conditionNameLt: string;
  conditionNameEn: string;
  sunshineScore: number;
  isDaylight: boolean;
  isSunny: boolean;
  isClear: boolean;
  googleMapsUrl: string;
  wazeUrl: string;
}

export interface ForecastTimestamp {
  forecastTimeUtc: string;
  airTemperature: number;
  feelsLikeTemperature?: number;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
  cloudCover: number;
  totalPrecipitation?: number;
  conditionCode: string;
  conditionNameLt: string;
  conditionNameEn: string;
  sunshineScore: number;
  isDaylight: boolean;
  isSunny: boolean;
  isClear: boolean;
}

export interface PlaceSummary {
  code: string;
  name: string;
  administrativeDivision?: string;
  countryCode?: string;
  coordinates: Coordinates;
  currentForecast?: ForecastTimestamp;
  hourlyForecast?: ForecastTimestamp[];
  googleMapsUrl: string;
  wazeUrl: string;
}

export interface SunnySummaryResponse {
  updatedAt: string;
  totalStations: number;
  sunnyStationsCount: number;
  clearStationsCount: number;
  stations: StationObservation[];
  topSunnyLocations: StationObservation[];
  majorCities: PlaceSummary[];
}

export interface NearestSunResponse {
  userLocation: Coordinates;
  nearestSunnyStation: StationObservation | null;
  distanceKm: number | null;
  drivingEtaMinutesEstimate: number | null;
  noSunnyNow: boolean;
  allNearbySunny: Array<{
    station: StationObservation;
    distanceKm: number;
  }>;
}

export type FilterMode = 'all-sun' | 'clear-only' | 'all-stations';
export type ForecastHourOffset = 0 | 1 | 2 | 3 | 6 | 12 | 24;
export type Language = 'lt' | 'en';

