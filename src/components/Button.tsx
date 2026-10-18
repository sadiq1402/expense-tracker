import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/Text';
import { colors } from '@/theme';

export function Button({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, primary && styles.primary, disabled && styles.disabled]}
    >
      <Text style={primary ? styles.primaryText : undefined}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  primaryText: { color: colors.onAccent },
  disabled: { opacity: 0.4 },
});
