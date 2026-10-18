import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarList, ColumnChart } from '@/components/Bars';
import { Button } from '@/components/Button';
import { monthlyTrend, spendByCategory, topMerchants, totalSpend } from '@/domain/aggregate';
import {
  DAY_MS,
  dayRange,
  istDayFromPicker,
  monthLabel,
  pickerDateFromIstDay,
  rangeFor,
  type RangePreset,
} from '@/domain/dateRange';
import { formatRupees } from '@/domain/format';
import { useLedger } from '@/hooks/useLedger';

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export default function DashboardScreen() {
  const { status, txns, categories, loadedAt: now } = useLedger();
  const [preset, setPreset] = useState<RangePreset>('month');
  // null until picked: defaults to the last 7 days ending today
  const [custom, setCustom] = useState<{ from: number; to: number } | null>(null);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);

  const picked = custom ?? { from: now - 6 * DAY_MS, to: now };
  const range = preset === 'custom' ? dayRange(picked.from, picked.to) : rangeFor(preset, now);
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const byCategory = spendByCategory(txns, range);
  const total = totalSpend(txns, range);
  const trend = monthlyTrend(txns, 6, now);
  const merchants = topMerchants(txns, range, 5);

  if (status === 'loading') return <ActivityIndicator style={styles.center} />;
  if (status !== 'ready') {
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <Button label="Week" primary={preset === 'week'} onPress={() => setPreset('week')} />
        <Button label="Month" primary={preset === 'month'} onPress={() => setPreset('month')} />
        <Button label="Custom" primary={preset === 'custom'} onPress={() => setPreset('custom')} />
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

      <Text style={styles.total}>{total < 0 ? `−${formatRupees(-total)}` : formatRupees(total)}</Text>
      <Text style={styles.caption}>
        Spent {shortDate(range.start)} – {shortDate(range.end - 1)}
      </Text>

      <Text style={styles.heading}>By Category</Text>
      <BarList
        empty="No spending in this range."
        bars={byCategory.map((c) => ({
          key: c.categoryId,
          label: names.get(c.categoryId) ?? 'Other',
          amountPaise: c.amountPaise,
        }))}
      />

      <Text style={styles.heading}>Last 6 months</Text>
      <ColumnChart
        bars={trend.map((m) => ({
          key: m.month,
          label: monthLabel(m.month),
          amountPaise: m.amountPaise,
        }))}
      />

      <Text style={styles.heading}>Top Merchants</Text>
      <BarList
        empty="No merchants in this range."
        bars={merchants.map((m) => ({
          key: m.merchant,
          label: m.merchant,
          amountPaise: m.amountPaise,
          detail: `${m.count} payment${m.count === 1 ? '' : 's'}`,
        }))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  total: { fontSize: 32, fontWeight: '600', marginTop: 16, fontVariant: ['tabular-nums'] },
  caption: { color: '#666' },
  heading: { fontSize: 16, fontWeight: '600', marginTop: 24, marginBottom: 4 },
});
