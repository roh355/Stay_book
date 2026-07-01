export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// minutes from midnight -> "HH:MM"
export function minToHHMM(min: number): string {
  if (min >= 1440) return '24:00';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

// minutes from midnight -> "1:30 PM"
export function minToLabel(min: number): string {
  if (min >= 1440) return '12:00 AM';
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${pad2(m)} ${ampm}`;
}

// "HH:MM" -> minutes from midnight
export function hhmmToMin(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

// A span of minutes -> "45m" / "2h" / "1h 30m"
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Format a Date using its LOCAL components (avoids UTC shift from toISOString).
function toISOLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(): string {
  return toISOLocal(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISOLocal(dt);
}

// Add `months` to a YYYY-MM-DD string. Day overflow rolls forward naturally
// (e.g. Jan 31 + 1 month -> Mar 3), which is fine for computing a look-ahead
// window end.
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1 + months, d);
  return toISOLocal(dt);
}

// Inclusive whole-day difference between two YYYY-MM-DD strings (b - a).
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / 86400000);
}

// List of `count` consecutive YYYY-MM-DD strings starting at `start`.
export function listDays(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(start, i));
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDayShort(iso: string): { weekday: string; day: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    weekday: dt.toLocaleDateString(undefined, { weekday: 'short' }),
    day: `${d}/${m}`,
  };
}

export function formatDateMedium(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
