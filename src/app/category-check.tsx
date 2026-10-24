import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Text, TextInput } from '@/components/Text';
import { Avatar } from '@/components/TransactionRow';
import { repo } from '@/db/repo';
import { newCategory, OTHER_ID } from '@/domain/categorize';
import { uncheckedExpenses } from '@/domain/categoryCheck';
import { formatRupees, merchantLabel } from '@/domain/format';
import { dayLabel, timeLabel } from '@/domain/listing';
import type { Category, Transaction } from '@/domain/types';
import { confirmCategories } from '@/services/categories';
import { colors, inputStyle, radius } from '@/theme';

export default function CategoryCheckScreen() {
  const [rows, setRows] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // Picks stay on screen until "Looks good", so closing the sheet saves nothing
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    Promise.all([repo.allTransactions(), repo.accounts(), repo.categories()])
      .then(([txns, accounts, c]) => {
        if (cancelled) return;
        setRows(uncheckedExpenses(txns, accounts));
        setCategories(c);
      })
      .catch((e) => console.error('Loading the Category Check failed', e));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows) return <ActivityIndicator style={styles.loading} color={colors.accent} />;

  const names = new Map(categories.map((c) => [c.id, c.name]));
  const chosen = (t: Transaction) => picks[t.id] ?? t.categoryId ?? OTHER_ID;

  const toggle = (id: string) => {
    setOpen(open === id ? null : id);
    setAdding(false);
    setNewName('');
    setError(null);
  };

  // A new Category is picked for the row it was added from, like on the Transaction screen
  const add = async (id: string) => {
    const c = newCategory(newName, categories, randomUUID);
    if (!c) {
      setError(newName.trim() ? 'That Category already exists.' : 'Enter a name.');
      return;
    }
    await repo.addCategory(c);
    setCategories([...categories, c]);
    setPicks({ ...picks, [id]: c.id });
    toggle(id);
  };

  const confirm = async () => {
    setSaving(true);
    try {
      await confirmCategories(rows.map((t) => ({ txn: t, categoryId: chosen(t) })));
      router.back();
    } catch (e) {
      console.error('Saving the Category Check failed', e);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {rows.length} new expense{rows.length === 1 ? '' : 's'}
        </Text>
        <Text style={styles.hint}>Tap a category to change it</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {rows.map((t, i) => {
          const categoryName = names.get(chosen(t)) ?? 'Other';
          const expanded = open === t.id;
          const when = `${dayLabel(t.occurredAt, now)}, ${timeLabel(t.occurredAt)}`;
          return (
            <View key={t.id} style={[styles.row, i < rows.length - 1 && styles.divider]}>
              <View style={styles.summary}>
                <Avatar txn={{ ...t, categoryId: chosen(t) }} />
                <View style={styles.flex}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {merchantLabel(t)}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {formatRupees(t.amountPaise)} · {when}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Category for ${merchantLabel(t)}, ${categoryName}`}
                  accessibilityState={{ expanded }}
                  onPress={() => toggle(t.id)}
                  hitSlop={6}
                  style={[styles.pill, chosen(t) === OTHER_ID && styles.pillOther]}
                >
                  <Text style={[styles.pillText, chosen(t) === OTHER_ID && styles.pillTextOther]} numberOfLines={1}>
                    {categoryName}
                  </Text>
                  <Icon
                    name={expanded ? 'expand_less' : 'expand_more'}
                    size={16}
                    color={chosen(t) === OTHER_ID ? colors.muted : colors.accentInk}
                  />
                </Pressable>
              </View>
              {expanded && !adding ? (
                <View style={styles.chips}>
                  {categories.map((c) => (
                    <Button
                      key={c.id}
                      label={c.name}
                      primary={c.id === chosen(t)}
                      onPress={() => {
                        setPicks({ ...picks, [t.id]: c.id });
                        toggle(t.id);
                      }}
                    />
                  ))}
                  <Button label="+ New" dashed onPress={() => setAdding(true)} />
                </View>
              ) : undefined}
              {/* Takes the chips' place, so the field stays above the keyboard even on the last row */}
              {expanded && adding ? (
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="New Category"
                    autoFocus
                    value={newName}
                    onChangeText={setNewName}
                    onSubmitEditing={() => add(t.id)}
                  />
                  <Button label="Add" primary onPress={() => add(t.id)} />
                  <Button label="Cancel" onPress={() => toggle(t.id)} />
                </View>
              ) : undefined}
              {expanded && error ? <Text style={styles.error}>{error}</Text> : undefined}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        onPress={confirm}
        style={({ pressed }) => [styles.save, (pressed || saving) && styles.savePressed]}
      >
        <Text style={styles.saveText}>Looks good</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 24, gap: 2 },
  title: { fontSize: 20, fontWeight: '800' },
  hint: { fontSize: 13, fontWeight: '600', color: colors.muted },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingVertical: 8 },
  row: { paddingVertical: 12, gap: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  merchant: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13, color: colors.muted },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: 150,
    minHeight: 32,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: radius.chip,
    backgroundColor: colors.accentSoft,
  },
  pillOther: { backgroundColor: colors.track },
  pillText: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: colors.accentInk },
  pillTextOther: { color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { ...inputStyle, flex: 1 },
  error: { fontSize: 13, color: colors.danger },
  save: {
    margin: 20,
    height: 56,
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePressed: { opacity: 0.8 },
  saveText: { color: colors.onAccent, fontSize: 16, fontWeight: '800' },
});
