import type { AndroidSymbol } from 'expo-symbols';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors } from '@/theme';

// Material 3 style: the active tab's icon sits in a soft accent pill
export function TabIcon({ name, color, focused }: { name: AndroidSymbol; color: ColorValue; focused: boolean }) {
  return (
    <View style={[styles.pill, focused && styles.active]}>
      <Icon name={name} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 18, paddingVertical: 4, borderRadius: 999 },
  active: { backgroundColor: colors.accentSoft },
});
