import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import type { MerchantSpend } from '@/domain/aggregate';
import { formatWholeRupees, merchantLabel } from '@/domain/format';
import { categoryVisual, colors, SPLIT_COLORS } from '@/theme';

export interface CategorySlice {
  categoryId: string;
  name: string;
  amountPaise: number;
}

export function SplitBar({ slices }: { slices: CategorySlice[] }) {
  if (slices.length === 0) return null;
  return (
    <View style={styles.split} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {slices.map((s, i) => (
        <View
          key={s.categoryId}
          style={{
            flex: s.amountPaise,
            backgroundColor: SPLIT_COLORS[Math.min(i, SPLIT_COLORS.length - 1)],
          }}
        />
      ))}
    </View>
  );
}

export function CategoryRow({ slice, max, onPress }: { slice: CategorySlice; max: number; onPress?: () => void }) {
  const v = categoryVisual(slice.categoryId);
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${slice.name}, ${formatWholeRupees(slice.amountPaise)}`}
    >
      <View style={[styles.badge, { backgroundColor: v.tint }]}>
        <Icon name={v.icon} size={18} color={v.color} />
      </View>
      <View style={styles.flex}>
        <View style={styles.labelRow}>
          <Text style={styles.label} numberOfLines={1}>
            {slice.name}
          </Text>
          <Text style={styles.value}>{formatWholeRupees(slice.amountPaise)}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(slice.amountPaise / max) * 100}%`, backgroundColor: v.bar }]} />
        </View>
      </View>
    </Pressable>
  );
}

export function MerchantRow({ merchant, amountPaise, count, onPress }: MerchantSpend & { onPress?: () => void }) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${merchantLabel({ merchant, isCash: false })}, ${formatWholeRupees(amountPaise)}`}
    >
      <View style={[styles.badge, { backgroundColor: colors.track }]}>
        <Text style={styles.initial}>{merchantLabel({ merchant, isCash: false }).charAt(0)}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.label} numberOfLines={1}>
          {merchantLabel({ merchant, isCash: false })}
        </Text>
        <Text style={styles.sub}>
          {count} payment{count === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={styles.value}>{formatWholeRupees(amountPaise)}</Text>
    </Pressable>
  );
}

export function TrendChart({
  months,
  onSelect,
  height = 96,
}: {
  months: { key: string; label: string; amountPaise: number; current: boolean }[];
  onSelect: (key: string) => void;
  height?: number;
}) {
  const max = Math.max(1, ...months.map((m) => m.amountPaise));
  return (
    <View style={[styles.columns, { height }]}>
      {months.map((m) => (
        <Pressable
          key={m.key}
          style={styles.column}
          onPress={() => onSelect(m.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: m.current }}
          accessibilityLabel={`${m.label}, ${formatWholeRupees(m.amountPaise)}`}
          accessibilityHint="Shows this month's spending"
        >
          <View style={styles.columnTrack}>
            <View
              style={[
                styles.columnFill,
                {
                  height: `${(m.amountPaise / max) * 100}%`,
                  backgroundColor: m.current ? colors.accent : colors.column,
                },
              ]}
            />
          </View>
          <Text style={[styles.columnLabel, m.current && styles.columnLabelCurrent]}>{m.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MoreButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.more}>
      <Text style={styles.moreText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', gap: 6, height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 15, fontWeight: '800', color: colors.subtle },
  flex: { flex: 1, gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  label: { flexShrink: 1, fontSize: 14, fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, color: colors.muted, marginTop: -4 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track },
  fill: { height: 6, borderRadius: 3 },
  columns: { flexDirection: 'row', gap: 10, height: 96 },
  column: { flex: 1, alignItems: 'center', gap: 6 },
  columnTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  columnFill: { width: '100%', borderRadius: 6, minHeight: 2 },
  columnLabel: { fontSize: 11, color: colors.muted },
  columnLabelCurrent: { fontWeight: '700', color: colors.ink },
  more: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  moreText: { fontSize: 13, fontWeight: '700', color: colors.accent },
});
