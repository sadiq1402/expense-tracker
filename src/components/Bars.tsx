import { StyleSheet, Text, View } from 'react-native';

import { formatRupees } from '@/domain/format';

export interface Bar {
  key: string;
  label: string;
  amountPaise: number;
  detail?: string;
}

export function BarList({ bars, empty }: { bars: Bar[]; empty: string }) {
  if (bars.length === 0) return <Text style={styles.empty}>{empty}</Text>;
  const max = Math.max(...bars.map((b) => b.amountPaise));
  return (
    <View style={styles.list}>
      {bars.map((b) => (
        <View key={b.key}>
          <View style={styles.labelRow}>
            <Text style={styles.label} numberOfLines={1}>
              {b.label}
              {b.detail ? <Text style={styles.detail}> · {b.detail}</Text> : undefined}
            </Text>
            <Text style={styles.amount}>{formatRupees(b.amountPaise)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(b.amountPaise / max) * 100}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ColumnChart({ bars }: { bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.amountPaise));
  return (
    <View style={styles.columns}>
      {bars.map((b) => (
        <View key={b.key} style={styles.column}>
          <View style={styles.columnTrack}>
            <View style={[styles.columnFill, { height: `${(b.amountPaise / max) * 100}%` }]} />
          </View>
          <Text style={styles.columnLabel}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: '#666', paddingVertical: 8 },
  list: { gap: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  label: { flex: 1, fontSize: 14 },
  detail: { color: '#666' },
  amount: { fontSize: 14, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: '#e8eaed' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#1a73e8' },
  columns: { flexDirection: 'row', gap: 8, height: 140 },
  column: { flex: 1, alignItems: 'center', gap: 4 },
  columnTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  columnFill: { width: '100%', borderRadius: 4, backgroundColor: '#1a73e8' },
  columnLabel: { fontSize: 12, color: '#666' },
});
