import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { repo } from '@/db/repo';
import { newCategory } from '@/domain/categorize';
import { formatRupees, merchantLabel } from '@/domain/format';
import type { Category, Transaction } from '@/domain/types';
import { setCategory } from '@/services/categories';

const latestSave = async (latest: { current: Transaction | null }, changes: Partial<Transaction>) => {
  if (!latest.current) return;
  latest.current = { ...latest.current, ...changes };
  await repo.upsertTransactions([latest.current]);
  return latest.current;
};

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Saves build on the latest version, so a note save and an Exclude tap can't overwrite each other
  const latest = useRef<Transaction | null>(null);
  const pendingNote = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([repo.getTransaction(id), repo.categories()])
      .then(([t, c]) => {
        if (cancelled) return;
        latest.current = t;
        setTxn(t);
        setCategories(c);
      })
      .catch((e) => console.error('Loading transaction failed', e));
    return () => {
      cancelled = true;
      // Back navigation can unmount without a blur, so flush an unsaved note here
      if (pendingNote.current !== null) saveNote(pendingNote.current);
    };
  }, [id]);

  const save = async (changes: Partial<Transaction>) => {
    const next = await latestSave(latest, changes);
    if (next) setTxn(next);
  };

  function saveNote(text: string) {
    pendingNote.current = null;
    latestSave(latest, { note: text.trim() || null }).catch((e) => console.error('Saving note failed', e));
  }

  if (!txn) return <ActivityIndicator style={styles.center} />;

  const choose = async (categoryId: string) => {
    if (!latest.current) return;
    await setCategory(latest.current, categoryId);
    latest.current = { ...latest.current, categoryId };
    setTxn(latest.current);
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
      <Text style={styles.merchant}>{merchantLabel(txn)}</Text>
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

      <Text style={styles.heading}>Note</Text>
      <TextInput
        style={[styles.input, styles.note]}
        placeholder="Add a note"
        multiline
        value={note ?? txn.note ?? ''}
        onChangeText={(text) => {
          setNote(text);
          pendingNote.current = text;
        }}
        onBlur={() => pendingNote.current !== null && saveNote(pendingNote.current)}
      />

      <Text style={styles.heading}>Excluded</Text>
      <Text style={styles.hint}>Excluded Transactions are hidden from the Dashboard and all totals.</Text>
      <View style={styles.addRow}>
        <Button
          label={txn.isExcluded ? 'Include in totals' : 'Exclude from totals'}
          primary={txn.isExcluded}
          onPress={() => save({ isExcluded: !txn.isExcluded })}
        />
      </View>
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
  note: { minHeight: 64, textAlignVertical: 'top' },
});
