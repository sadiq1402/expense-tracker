import { formatRupees, formatSignedRupees, rupeesToPaise } from '@/domain/format';

test('formats paise as Indian-grouped rupees', () => {
  expect(formatRupees(12345650)).toBe('₹1,23,456.50');
  expect(formatRupees(25000)).toBe('₹250');
  expect(formatRupees(9905)).toBe('₹99.05');
});

test('reads user-typed rupee amounts as paise', () => {
  expect(rupeesToPaise('1,23,456.50')).toBe(12345650);
  expect(rupeesToPaise(' 500 ')).toBe(50000);
  expect(rupeesToPaise('99.5')).toBe(9950);
  expect(rupeesToPaise('0')).toBeNull();
  expect(rupeesToPaise('12.345')).toBeNull();
  expect(rupeesToPaise('abc')).toBeNull();
});

test('signed rupees use a true minus sign for negative net spend', () => {
  expect(formatSignedRupees(-12345650)).toBe('−₹1,23,456.50');
  expect(formatSignedRupees(25000)).toBe('₹250');
});
