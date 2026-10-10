const TIME_ZONE = 'Europe/Vilnius';

const timeFormatter = new Intl.DateTimeFormat('lt-LT', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TIME_ZONE
});

/**
 * meteo.lt timestamps are UTC strings like "2026-10-10 13:00:00".
 * Returns local Lithuanian time as "HH:MM" (handles DST), or '' if unparseable.
 */
export function formatVilniusTime(utcTimestamp?: string): string {
  if (!utcTimestamp) return '';
  const iso = utcTimestamp.includes('T') ? utcTimestamp : utcTimestamp.replace(' ', 'T');
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return '';
  return timeFormatter.format(date);
}
