import { Link } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountChips } from '@/components/AccountChips';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { TransactionRow } from '@/components/TransactionRow';
import { filterByAccount } from '@/domain/accounts';
import { accountLabel, formatWholeRupees } from '@/domain/format';
import { describeRow, groupByDay, reviewSummary } from '@/domain/listing';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useLedger } from '@/hooks/useLedger';
import { colors } from '@/theme';

export default function TransactionsScreen() {
  const { status, txns: allTxns, categories, accounts, reviewCount, reviewReasons, loadedAt } = useLedger();
  const account = useAccountFilter();
  const txns = useMemo(() => filterByAccount(allTxns, account), [allTxns, account]);
  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.mask, a.name])), [accounts]);
  const sections = useMemo(() => groupByDay(txns, loadedAt).map((g) => ({ ...g, data: g.txns })), [txns, loadedAt]);

  if (status === 'loading') return <ActivityIndicator style={styles.center} color={colors.accent} />;
  if (status === 'denied' || status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          {status === 'denied'
            ? 'SMS permission is needed to find your transactions.'
            : 'Something went wrong reading your SMS. Restart the app to try again.'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headline} accessibilityRole="header">
              Transactions
            </Text>
            <AccountChips accounts={accounts} txns={allTxns} />
            {reviewCount > 0 ? (
              <Link href="/review" asChild>
                <Pressable style={styles.review} accessibilityRole="button">
                  <View style={styles.reviewIcon}>
                    <Icon name="sms" size={18} color={colors.warnInk} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.reviewTitle}>
                      {reviewCount} message{reviewCount === 1 ? '' : 's'} need review
                    </Text>
                    <Text style={styles.reviewBody}>{reviewSummary(reviewReasons)}</Text>
                  </View>
                  <Icon name="chevron_right" size={20} color={colors.warnInk} />
                </Pressable>
              </Link>
            ) : undefined}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No transactions found in the last 6 months.</Text>}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            {section.spendPaise !== 0 ? (
              <Text style={styles.sectionLabel}>{formatWholeRupees(section.spendPaise)}</Text>
            ) : undefined}
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const { subtitle, tone } = describeRow(item, {
            category: item.categoryId ? (categoryNames.get(item.categoryId) ?? null) : null,
            // Every row shares the filtered Account, so it adds nothing
            account: account ? null : accountLabel(item.accountMask, accountNames, item.sourceSender),
          });
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View style={[styles.card, first && styles.cardTop, last && styles.cardBottom]}>
              <TransactionRow txn={item} subtitle={subtitle} tone={tone} last={last} />
            </View>
          );
        }}
      />

      <Link href="/add-cash" asChild>
        <Pressable style={styles.fab} accessibilityRole="button">
          <Icon name="add" size={20} color={colors.onAccent} />
          <Text style={styles.fabText}>Add cash</Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  message: { textAlign: 'center', color: colors.muted },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 96 },
  header: { gap: 16, marginBottom: 4 },
  headline: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  flex: { flex: 1 },
  review: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.warnBg,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  reviewIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.warnTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: { fontSize: 14, fontWeight: '700', color: colors.warnInk },
  reviewBody: { fontSize: 12, color: colors.warnInk },
  empty: { textAlign: 'center', padding: 24, color: colors.muted },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  card: { backgroundColor: colors.surface },
  cardTop: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  cardBottom: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 18,
    elevation: 6,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  fabText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
});
