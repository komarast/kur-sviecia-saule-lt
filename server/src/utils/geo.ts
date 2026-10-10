import { Coordinates } from '../types.js';
import { isDaylightAt, parseUtcTimestamp } from './sun.js';

export function calculateDistanceKm(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function generateGoogleMapsUrl(coords: Coordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
}

export function generateWazeUrl(coords: Coordinates): string {
  return `https://waze.com/ul?ll=${coords.latitude},${coords.longitude}&navigate=yes`;
}

export const CONDITION_TRANSLATIONS: Record<string, { lt: string; en: string }> = {
  'clear': { lt: 'Giedra', en: 'Clear / Sunny' },
  'isolated-clouds': { lt: 'Mažai debesuota', en: 'Isolated Clouds' },
  'partly-cloudy': { lt: 'Nepastoviai debesuota', en: 'Partly Cloudy' },
  'cloudy-with-sunny-intervals': { lt: 'Debesuota su pragiedruliais', en: 'Cloudy with Sunny Intervals' },
  'cloudy': { lt: 'Debesuota', en: 'Cloudy' },
  'overcast': { lt: 'Apsiniaukę', en: 'Overcast' },
  'light-rain': { lt: 'Nedidelis lietus', en: 'Light Rain' },
  'rain': { lt: 'Lietus', en: 'Rain' },
  'heavy-rain': { lt: 'Smarkus lietus', en: 'Heavy Rain' },
  'thunderstorm': { lt: 'Perkūnija', en: 'Thunderstorm' },
  'isolated-thunderstorms': { lt: 'Vietomis perkūnija', en: 'Isolated Thunderstorms' },
  'thunderstorms': { lt: 'Perkūnija', en: 'Thunderstorms' },
  'light-sleet': { lt: 'Nedidelė šlapdriba', en: 'Light Sleet' },
  'sleet': { lt: 'Šlapdriba', en: 'Sleet' },
  'freezing-rain': { lt: 'Lijundra', en: 'Freezing Rain' },
  'hail': { lt: 'Kruša', en: 'Hail' },
  'light-snow': { lt: 'Nedidelis sniegas', en: 'Light Snow' },
  'snow': { lt: 'Sniegas', en: 'Snow' },
  'heavy-snow': { lt: 'Smarkus sniegas', en: 'Heavy Snow' },
  'fog': { lt: 'Rūkas', en: 'Fog' },
  'null': { lt: 'Nėra duomenų', en: 'No data' }
};

export function getConditionNames(code?: string): { lt: string; en: string } {
  if (!code) return { lt: 'Nėra duomenų', en: 'No data' };
  return CONDITION_TRANSLATIONS[code.toLowerCase()] || { lt: code, en: code };
}

/**
 * Calculates a sunshine score from 0 to 100 based on cloudCover percentage and conditionCode.
 * 100 = completely clear, 0 = completely overcast/raining.
 */
export function calculateSunshineScore(cloudCover: number = 100, conditionCode?: string): number {
  let baseScore = Math.max(0, 100 - cloudCover);

  const lowerCode = conditionCode?.toLowerCase() || '';
  if (lowerCode === 'clear') {
    baseScore = Math.max(baseScore, 95);
  } else if (lowerCode === 'isolated-clouds') {
    baseScore = Math.max(baseScore, 80);
  } else if (lowerCode === 'partly-cloudy') {
    baseScore = Math.max(baseScore, 65);
  } else if (lowerCode === 'cloudy-with-sunny-intervals') {
    baseScore = Math.max(baseScore, 50);
  } else if (lowerCode.includes('rain') || lowerCode.includes('thunder') || lowerCode.includes('snow') || lowerCode === 'overcast') {
    baseScore = Math.min(baseScore, 15);
  }

  return Math.round(baseScore);
}

export interface SunClassification {
  sunshineScore: number;
  isDaylight: boolean;
  isSunny: boolean;
  isClear: boolean;
}

/**
 * Single source of truth for "is it sunny": combines cloud cover / condition with
 * whether the sun is actually above the horizon at that place and time.
 * At night the score is 0 and nothing is sunny, regardless of cloud cover.
 */
export function classifySunshine(
  cloudCover: number | undefined,
  conditionCode: string | undefined,
  coords: Coordinates,
  utcTimestamp?: string
): SunClassification {
  const when = parseUtcTimestamp(utcTimestamp) ?? new Date();
  const isDaylight = isDaylightAt(coords.latitude, coords.longitude, when);
  const rawScore = calculateSunshineScore(cloudCover ?? 100, conditionCode);
  const sunshineScore = isDaylight ? rawScore : 0;

  return {
    sunshineScore,
    isDaylight,
    isSunny: isDaylight && rawScore >= 55,
    isClear: isDaylight && rawScore >= 80
  };
}
