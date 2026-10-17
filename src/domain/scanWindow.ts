const BACKFILL_MONTHS = 6;
// Re-reading recent SMS is safe because ingest is idempotent by sms id
const OVERLAP_MS = 10 * 60_000;

export function scanSince(lastSmsAt: number | null, now: number): number {
  if (lastSmsAt !== null) return lastSmsAt - OVERLAP_MS;
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - BACKFILL_MONTHS);
  return d.getTime();
}

// SMS dates come from the device clock and can be in the future
export function nextCheckpoint(receivedAts: number[], now: number): number {
  return Math.min(Math.max(...receivedAts), now);
}
