import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceKm,
  calculateSunshineScore,
  generateGoogleMapsUrl,
  generateWazeUrl,
  getConditionNames
} from './geo.js';

const VILNIUS = { latitude: 54.6872, longitude: 25.2797 };
const KAUNAS = { latitude: 54.8985, longitude: 23.9036 };
const KLAIPEDA = { latitude: 55.7033, longitude: 21.1443 };

test('distance: same point is 0 km', () => {
  assert.equal(calculateDistanceKm(VILNIUS, VILNIUS), 0);
});

test('distance: Vilnius-Kaunas is ~92 km', () => {
  const d = calculateDistanceKm(VILNIUS, KAUNAS);
  assert.ok(d > 88 && d < 97, `got ${d}`);
});

test('distance: Vilnius-Klaipeda is ~286 km (great-circle)', () => {
  const d = calculateDistanceKm(VILNIUS, KLAIPEDA);
  assert.ok(d > 280 && d < 292, `got ${d}`);
});

test('distance is symmetric', () => {
  assert.equal(calculateDistanceKm(VILNIUS, KAUNAS), calculateDistanceKm(KAUNAS, VILNIUS));
});

test('sunshine score: clear sky is high', () => {
  assert.ok(calculateSunshineScore(0, 'clear') >= 95);
});

test('sunshine score: rain is capped low even with moderate clouds', () => {
  assert.ok(calculateSunshineScore(50, 'rain') <= 15);
  assert.ok(calculateSunshineScore(50, 'thunderstorm') <= 15);
  assert.ok(calculateSunshineScore(50, 'snow') <= 15);
});

test('sunshine score: overcast is low', () => {
  assert.ok(calculateSunshineScore(100, 'overcast') <= 15);
});

test('sunshine score: stays within 0..100', () => {
  for (const cc of [0, 25, 50, 75, 100]) {
    for (const code of ['clear', 'cloudy', 'rain', 'partly-cloudy', undefined]) {
      const s = calculateSunshineScore(cc, code);
      assert.ok(s >= 0 && s <= 100, `${cc}/${code} -> ${s}`);
    }
  }
});

test('sunshine score: more clouds never increases score for same condition', () => {
  assert.ok(calculateSunshineScore(10, 'cloudy') >= calculateSunshineScore(90, 'cloudy'));
});

test('condition names: known, unknown and missing codes', () => {
  assert.deepEqual(getConditionNames('clear'), { lt: 'Giedra', en: 'Clear / Sunny' });
  assert.deepEqual(getConditionNames('something-new'), { lt: 'something-new', en: 'something-new' });
  assert.equal(getConditionNames(undefined).en, 'No data');
});

test('map URLs contain exact coordinates', () => {
  assert.equal(
    generateGoogleMapsUrl(VILNIUS),
    'https://www.google.com/maps/search/?api=1&query=54.6872,25.2797'
  );
  assert.equal(
    generateWazeUrl(VILNIUS),
    'https://waze.com/ul?ll=54.6872,25.2797&navigate=yes'
  );
});
