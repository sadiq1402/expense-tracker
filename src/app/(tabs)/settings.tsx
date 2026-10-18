import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Button } from '@/components/Button';
import { repo } from '@/db/repo';
import type { Account } from '@/domain/types';
import { colors, inputStyle } from '@/theme';

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
    <FlatList
      data={accounts}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={<Text style={styles.heading}>Accounts</Text>}
      ListEmptyComponent={<Text style={styles.empty}>Accounts appear here once SMS mention them.</Text>}
      renderItem={({ item }) => <AccountRow account={item} onSave={save} />}
    />
  );
}

function AccountRow({ account, onSave }: { account: Account; onSave: (a: Account) => void }) {
  const [name, setName] = useState(account.name);
  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== account.name) onSave({ ...account, name: trimmed });
    else setName(account.name);
  };

  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <TextInput style={styles.input} value={name} onChangeText={setName} onBlur={commitName} />
        <Text style={styles.mask}>
          XX{account.mask}
          {account.confirmed ? '' : ' · unconfirmed'}
        </Text>
      </View>
      {account.confirmed ? undefined : (
        <Button label="Confirm" primary onPress={() => onSave({ ...account, confirmed: true })} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '600', padding: 16, paddingBottom: 8 },
  empty: { color: colors.muted, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  flex: { flex: 1, gap: 4 },
  input: inputStyle,
  mask: { color: colors.muted, fontSize: 12 },
});
