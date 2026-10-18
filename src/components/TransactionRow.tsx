import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { formatRupees, merchantLabel } from '@/domain/format';
import type { RowTone } from '@/domain/listing';
import type { Transaction } from '@/domain/types';
import { categoryVisual, colors, NEUTRAL_VISUAL, radius } from '@/theme';

// Avatars scale with their size; the 40px list avatar keeps radius.avatar exactly
const sized = (size: number) => ({ width: size, height: size, borderRadius: (radius.avatar * size) / 40 });

export function Avatar({ txn, size = 40 }: { txn: Transaction; size?: number }) {
  if (txn.isSelfTransfer || txn.isCash) {
    return (
      <View style={[styles.avatar, sized(size), { backgroundColor: NEUTRAL_VISUAL.tint }]}>
        <Icon name={txn.isSelfTransfer ? 'sync_alt' : 'payments'} size={size / 2} color={NEUTRAL_VISUAL.color} />
      </View>
    );
  }
  const v = categoryVisual(txn.categoryId);
  return (
    <View style={[styles.avatar, sized(size), { backgroundColor: v.tint }]}>
      <Text style={[styles.initial, { color: v.color, fontSize: size * 0.38 }]}>{merchantLabel(txn).charAt(0)}</Text>
    </View>
  );
}

export function TransactionRow({
  txn,
  subtitle,
  tone,
  last,
}: {
  txn: Transaction;
  subtitle: string;
  tone: RowTone;
  last: boolean;
}) {
  const sign = txn.direction === 'credit' ? '+' : '';
  const amount = `${sign}${formatRupees(txn.amountPaise)}`;
  return (
    <Link href={{ pathname: '/transaction/[id]', params: { id: txn.id } }} asChild>
      <Pressable
        // Link's Slot drops style arrays in release builds, so the row layout must arrive flattened
        style={StyleSheet.flatten([styles.row, !last && styles.divider])}
        accessibilityRole="button"
        accessibilityLabel={`${merchantLabel(txn)}, ${amount}, ${subtitle}`}
      >
        <Avatar txn={txn} />
        <View style={styles.flex}>
          <Text style={[styles.title, tone === 'uncounted' && styles.mutedTitle]} numberOfLines={1}>
            {merchantLabel(txn)}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Text style={[styles.amount, tone === 'credit' && styles.credit, tone === 'uncounted' && styles.mutedAmount]}>
          {amount}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 64,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '800' },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  mutedTitle: { color: colors.subtle },
  subtitle: { fontSize: 12, color: colors.muted },
  amount: { fontSize: 15, fontWeight: '700' },
  credit: { color: colors.credit },
  mutedAmount: { fontWeight: '600', color: colors.muted },
});
