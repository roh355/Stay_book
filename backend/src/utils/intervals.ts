import { DAY_START_MIN, DAY_END_MIN, SLOT_MIN } from "../config";

export interface Interval {
  startMin: number;
  endMin: number;
}

// Returns true if [aStart, aEnd) overlaps [bStart, bEnd)
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Given a list of intervals, returns true if they fully cover the day.
export function coversFullDay(bookings: Interval[]): boolean {
  if (!bookings.length) return false;
  const sorted = [...bookings].sort((a, b) => a.startMin - b.startMin);
  let cursor = DAY_START_MIN;
  for (const b of sorted) {
    if (b.startMin > cursor) return false; // gap found
    cursor = Math.max(cursor, b.endMin);
    if (cursor >= DAY_END_MIN) return true;
  }
  return cursor >= DAY_END_MIN;
}

// Validates a requested interval is aligned to slots and within the day.
export function validateInterval(startMin: number, endMin: number): string | null {
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)) {
    return "startMin and endMin must be integers";
  }
  if (startMin % SLOT_MIN !== 0 || endMin % SLOT_MIN !== 0) {
    return `Times must align to ${SLOT_MIN}-minute slots`;
  }
  if (startMin < DAY_START_MIN || endMin > DAY_END_MIN) {
    return "Times must be within the day";
  }
  if (endMin <= startMin) {
    return "End time must be after start time";
  }
  return null;
}

export function isValidDate(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// Add `days` to a YYYY-MM-DD string (timezone-independent via UTC).
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Inclusive list of YYYY-MM-DD strings from `from` through `to`.
// Purely string/UTC based to stay timezone-independent: parsing "YYYY-MM-DD"
// as a local Date and reading it back via toISOString() shifts the day in any
// non-UTC timezone. YYYY-MM-DD strings also compare correctly lexicographically.
export function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cur = from;
  while (cur <= to) {
    dates.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return dates;
}

export function validateDateRange(from: unknown, to: unknown): string | null {
  if (!isValidDate(from) || !isValidDate(to)) {
    return "valid from and to dates (YYYY-MM-DD) are required";
  }
  if (from > to) return "from date must be on or before to date";
  return null;
}

// Two inclusive date ranges overlap (YYYY-MM-DD strings compare lexicographically).
export function dateRangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 <= e2 && s2 <= e1;
}

export function normalizeDescription(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}
