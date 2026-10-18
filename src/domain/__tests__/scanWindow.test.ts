import { nextCheckpoint, scanSince } from '@/domain/scanWindow';

const now = Date.UTC(2026, 9, 18, 6, 0);
const MIN = 60_000;

test('first run backfills six months', () => {
  expect(scanSince(null, now)).toBe(Date.UTC(2026, 3, 18, 6, 0));
});

test('later runs re-read a 10 minute overlap before the checkpoint', () => {
  expect(scanSince(now - 60 * MIN, now)).toBe(now - 70 * MIN);
});

test('checkpoint is the newest sms time', () => {
  expect(nextCheckpoint([now - 5 * MIN, now - 2 * MIN], now)).toBe(now - 2 * MIN);
});

test('a future-dated sms cannot push the checkpoint past now', () => {
  expect(nextCheckpoint([now - 5 * MIN, now + 24 * 60 * MIN], now)).toBe(now);
});
