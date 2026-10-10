export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface StationInfo {
  code: string;
  name: string;
  coordinates: Coordinates;
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
  sunshineScore: number; // 0 - 100 (always 0 at night)
  isDaylight: boolean; // sun above the horizon at this place/time
  isSunny: boolean; // daylight and good sunshine score
  isClear: boolean; // daylight and very high sunshine score
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
  /** True when nothing is sunny right now (night/overcast); the least-cloudy station is returned instead. */
  noSunnyNow: boolean;
  allNearbySunny: Array<{
    station: StationObservation;
    distanceKm: number;
  }>;
}
