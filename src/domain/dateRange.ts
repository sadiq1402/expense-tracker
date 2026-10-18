export type RangePreset = 'week' | 'month' | 'custom';

// [start, end) epoch ms
export interface DateRange {
  start: number;
  end: number;
}

// India has no DST, so a fixed offset is exact
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
export const DAY_MS = 24 * 60 * 60_000;

// UTC getters on the shifted Date read IST wall-clock fields
const istFields = (ms: number) => {
  const d = new Date(ms + IST_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
};

// Date.UTC normalizes overflow, so month 12 or day 0 roll over correctly
const istMidnight = (year: number, month: number, day: number) => Date.UTC(year, month, day) - IST_OFFSET_MS;

export function rangeFor(preset: Exclude<RangePreset, 'custom'>, now: number): DateRange {
  const { year, month, day, weekday } = istFields(now);
  if (preset === 'month') return { start: istMidnight(year, month, 1), end: istMidnight(year, month + 1, 1) };
  const start = istMidnight(year, month, day - ((weekday + 6) % 7));
  return { start, end: start + 7 * DAY_MS };
}

export function dayRange(from: number, to: number): DateRange {
  const first = istFields(Math.min(from, to));
  const last = istFields(Math.max(from, to));
  return {
    start: istMidnight(first.year, first.month, first.day),
    end: istMidnight(last.year, last.month, last.day + 1),
  };
}

export function monthKey(ms: number): string {
  const { year, month } = istFields(ms);
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function monthStarts(months: number, now: number): number[] {
  const { year, month } = istFields(now);
  return Array.from({ length: months }, (_, i) => istMidnight(year, month - (months - 1 - i), 1));
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(key: string): string {
  return MONTH_LABELS[Number(key.slice(5)) - 1];
}

// The picker speaks device-local calendar days; read its fields so a non-IST phone can't shift the day
export function istDayFromPicker(date: Date): number {
  return istMidnight(date.getFullYear(), date.getMonth(), date.getDate());
}

export function pickerDateFromIstDay(ms: number): Date {
  const { year, month, day } = istFields(ms);
  return new Date(year, month, day);
}
