const RAD = Math.PI / 180;

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/**
 * Parses meteo.lt timestamps ("2026-10-10 13:00:00", always UTC) into a Date.
 * Returns null if the value cannot be parsed.
 */
export function parseUtcTimestamp(value?: string): Date | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Solar elevation above the horizon in degrees for a location and instant.
 * Accurate to well under a degree, which is plenty for a day/night decision.
 */
export function solarElevationDeg(latitude: number, longitude: number, date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;

  const meanLong = mod(280.46 + 0.9856474 * n, 360);
  const meanAnomaly = mod(357.528 + 0.9856003 * n, 360) * RAD;
  const eclipticLong =
    (meanLong + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLong));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLong),
    Math.cos(eclipticLong)
  );

  const gmstHours = mod(18.697374558 + 24.06570982441908 * n, 24);
  const hourAngle = (gmstHours * 15 + longitude) * RAD - rightAscension;

  const lat = latitude * RAD;
  const sinElevation =
    Math.sin(lat) * Math.sin(declination) +
    Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, sinElevation))) / RAD;
}

/** True when the sun's upper limb is above the horizon (standard -0.833° convention). */
export function isDaylightAt(latitude: number, longitude: number, date: Date): boolean {
  return solarElevationDeg(latitude, longitude, date) > -0.833;
}
