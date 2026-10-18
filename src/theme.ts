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
  accent: '#0B6E5F',
  accentSoft: '#DDF0EC',
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
  color: string;
  tint: string;
  icon: AndroidSymbol;
}

export const NEUTRAL_VISUAL: CategoryVisual = { color: colors.subtle, tint: colors.track, icon: 'label' };

const VISUALS: Record<string, CategoryVisual> = {
  food: { color: '#9A520B', tint: '#FFF1E2', icon: 'restaurant' },
  groceries: { color: '#2E7D32', tint: '#E6F4E7', icon: 'local_grocery_store' },
  shopping: { color: colors.accent, tint: '#E3F4F1', icon: 'shopping_bag' },
  travel: { color: '#1F6FA8', tint: '#E4F3FD', icon: 'directions_car' },
  bills: { color: '#5B44C2', tint: '#EFEAFF', icon: 'bolt' },
  rent: { color: '#8A4B2A', tint: '#F6EBE4', icon: 'home' },
  entertainment: { color: '#B0306A', tint: '#FBE7F0', icon: 'movie' },
  health: { color: '#B3261E', tint: '#FDE8E8', icon: 'medical_services' },
  people: { color: '#3E5A99', tint: '#E8EDF8', icon: 'group' },
  other: { color: colors.muted, tint: colors.track, icon: 'more_horiz' },
};

export function categoryVisual(categoryId: string | null): CategoryVisual {
  return (categoryId && VISUALS[categoryId]) || NEUTRAL_VISUAL;
}
