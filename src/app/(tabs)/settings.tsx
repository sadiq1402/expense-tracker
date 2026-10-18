import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/Text';
import { Button } from '@/components/Button';
import { repo } from '@/db/repo';
import type { Account } from '@/domain/types';
import { colors, radius } from '@/theme';

export default function SettingsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      repo
        .accounts()
        .then((a) => !cancelled && setAccounts(a))
        .catch((e) => console.error('Loading accounts failed', e));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const save = async (account: Account) => {
    await repo.upsertAccounts([account]);
    setAccounts((list) => list.map((a) => (a.id === account.id ? account : a)));
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headline} accessibilityRole="header">
              Settings
            </Text>
            <Text style={styles.sectionLabel}>Accounts</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Accounts appear here once SMS mention them.</Text>}
        renderItem={({ item, index }) => (
          <View
            style={[styles.card, index === 0 && styles.cardTop, index === accounts.length - 1 && styles.cardBottom]}
          >
            <AccountRow account={item} onSave={save} divider={index < accounts.length - 1} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function AccountRow({
  account,
  onSave,
  divider,
}: {
  account: Account;
  onSave: (a: Account) => void;
  divider: boolean;
}) {
  const [name, setName] = useState(account.name);
  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== account.name) onSave({ ...account, name: trimmed });
    else setName(account.name);
  };

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={styles.flex}>
        <TextInput
          style={styles.input}
          accessibilityLabel={`Name for Account ending ${account.mask}`}
          value={name}
          onChangeText={setName}
          onBlur={commitName}
        />
        <Text style={styles.mask}>
          ··{account.mask}
          {account.confirmed ? ' · confirmed' : ' · unconfirmed'}
        </Text>
      </View>
      {account.confirmed ? undefined : (
        <Button label="Confirm" primary onPress={() => onSave({ ...account, confirmed: true })} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  header: { gap: 16, marginBottom: 8 },
  headline: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  empty: { color: colors.muted },
  card: { backgroundColor: colors.surface, paddingHorizontal: 18 },
  cardTop: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  cardBottom: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  divider: { borderBottomWidth: 1, borderColor: colors.track },
  flex: { flex: 1, gap: 4 },
  input: { fontSize: 15, fontWeight: '700', minHeight: 44, paddingVertical: 0 },
  mask: { color: colors.muted, fontSize: 12 },
});
