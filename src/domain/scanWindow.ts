const BACKFILL_MONTHS = 6;

export function scanSince(lastSmsAt: number | null, now: number): number {
  if (lastSmsAt !== null) return lastSmsAt;
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - BACKFILL_MONTHS);
  return d.getTime();
}
