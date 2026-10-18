import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/Text';
import { colors, radius } from '@/theme';

// 36px pill per the mockup; hitSlop keeps the touch target at 44px
export function Button({
  label,
  onPress,
  primary,
  dashed,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  dashed?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: primary }}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        dashed && styles.dashed,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, primary && styles.primaryText, dashed && styles.dashedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: { fontSize: 13, fontWeight: '600' },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  primaryText: { color: colors.onAccent, fontWeight: '700' },
  dashed: { borderStyle: 'dashed', borderColor: colors.dashed, backgroundColor: 'transparent' },
  dashedText: { color: colors.accent, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
