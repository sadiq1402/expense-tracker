import type { AndroidSymbol } from 'expo-symbols';

// Text colours hold 4.5:1 or better on both `bg` and `surface`
export const colors = {
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  ink: '#101418',
  muted: '#5B6670',
  subtle: '#4A5560',
  line: '#E3E7EB',
  track: '#EEF1F4',
  border: '#D5DBE1',
  dashed: '#9AA5AF',
  column: '#DCE3E9',
  segment: '#E6EAEE',
  accent: '#0B6E5F',
  accentSoft: '#DDF0EC',
  accentInk: '#08564A',
  onAccent: '#FFFFFF',
  credit: '#0B6E5F', // same as accent today; kept separate so money-in can change colour on its own
  warnBg: '#FFF4DE',
  warnInk: '#6B4300',
  warnTint: '#FFE3A8',
  danger: '#B3261E',
};

export const radius = { card: 20, chip: 999, control: 12, avatar: 12 };

// Shared by every text field so they keep a 44px touch target
export const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.control,
  paddingHorizontal: 12,
  paddingVertical: 10,
  minHeight: 44,
  fontSize: 16,
};

// Embedded at build time by the expo-font plugin (app.json); fontWeight picks the face
export const fontFamily = 'Manrope';

export interface CategoryVisual {
  color: string; // icon and initial
  tint: string; // badge background
  bar: string; // progress bar fill, brighter than the icon
  icon: AndroidSymbol;
}

// Split bar on the accent card, by rank: distinct hues that all read on teal
export const SPLIT_COLORS = ['#FFB86B', '#FFFFFF', '#9AD8FF', '#C6B6FF', 'rgba(255,255,255,0.45)'];

export const NEUTRAL_VISUAL: CategoryVisual = {
  color: colors.subtle,
  tint: colors.track,
  bar: '#9AA5AF',
  icon: 'label',
};

const VISUALS: Record<string, CategoryVisual> = {
  food: { color: '#B4610E', tint: '#FFF1E2', bar: '#F08C2B', icon: 'restaurant' },
  groceries: { color: '#2E7D32', tint: '#E6F4E7', bar: '#43A047', icon: 'local_grocery_store' },
  shopping: { color: colors.accent, tint: '#E3F4F1', bar: '#0B6E5F', icon: 'shopping_bag' },
  travel: { color: '#1F6FA8', tint: '#E4F3FD', bar: '#2F8FD6', icon: 'directions_car' },
  bills: { color: '#5B44C2', tint: '#EFEAFF', bar: '#7B61E8', icon: 'bolt' },
  rent: { color: '#8A4B2A', tint: '#F6EBE4', bar: '#B86B45', icon: 'home' },
  entertainment: { color: '#B0306A', tint: '#FBE7F0', bar: '#D9488A', icon: 'movie' },
  health: { color: '#B3261E', tint: '#FDE8E8', bar: '#E05252', icon: 'medical_services' },
  people: { color: '#3E5A99', tint: '#E8EDF8', bar: '#5B7BC4', icon: 'group' },
  other: { color: colors.muted, tint: colors.track, bar: '#9AA5AF', icon: 'more_horiz' },
};

export function categoryVisual(categoryId: string | null): CategoryVisual {
  return (categoryId && VISUALS[categoryId]) || NEUTRAL_VISUAL;
}
