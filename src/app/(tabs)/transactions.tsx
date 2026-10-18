import { Link } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { formatRupees, merchantLabel } from '@/domain/format';
import { useLedger } from '@/hooks/useLedger';
import { colors } from '@/theme';

export default function TransactionsScreen() {
  const { status, txns, categories, reviewCount } = useLedger();
  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  if (status === 'loading') return <ActivityIndicator style={styles.center} />;
  if (status === 'denied' || status === 'error') {
    return (
      <View style={styles.center}>
        <Text>
          {status === 'denied'
            ? 'SMS permission is needed to find your transactions.'
            : 'Something went wrong reading your SMS. Restart the app to try again.'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={txns}
      ListHeaderComponent={
        <>
          {reviewCount > 0 ? (
            <Link href="/review" style={styles.banner}>
              {reviewCount} message{reviewCount === 1 ? '' : 's'} need review ›
            </Link>
          ) : undefined}
          <Link href="/add-cash" style={styles.addCash}>
            + Add cash
          </Link>
        </>
      }
      keyExtractor={(t) => t.id}
      ListEmptyComponent={<Text style={styles.empty}>No transactions found in the last 6 months.</Text>}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/transaction/[id]', params: { id: item.id } }} asChild>
          <Pressable style={[styles.row, item.isExcluded && styles.excluded]}>
            <View style={styles.flex}>
              <Text style={styles.merchant}>{merchantLabel(item)}</Text>
              <Text style={styles.date}>
                {new Date(item.occurredAt).toLocaleDateString('en-IN')}
                {item.categoryId && categoryNames.has(item.categoryId)
                  ? ` · ${categoryNames.get(item.categoryId)}`
                  : ''}
              </Text>
            </View>
            <Text style={[styles.amount, item.direction === 'credit' && styles.credit]}>
              {item.direction === 'credit' ? '+' : ''}
              {formatRupees(item.amountPaise)}
            </Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { textAlign: 'center', padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  flex: { flex: 1 },
  merchant: { fontSize: 16, fontWeight: '500' },
  date: { color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontVariant: ['tabular-nums'] },
  credit: { color: colors.credit },
  excluded: { opacity: 0.45 },
  addCash: { padding: 16, color: colors.accent, fontWeight: '500' },
  banner: {
    padding: 16,
    backgroundColor: colors.warnBg,
    color: colors.warnInk,
    fontWeight: '500',
  },
});
