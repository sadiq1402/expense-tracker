import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { accountChips } from '@/domain/accounts';
import type { Account, Transaction } from '@/domain/types';
import { setAccountFilter, useAccountFilter } from '@/hooks/useAccountFilter';
import { colors } from '@/theme';

// "All accounts" plus one chip per shown Account; picking one narrows the screen until cleared
export function AccountChips({ accounts, txns }: { accounts: Account[]; txns: Transaction[] }) {
  const selected = useAccountFilter();
  const chips = accountChips(accounts, txns);
  const current = chips.find((c) => c.mask === selected);
  // A filter pointing at an Account that is now hidden (or gone) would silently hide everything
  useEffect(() => {
    if (selected && !current) setAccountFilter(null);
  }, [selected, current]);
  if (chips.length < 2 && !current) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel="Account"
      >
        <Button label="All accounts" primary={!current} onPress={() => setAccountFilter(null)} />
        {chips.map((c) => (
          <Button key={c.mask} label={c.label} primary={c.mask === selected} onPress={() => setAccountFilter(c.mask)} />
        ))}
      </ScrollView>
      {current ? (
        <View style={styles.strip}>
          <Text style={styles.stripText}>Only {current.label}</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setAccountFilter(null)}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        </View>
      ) : undefined}
    </View>
  );
}

const styles = StyleSheet.create({
  // Bleeds to the screen edges so chips scroll edge to edge inside padded screens
  wrap: { gap: 12, marginHorizontal: -20 },
  row: { gap: 8, paddingHorizontal: 20 },
  strip: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stripText: { fontSize: 13, fontWeight: '600', color: colors.accentInk },
  clear: { fontSize: 13, fontWeight: '700', color: colors.accentInk },
});
