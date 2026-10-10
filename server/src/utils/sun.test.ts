import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDaylightAt, parseUtcTimestamp, solarElevationDeg } from './sun.js';
import { classifySunshine } from './geo.js';

const VILNIUS = { latitude: 54.6872, longitude: 25.2797 };

test('parseUtcTimestamp: meteo.lt format is treated as UTC', () => {
  const d = parseUtcTimestamp('2026-10-10 13:00:00');
  assert.equal(d?.toISOString(), '2026-10-10T13:00:00.000Z');
});

test('parseUtcTimestamp: ISO with zone is respected; garbage/empty give null', () => {
  assert.equal(parseUtcTimestamp('2026-10-10T13:00:00+03:00')?.toISOString(), '2026-10-10T10:00:00.000Z');
  assert.equal(parseUtcTimestamp('not a date'), null);
  assert.equal(parseUtcTimestamp(undefined), null);
});

test('solar elevation: Vilnius summer solstice solar noon is ~58.7 deg', () => {
  const el = solarElevationDeg(VILNIUS.latitude, VILNIUS.longitude, new Date('2026-06-21T10:20:00Z'));
  assert.ok(el > 56 && el < 61, `got ${el}`);
});

test('solar elevation: Vilnius winter solstice solar noon is ~11.9 deg', () => {
  const el = solarElevationDeg(VILNIUS.latitude, VILNIUS.longitude, new Date('2026-12-21T10:20:00Z'));
  assert.ok(el > 10 && el < 13.5, `got ${el}`);
});

test('daylight: summer midday is day, 03:00 local (00:00 UTC) is night', () => {
  assert.equal(isDaylightAt(VILNIUS.latitude, VILNIUS.longitude, new Date('2026-06-21T10:00:00Z')), true);
  assert.equal(isDaylightAt(VILNIUS.latitude, VILNIUS.longitude, new Date('2026-06-21T00:00:00Z')), false);
});

test('daylight: winter short days (sunrise ~08:40, sunset ~15:50 local)', () => {
  // 10:00 UTC = 12:00 local -> day ; 15:00 UTC = 17:00 local -> night ; 05:00 UTC = 07:00 local -> night
  assert.equal(isDaylightAt(VILNIUS.latitude, VILNIUS.longitude, new Date('2026-12-21T10:00:00Z')), true);
  assert.equal(isDaylightAt(VILNIUS.latitude, VILNIUS.longitude, new Date('2026-12-21T15:00:00Z')), false);
  assert.equal(isDaylightAt(VILNIUS.latitude, VILNIUS.longitude, new Date('2026-12-21T05:00:00Z')), false);
});

test('classifySunshine: clear sky by day is sunny and clear', () => {
  const c = classifySunshine(0, 'clear', VILNIUS, '2026-06-21 10:00:00');
  assert.equal(c.isDaylight, true);
  assert.equal(c.isSunny, true);
  assert.equal(c.isClear, true);
  assert.ok(c.sunshineScore >= 95);
});

test('classifySunshine: the same clear sky at night is NOT sunny and scores 0', () => {
  const c = classifySunshine(0, 'clear', VILNIUS, '2026-06-21 00:00:00');
  assert.equal(c.isDaylight, false);
  assert.equal(c.isSunny, false);
  assert.equal(c.isClear, false);
  assert.equal(c.sunshineScore, 0);
});

test('classifySunshine: rain with low cloud cover is not sunny', () => {
  const c = classifySunshine(30, 'rain', VILNIUS, '2026-06-21 10:00:00');
  assert.equal(c.isSunny, false);
});

test('classifySunshine: missing cloud cover is treated as overcast', () => {
  const c = classifySunshine(undefined, undefined, VILNIUS, '2026-06-21 10:00:00');
  assert.equal(c.isSunny, false);
});
