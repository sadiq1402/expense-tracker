import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { repo } from '@/db/repo';
import { newCategory } from '@/domain/categorize';
import { formatRupees } from '@/domain/format';
import type { Category, Transaction } from '@/domain/types';
import { setCategory } from '@/services/categories';

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([repo.getTransaction(id), repo.categories()])
      .then(([t, c]) => {
        if (cancelled) return;
        setTxn(t);
        setCategories(c);
      })
      .catch((e) => console.error('Loading transaction failed', e));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!txn) return <ActivityIndicator style={styles.center} />;

  const choose = async (categoryId: string) => {
    await setCategory(txn, categoryId);
    setTxn({ ...txn, categoryId });
  };

  const add = async () => {
    const c = newCategory(newName, categories, randomUUID);
    if (!c) {
      setError(newName.trim() ? 'That Category already exists.' : 'Enter a name.');
      return;
    }
    await repo.addCategory(c);
    setCategories([...categories, c]);
    setNewName('');
    setError(null);
    await choose(c.id);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.amount}>
        {txn.direction === 'credit' ? '+' : ''}
        {formatRupees(txn.amountPaise)}
      </Text>
      <Text style={styles.merchant}>{txn.merchant ?? 'Unknown'}</Text>
      <Text style={styles.date}>{new Date(txn.occurredAt).toLocaleString('en-IN')}</Text>

      <Text style={styles.heading}>Category</Text>
      <View style={styles.chips}>
        {categories.map((c) => (
          <Button key={c.id} label={c.name} primary={c.id === txn.categoryId} onPress={() => choose(c.id)} />
        ))}
      </View>
      {txn.merchant && txn.direction === 'debit' ? (
        <Text style={styles.hint}>Future transactions from {txn.merchant} will use the Category you pick.</Text>
      ) : undefined}

      <View style={styles.addRow}>
        <TextInput style={styles.input} placeholder="New Category" value={newName} onChangeText={setNewName} />
        <Button label="Add" onPress={add} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : undefined}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, gap: 8 },
  amount: { fontSize: 28, fontWeight: '600', fontVariant: ['tabular-nums'] },
  merchant: { fontSize: 18 },
  date: { color: '#666' },
  heading: { marginTop: 16, fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: '#666', fontSize: 12 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: '#999', borderRadius: 6, padding: 8 },
  error: { color: '#c5221f' },
});
