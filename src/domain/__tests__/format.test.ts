import { formatRupees } from '@/domain/format';

test('formats paise as Indian-grouped rupees', () => {
  expect(formatRupees(12345650)).toBe('₹1,23,456.50');
  expect(formatRupees(25000)).toBe('₹250');
  expect(formatRupees(9905)).toBe('₹99.05');
});
