import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { requestPermission } from '../../modules/sms-reader';
import { repo } from '@/db/repo';
import { formatRupees } from '@/domain/format';
import type { Transaction } from '@/domain/types';
import { runIngestion } from '@/services/ingestion';

type Status = 'loading' | 'denied' | 'error' | 'ready';

export default function TransactionsScreen() {
  const [status, setStatus] = useState<Status>('loading');
  const [txns, setTxns] = useState<Transaction[]>([]);

  const [reviewCount, setReviewCount] = useState(0);

  // Re-runs on return from Review so newly created Transactions show up
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const granted = await requestPermission();
          if (granted) await runIngestion();
          const all = granted ? await repo.allTransactions() : [];
          const review = granted ? await repo.listNeedsReview() : [];
          if (cancelled) return;
          setTxns(all);
          setReviewCount(review.length);
          setStatus(granted ? 'ready' : 'denied');
        } catch (e) {
          console.error('Ingestion failed', e);
          if (!cancelled) setStatus('error');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
        reviewCount > 0 ? (
          <Link href="/review" style={styles.banner}>
            {reviewCount} message{reviewCount === 1 ? '' : 's'} need review ›
          </Link>
        ) : undefined
      }
      keyExtractor={(t) => t.id}
      ListEmptyComponent={<Text style={styles.empty}>No transactions found in the last 6 months.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.merchant}>{item.merchant ?? 'Unknown'}</Text>
            <Text style={styles.date}>{new Date(item.occurredAt).toLocaleDateString('en-IN')}</Text>
          </View>
          <Text style={[styles.amount, item.direction === 'credit' && styles.credit]}>
            {item.direction === 'credit' ? '+' : ''}
            {formatRupees(item.amountPaise)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { textAlign: 'center', padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  flex: { flex: 1 },
  merchant: { fontSize: 16, fontWeight: '500' },
  date: { color: '#666', marginTop: 2 },
  amount: { fontSize: 16, fontVariant: ['tabular-nums'] },
  credit: { color: '#188038' },
  banner: {
    padding: 16,
    backgroundColor: '#fef7e0',
    color: '#7a4f01',
    fontWeight: '500',
  },
});
