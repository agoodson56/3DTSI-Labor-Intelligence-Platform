export function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '-';
  return `${Number(hours).toFixed(2)} h`;
}

export function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '-';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** Parses SQLite UTC "YYYY-MM-DD HH:MM:SS" into a local Date. */
export function parseDbDate(s: string): Date {
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
}
