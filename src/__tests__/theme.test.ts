import { DEFAULT_CATEGORIES } from '@/domain/categorize';
import { categoryVisual, NEUTRAL_VISUAL } from '@/theme';

test('every default Category has its own colour and icon', () => {
  const visuals = DEFAULT_CATEGORIES.map((c) => categoryVisual(c.id));
  expect(visuals.every((v) => v !== NEUTRAL_VISUAL)).toBe(true);
  expect(new Set(visuals.map((v) => v.icon)).size).toBe(DEFAULT_CATEGORIES.length);
});

test('custom or missing Categories fall back to a neutral visual', () => {
  expect(categoryVisual('some-uuid')).toBe(NEUTRAL_VISUAL);
  expect(categoryVisual(null)).toBe(NEUTRAL_VISUAL);
});
