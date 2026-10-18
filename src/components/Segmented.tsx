import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { colors } from '@/theme';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={[styles.text, selected && styles.selectedText]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', backgroundColor: colors.line, borderRadius: 999, padding: 3 },
  option: { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  selected: { backgroundColor: colors.surface, elevation: 1 },
  text: { fontSize: 13, fontWeight: '600', color: colors.subtle },
  selectedText: { fontWeight: '700', color: colors.ink },
});
