import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Text, TextInput } from '@/components/Text';
import { repo } from '@/db/repo';
import { sameAccount } from '@/domain/accounts';
import { bankFromSender } from '@/domain/format';
import type { Account, Transaction } from '@/domain/types';
import { exportData } from '@/services/export';
import { colors, radius } from '@/theme';

interface AccountInfo {
  bank: string | null;
  count: number;
}

export default function SettingsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([repo.accounts(), repo.allTransactions()])
        .then(([a, t]) => {
          if (cancelled) return;
          setAccounts(a);
          setTxns(t);
        })
        .catch((e) => console.error('Loading accounts failed', e));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Bank and Transaction count per Account, so the user can tell which number is which
  const info = useMemo(() => {
    const byMask = new Map<string, AccountInfo>();
    for (const a of accounts) {
      const mine = txns.filter((t) => t.accountMask && sameAccount(t.accountMask, a.mask));
      byMask.set(a.mask, { bank: mine.length ? bankFromSender(mine[0].sourceSender) : null, count: mine.length });
    }
    return byMask;
  }, [accounts, txns]);

  const sorted = useMemo(
    () => [...accounts].sort((x, y) => (info.get(y.mask)?.count ?? 0) - (info.get(x.mask)?.count ?? 0)),
    [accounts, info],
  );

  const save = async (account: Account) => {
    await repo.upsertAccounts([account]);
    setAccounts((list) => list.map((a) => (a.id === account.id ? account : a)));
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <FlatList
        data={sorted}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headline} accessibilityRole="header">
              Settings
            </Text>
            <View style={styles.intro}>
              <Text style={styles.sectionLabel}>Accounts</Text>
              <Text style={styles.hint}>Hidden Accounts are left out of every total and list. Cash always shows.</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.hint}>Accounts appear here once SMS mention them.</Text>}
        ListFooterComponent={
          <View>
            {accounts.length ? <Text style={styles.footer}>Tap a name to rename it.</Text> : undefined}
            <ExportSection />
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.card, index === 0 && styles.cardTop, index === sorted.length - 1 && styles.cardBottom]}>
            <AccountRow
              account={item}
              info={info.get(item.mask) ?? { bank: null, count: 0 }}
              onSave={save}
              divider={index < sorted.length - 1}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function ExportSection() {
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'csv' | 'json') => {
    setBusy(kind);
    setError(null);
    try {
      await exportData(kind);
    } catch (e) {
      console.error('Export failed', e);
      setError('Export failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.export}>
      <Text style={styles.sectionLabel}>Export</Text>
      <Text style={styles.hint}>
        Your data lives only on this phone. Export a backup or a spreadsheet and choose where to save or send it.
      </Text>
      <View style={styles.exportRow}>
        <Button
          label={busy === 'csv' ? 'Preparing…' : 'Transactions (CSV)'}
          primary
          disabled={busy !== null}
          onPress={() => run('csv')}
        />
        <Button
          label={busy === 'json' ? 'Preparing…' : 'All data (JSON)'}
          disabled={busy !== null}
          onPress={() => run('json')}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : undefined}
    </View>
  );
}

// "Yes Bank" → YB, "HDFC" → HD
const badgeLetters = (bank: string | null) => {
  if (!bank) return '··';
  const words = bank.split(' ');
  return (words.length > 1 ? words.map((w) => w[0]).join('') : bank.slice(0, 2)).slice(0, 2).toUpperCase();
};

function AccountRow({
  account,
  info,
  onSave,
  divider,
}: {
  account: Account;
  info: AccountInfo;
  onSave: (a: Account) => void;
  divider: boolean;
}) {
  const defaultName = `A/c XX${account.mask}`;
  const shownName =
    account.name === defaultName ? `${info.bank ? `${info.bank} ` : ''}··${account.mask}` : account.name;
  const [name, setName] = useState(shownName);
  // Bank labels arrive once Transactions load, so keep the field in step until the user edits it
  useEffect(() => setName(shownName), [shownName]);
  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== shownName) onSave({ ...account, name: trimmed });
    else setName(shownName);
  };
  const renamed = account.name !== defaultName;
  const meta = [
    renamed ? `${info.bank ? `${info.bank} ` : ''}··${account.mask}` : null,
    `${info.count.toLocaleString('en-IN')} transaction${info.count === 1 ? '' : 's'}`,
    account.hidden ? 'hidden' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.row, divider && styles.divider, account.hidden && styles.dimmed]}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badgeLetters(info.bank)}</Text>
      </View>
      <View style={styles.flex}>
        <TextInput
          style={styles.input}
          accessibilityLabel={`Name for Account ending ${account.mask}`}
          value={name}
          onChangeText={setName}
          onBlur={commitName}
        />
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <View style={styles.toggle}>
        <Text style={[styles.toggleLabel, !account.hidden && styles.toggleOn]}>
          {account.hidden ? 'Hidden' : 'Shown'}
        </Text>
        <Switch
          accessibilityLabel={`Show ${shownName}`}
          value={!account.hidden}
          onValueChange={(show) => onSave({ ...account, hidden: !show })}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  header: { gap: 16, marginBottom: 12 },
  headline: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  intro: { gap: 6 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  hint: { fontSize: 12, color: colors.muted },
  footer: { fontSize: 12, color: colors.muted, marginTop: 12 },
  export: { gap: 8, marginTop: 28 },
  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  error: { fontSize: 12, color: colors.danger },
  card: { backgroundColor: colors.surface, paddingHorizontal: 18 },
  cardTop: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  cardBottom: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderColor: colors.track },
  dimmed: { opacity: 0.55 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.avatar,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 13, fontWeight: '800', color: colors.subtle },
  flex: { flex: 1, gap: 2 },
  input: { fontSize: 15, fontWeight: '700', minHeight: 36, paddingVertical: 0, paddingHorizontal: 0 },
  meta: { fontSize: 12, color: colors.muted },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: 12, fontWeight: '600', color: colors.subtle },
  toggleOn: { color: colors.accent },
});
