import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { SwitchRow } from '@/components/SwitchRow';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Text, TextInput } from '@/components/Text';
import { Avatar } from '@/components/TransactionRow';
import { repo } from '@/db/repo';
import { mixedKeyFor, newCategory } from '@/domain/categorize';
import { accountLabel, formatRupees, merchantLabel } from '@/domain/format';
import { detailMeta } from '@/domain/listing';
import type { Account, Category, RawSms, Transaction } from '@/domain/types';
import { toggleSelfTransfer } from '@/services/accounts';
import { setCategory } from '@/services/categories';
import { colors, inputStyle, radius } from '@/theme';

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mixed, setMixed] = useState<string[]>([]);
  const [smsMessages, setSmsMessages] = useState<RawSms[]>([]);
  const [showSms, setShowSms] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Saves build on the latest version, so a note save and a switch flip can't overwrite each other
  const latest = useRef<Transaction | null>(null);
  const pendingNote = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, c, a, m] = await Promise.all([
        repo.getTransaction(id),
        repo.categories(),
        repo.accounts(),
        repo.mixedMerchants(),
      ]);
      const sms = t && !t.isCash ? await repo.smsFor(t.sourceSmsIds) : [];
      if (cancelled) return;
      latest.current = t;
      setTxn(t);
      setCategories(c);
      setAccounts(a);
      setMixed(m);
      setSmsMessages(sms);
    })().catch((e) => console.error('Loading transaction failed', e));
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

  const flipSelfTransfer = async () => {
    if (!latest.current) return;
    latest.current = await toggleSelfTransfer(latest.current);
    setTxn(latest.current);
  };

  function saveNote(text: string) {
    pendingNote.current = null;
    latestSave(latest, { note: text.trim() || null }).catch((e) => console.error('Saving note failed', e));
  }

  if (!txn) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  const choose = async (categoryId: string) => {
    if (!latest.current) return;
    await setCategory(latest.current, categoryId);
    latest.current = { ...latest.current, categoryId, unchecked: false };
    setTxn(latest.current);
    // This choice may have just made the Merchant Mixed
    setMixed(await repo.mixedMerchants());
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
    setAdding(false);
    await choose(c.id);
  };

  const account = accountLabel(txn.accountMask, new Map(accounts.map((a) => [a.mask, a.name])), txn.sourceSender);
  const missingSms = txn.sourceSmsIds.length - smsMessages.length;

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Avatar txn={txn} size={56} />
          <Text style={styles.merchant}>{merchantLabel(txn)}</Text>
          <Text style={[styles.amount, txn.direction === 'credit' && styles.credit]}>
            {txn.direction === 'credit' ? '+' : ''}
            {formatRupees(txn.amountPaise)}
          </Text>
          <Text style={styles.meta}>{detailMeta(txn, account, Date.now())}</Text>
        </View>

        <Card title="Category">
          <View style={styles.chips}>
            {categories.map((c) => (
              <Button key={c.id} label={c.name} primary={c.id === txn.categoryId} onPress={() => choose(c.id)} />
            ))}
            {adding ? undefined : <Button label="+ New" dashed onPress={() => setAdding(true)} />}
          </View>
          {adding ? (
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                placeholder="New Category"
                autoFocus
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={add}
              />
              <Button label="Add" primary onPress={add} />
              <Button
                label="Cancel"
                onPress={() => {
                  setAdding(false);
                  setNewName('');
                  setError(null);
                }}
              />
            </View>
          ) : undefined}
          {error ? <Text style={styles.error}>{error}</Text> : undefined}
          {txn.merchant && txn.direction === 'debit' ? (
            <Text style={styles.hint}>
              {mixedKeyFor(txn.merchant, mixed)
                ? `You've used more than one Category for ${merchantLabel(txn)}, so you'll be asked each time.`
                : `Future payments to ${merchantLabel(txn)} will use this Category.`}
            </Text>
          ) : undefined}
        </Card>

        <Card title="Note">
          <TextInput
            style={[styles.input, styles.note]}
            placeholder="Add a note"
            accessibilityLabel="Note"
            multiline
            value={note ?? txn.note ?? ''}
            onChangeText={(text) => {
              setNote(text);
              pendingNote.current = text;
            }}
            onBlur={() => pendingNote.current !== null && saveNote(pendingNote.current)}
          />
        </Card>

        <Card style={styles.switches}>
          <SwitchRow
            label="Self-Transfer"
            hint={
              txn.selfTransferManual
                ? 'Set by you, so re-scans leave it alone'
                : 'Between your own Accounts — never counted'
            }
            value={txn.isSelfTransfer}
            onChange={flipSelfTransfer}
            divider
          />
          <SwitchRow
            label="Exclude from totals"
            hint="Hidden from the Dashboard and all totals"
            value={txn.isExcluded}
            onChange={() => save({ isExcluded: !txn.isExcluded })}
          />
        </Card>

        {smsMessages.length > 0 ? (
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showSms }}
              onPress={() => setShowSms(!showSms)}
              style={styles.smsToggle}
            >
              <Text style={styles.smsToggleText}>
                Original SMS · {smsMessages.length} message{smsMessages.length === 1 ? '' : 's'}
              </Text>
              <Icon name={showSms ? 'expand_less' : 'expand_more'} size={20} color={colors.muted} />
            </Pressable>
            {showSms
              ? smsMessages.map((s) => (
                  <View key={s.id} style={styles.sms}>
                    <Text style={styles.smsSender}>{s.sender}</Text>
                    <Text style={styles.smsBody} selectable>
                      {s.body}
                    </Text>
                  </View>
                ))
              : undefined}
            {showSms && missingSms > 0 ? (
              <Text style={styles.hint}>
                {missingSms} older message{missingSms === 1 ? ' wasn’t' : 's weren’t'} kept.
              </Text>
            ) : undefined}
          </View>
        ) : undefined}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 16 },
  header: { alignItems: 'center', gap: 6, paddingBottom: 4 },
  merchant: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  amount: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  credit: { color: colors.credit },
  meta: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.muted, fontSize: 12 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: { ...inputStyle, flex: 1 },
  error: { color: colors.danger },
  note: { minHeight: 64, textAlignVertical: 'top' },
  switches: { paddingVertical: 4, gap: 0 },
  smsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  smsToggleText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  sms: { backgroundColor: colors.surface, borderRadius: radius.control, padding: 12, marginTop: 8, gap: 4 },
  smsSender: { fontSize: 12, fontWeight: '700', color: colors.muted },
  smsBody: { fontSize: 13, lineHeight: 19 },
});
