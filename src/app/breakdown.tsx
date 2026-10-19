import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MerchantRow, TrendChart } from '@/components/DashboardWidgets';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { monthlyTrend, spendOf, totalSpend, trendAverage } from '@/domain/aggregate';
import { filterByAccount } from '@/domain/accounts';
import {
  breakdownSummary,
  breakdownTxns,
  matchesFilter,
  merchantCategoryOf,
  merchantTotals,
  NO_MERCHANT,
  type BreakdownFilter,
} from '@/domain/breakdown';
import { monthKey, monthLabel, monthName, monthRangeOf, type DateRange } from '@/domain/dateRange';
import { accountLabel, formatRupees, formatWholeRupees, merchantLabel } from '@/domain/format';
import { dayLabel, timeLabel } from '@/domain/listing';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useLedger } from '@/hooks/useLedger';
import { setMerchantCategory } from '@/services/categories';
import { openBreakdown } from '@/services/navigation';
import { categoryVisual, colors } from '@/theme';

export default function BreakdownScreen() {
  const params = useLocalSearchParams<{
    kind: BreakdownFilter['kind'];
    key: string;
    start: string;
    end: string;
    label: string;
  }>();
  const navigation = useNavigation();
  const { status, txns: allTxns, categories, accounts, loadedAt: now, reload } = useLedger();
  const account = useAccountFilter();
  const txns = useMemo(() => filterByAccount(allTxns, account), [allTxns, account]);
  // Tapping a mini-trend bar narrows this screen to that month
  const [range, setRange] = useState<DateRange>({ start: Number(params.start), end: Number(params.end) });
  const [label, setLabel] = useState(params.label);
  const [saving, setSaving] = useState(false);
  const [moved, setMoved] = useState<number | null>(null);

  useEffect(() => {
    navigation.setOptions({ headerTitle: label });
  }, [navigation, label]);

  const { kind, key } = params;
  const everything = useMemo(() => txns.filter((t) => matchesFilter(t, { kind, key })), [txns, kind, key]);
  const shown = breakdownTxns(everything, { kind, key }, range);
  const summary = breakdownSummary(shown, totalSpend(txns, range));
  const trend = monthlyTrend(everything, 6, now);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const accountNames = new Map(accounts.map((a) => [a.mask, a.name]));

  if (status === 'loading') return <ActivityIndicator style={styles.center} color={colors.accent} />;

  const isMerchant = kind === 'merchant';
  // Read past the Account chips: a Merchant's Category isn't per Account
  const merchantCategory = isMerchant ? merchantCategoryOf(allTxns, key) : key;
  const title = isMerchant ? merchantLabel({ merchant: key, isCash: false }) : (names.get(key) ?? 'Other');
  const visual = categoryVisual(merchantCategory);

  const choose = async (categoryId: string) => {
    if (saving) return;
    setSaving(true);
    try {
      setMoved(await setMerchantCategory(key, categoryId));
      reload();
    } finally {
      setSaving(false);
    }
  };

  const pickMonth = (month: string) => {
    const picked = monthRangeOf(month);
    setRange(picked);
    setLabel(monthName(picked.start));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: visual.tint }]}>
          {isMerchant ? (
            <Text style={[styles.initial, { color: visual.color }]}>{title.charAt(0)}</Text>
          ) : (
            <Icon name={visual.icon} size={26} color={visual.color} />
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.sub}>
            {isMerchant ? `Merchant · ${names.get(merchantCategory) ?? 'Other'}` : 'Category'}
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroCaption}>
          Spent {isMerchant ? 'here' : 'on this'} · {label}
        </Text>
        <Text style={styles.heroTotal}>{formatWholeRupees(summary.spendPaise)}</Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>
            <Text style={styles.statLabel}>Payments </Text>
            {summary.payments}
          </Text>
          <Text style={styles.stat}>
            <Text style={styles.statLabel}>Average </Text>
            {formatWholeRupees(summary.averagePaise)}
          </Text>
          <Text style={styles.stat}>
            <Text style={styles.statLabel}>Share </Text>
            {summary.sharePct}%
          </Text>
        </View>
      </View>

      {isMerchant && key !== NO_MERCHANT ? (
        <Card title="Category for all payments">
          <View style={styles.chips}>
            {categories.map((c) => (
              <Button key={c.id} label={c.name} primary={c.id === merchantCategory} onPress={() => choose(c.id)} />
            ))}
          </View>
          <Text style={styles.hint}>
            {moved === null
              ? `Applies to every payment to ${title}, past and future.`
              : moved === 0
                ? `All payments are already in ${names.get(merchantCategory) ?? 'Other'}. Future ones will follow.`
                : `Moved ${moved} payment${moved === 1 ? '' : 's'} to ${names.get(merchantCategory) ?? 'Other'}. Future ones will follow.`}
          </Text>
        </Card>
      ) : undefined}

      <Card
        title="Last 6 months"
        aside={<Text style={styles.aside}>avg {formatWholeRupees(trendAverage(trend))}</Text>}
      >
        <TrendChart
          height={64}
          months={trend.map((m) => ({
            key: m.month,
            label: monthLabel(m.month),
            amountPaise: m.amountPaise,
            current: m.month === monthKey(range.start),
          }))}
          onSelect={pickMonth}
        />
      </Card>

      {isMerchant ? (
        <View style={styles.listBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Payments · {label}</Text>
            <Text style={styles.sectionLabel}>{shown.length}</Text>
          </View>
          {shown.length === 0 ? <Text style={styles.empty}>No payments in this range.</Text> : undefined}
          <View style={styles.list}>
            {shown.map((t, i) => (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
                accessibilityRole="button"
                style={[styles.payment, i < shown.length - 1 && styles.divider]}
              >
                <View style={styles.flex}>
                  <Text style={styles.paymentTitle}>{dayLabel(t.occurredAt, now)}</Text>
                  <Text style={styles.sub}>
                    {[
                      accountLabel(t.accountMask, accountNames, t.sourceSender),
                      timeLabel(t.occurredAt),
                      spendOf(t) === 0 ? 'not counted' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Text style={[styles.amount, t.direction === 'credit' && styles.credit]}>
                  {t.direction === 'credit' ? '+' : ''}
                  {formatRupees(t.amountPaise)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <Card title={`Merchants · ${label}`}>
          {merchantTotals(shown).map((m) => (
            <MerchantRow
              key={m.merchant}
              {...m}
              onPress={() => openBreakdown({ kind: 'merchant', key: m.merchant }, range, label)}
            />
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 22, fontWeight: '800' },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13, color: colors.muted },
  hero: { backgroundColor: colors.accent, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 18, gap: 4 },
  heroCaption: { color: colors.onAccent, fontSize: 13, fontWeight: '600', opacity: 0.9 },
  heroTotal: { color: colors.onAccent, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 6 },
  stat: { color: colors.onAccent, fontSize: 13, fontWeight: '600' },
  statLabel: { color: colors.onAccent, opacity: 0.8, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 12, color: colors.muted },
  aside: { fontSize: 12, color: colors.muted },
  listBlock: { gap: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  empty: { color: colors.muted },
  list: { backgroundColor: colors.surface, borderRadius: 18 },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 60,
  },
  divider: { borderBottomWidth: 1, borderColor: colors.track },
  paymentTitle: { fontSize: 15, fontWeight: '700' },
  amount: { fontSize: 15, fontWeight: '700' },
  credit: { color: colors.credit },
});
