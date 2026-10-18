import { StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/Text';
import { colors } from '@/theme';

export function SwitchRow({
  label,
  hint,
  value,
  onChange,
  divider,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: () => void;
  divider?: boolean;
}) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12 },
});
