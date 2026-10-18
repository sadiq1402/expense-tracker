import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { CreateTransactionForm } from '@/components/CreateTransactionForm';
import { repo, type NeedsReviewItem } from '@/db/repo';
import { colors } from '@/theme';

export default function ReviewScreen() {
  const [items, setItems] = useState<NeedsReviewItem[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(
    () =>
      repo
        .listNeedsReview()
        .then(setItems)
        .catch((e) => console.error('Loading Needs Review failed', e)),
    [],
  );
  useEffect(() => {
    let cancelled = false;
    repo
      .listNeedsReview()
      .then((list) => !cancelled && setItems(list))
      .catch((e) => console.error('Loading Needs Review failed', e));
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async (smsId: string) => {
    await repo.resolveNeedsReview(smsId);
    await load();
  };

  if (!items) return <ActivityIndicator style={styles.center} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.sms.id}
      ListEmptyComponent={<Text style={styles.empty}>Nothing needs review.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.meta}>
            {item.sms.sender} · {new Date(item.sms.receivedAt).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.body}>{item.sms.body}</Text>
          {editing === item.sms.id ? (
            <CreateTransactionForm
              item={item}
              onCancel={() => setEditing(null)}
              onDone={async () => {
                setEditing(null);
                await load();
              }}
            />
          ) : (
            <View style={styles.actions}>
              <Button label="Create transaction" onPress={() => setEditing(item.sms.id)} primary />
              <Button label="Dismiss" onPress={() => dismiss(item.sms.id)} />
            </View>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  empty: { textAlign: 'center', padding: 24 },
  card: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: 8,
  },
  meta: { color: colors.muted, fontSize: 12 },
  body: { fontSize: 14 },
  actions: { flexDirection: 'row', gap: 8 },
});
