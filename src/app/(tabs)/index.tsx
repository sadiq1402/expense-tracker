import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryRow, MerchantRow, MoreButton, SplitBar, TrendChart } from '@/components/DashboardWidgets';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { monthlyTrend, spendByCategory, splitTop, topMerchants, totalSpend, trendAverage } from '@/domain/aggregate';
import {
  DAY_MS,
  dayRange,
  istDayFromPicker,
  monthKey,
  monthLabel,
  pickerDateFromIstDay,
  rangeFor,
  type RangePreset,
} from '@/domain/dateRange';
import { formatWholeRupees } from '@/domain/format';
import { useLedger } from '@/hooks/useLedger';
import { colors } from '@/theme';

const TOP_CATEGORIES = 4;
const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const monthName = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { month: 'long', timeZone: 'Asia/Kolkata' });

export default function DashboardScreen() {
  const { status, txns, categories, loadedAt: now } = useLedger();
  const [preset, setPreset] = useState<RangePreset>('month');
  // null until picked: defaults to the last 7 days ending today
  const [custom, setCustom] = useState<{ from: number; to: number } | null>(null);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [showAll, setShowAll] = useState(false);

  const picked = custom ?? { from: now - 6 * DAY_MS, to: now };
  const range = preset === 'custom' ? dayRange(picked.from, picked.to) : rangeFor(preset, now);
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const slices = spendByCategory(txns, range).map((c) => ({ ...c, name: names.get(c.categoryId) ?? 'Other' }));
  const { top, rest } = splitTop(slices, TOP_CATEGORIES);
  const shown = showAll ? slices : top;
  const total = totalSpend(txns, range);
  const trend = monthlyTrend(txns, 6, now);
  const average = trendAverage(trend);
  const currentMonth = monthKey(now);
  const merchants = topMerchants(txns, range, 5);

  if (status === 'loading') return <ActivityIndicator style={styles.center} color={colors.accent} />;
  if (status !== 'ready') {
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

  const headline = preset === 'month' ? monthName(now) : preset === 'week' ? 'This week' : 'Custom range';

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headline} accessibilityRole="header">
            {headline}
          </Text>
          <Segmented
            label="Range"
            options={PRESETS}
            value={preset}
            onChange={(p) => {
              setPreset(p);
              setShowAll(false);
            }}
          />
        </View>

        {preset === 'custom' ? (
          <View style={styles.row}>
            <Button label={`From ${shortDate(picked.from)}`} onPress={() => setPicking('from')} />
            <Button label={`To ${shortDate(picked.to)}`} onPress={() => setPicking('to')} />
          </View>
        ) : undefined}
        {picking ? (
          <DateTimePicker
            value={pickerDateFromIstDay(picked[picking])}
            maximumDate={new Date(now)}
            onValueChange={(_, date) => {
              setCustom({ ...picked, [picking]: istDayFromPicker(date) });
              setPicking(null);
            }}
            onDismiss={() => setPicking(null)}
          />
        ) : undefined}

        <View style={styles.hero}>
          <Text style={styles.heroCaption}>
            Spent · {shortDate(range.start)} – {shortDate(range.end - 1)}
          </Text>
          <Text style={styles.heroTotal}>{formatWholeRupees(total)}</Text>
          <SplitBar slices={slices} />
        </View>

        <Card title="By Category">
          {shown.length === 0 ? <Text style={styles.empty}>No spending in this range.</Text> : undefined}
          {shown.map((s) => (
            <CategoryRow key={s.categoryId} slice={s} max={slices[0].amountPaise} />
          ))}
          {rest.length > 0 ? (
            <MoreButton
              label={showAll ? 'Show fewer' : `+ ${rest.length} more Categor${rest.length === 1 ? 'y' : 'ies'}`}
              onPress={() => setShowAll(!showAll)}
            />
          ) : undefined}
        </Card>

        <Card title="Last 6 months" aside={<Text style={styles.aside}>avg {formatWholeRupees(average)}</Text>}>
          <TrendChart
            months={trend.map((m) => ({
              key: m.month,
              label: monthLabel(m.month),
              amountPaise: m.amountPaise,
              current: m.month === currentMonth,
            }))}
          />
        </Card>

        <Card title="Top Merchants">
          {merchants.length === 0 ? <Text style={styles.empty}>No merchants in this range.</Text> : undefined}
          {merchants.map((m) => (
            <MerchantRow key={m.merchant} {...m} />
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  message: { textAlign: 'center', color: colors.muted },
  container: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  headline: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  row: { flexDirection: 'row', gap: 8 },
  hero: {
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 6,
  },
  heroCaption: { color: colors.onAccent, fontSize: 13, fontWeight: '600', opacity: 0.9 },
  heroTotal: { color: colors.onAccent, fontSize: 40, fontWeight: '800', letterSpacing: -1.2, lineHeight: 44 },
  empty: { color: colors.muted },
  aside: { fontSize: 12, color: colors.muted },
});
