import { scanSince } from '@/domain/scanWindow';

const now = Date.UTC(2026, 9, 18, 6, 0);

test('first run backfills six months', () => {
  expect(scanSince(null, now)).toBe(Date.UTC(2026, 3, 18, 6, 0));
});

test('later runs resume after the last processed sms', () => {
  expect(scanSince(1_700_000_000_000, now)).toBe(1_700_000_000_000);
});
