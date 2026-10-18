import { Pressable, StyleSheet, Text } from 'react-native';

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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
  },
  primary: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  primaryText: { color: '#fff' },
  disabled: { opacity: 0.4 },
});
