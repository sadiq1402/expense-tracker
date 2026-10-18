import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Text, TextInput } from '@/components/Text';
import { repo } from '@/db/repo';
import { cashSaveLabel, newCashTransaction } from '@/domain/cash';
import { OTHER_ID } from '@/domain/categorize';
import { dayRange, istDayFromPicker, pickerDateFromIstDay } from '@/domain/dateRange';
import { rupeesToPaise } from '@/domain/format';
import type { Category } from '@/domain/types';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { colors, radius } from '@/theme';

export default function AddCashScreen() {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(OTHER_ID);
  const [note, setNote] = useState('');
  // Today in IST, not the phone's calendar day
  const [today] = useState(() => dayRange(Date.now(), Date.now()).start);
  const [day, setDay] = useState(today);
  const [picking, setPicking] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const keyboard = useKeyboardHeight();

  useEffect(() => {
    let cancelled = false;
    repo
      .categories()
      .then((c) => !cancelled && setCategories(c))
      .catch((e) => console.error('Loading categories failed', e));
    return () => {
      cancelled = true;
    };
  }, []);

  const paise = rupeesToPaise(amount);
  const valid = paise !== null;

  const save = async () => {
    const txn = newCashTransaction({ amount, categoryId, note, day }, randomUUID);
    if (!txn) return;
    await repo.upsertTransactions([txn]);
    router.back();
  };

  const dayText = `${day === today ? 'Today, ' : ''}${pickerDateFromIstDay(day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(day === today ? {} : { year: 'numeric' }),
  })}`;

  return (
    // The inset keeps Save off the gesture bar; while the keyboard is up, Save rides on top of it instead
    <SafeAreaView edges={keyboard ? [] : ['bottom']} style={[styles.screen, { paddingBottom: keyboard }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.amountInput}
              accessibilityLabel="Amount in rupees"
              placeholder="0"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
          </View>
        </View>

        <Card title="Category">
          <View style={styles.chips}>
            {categories.map((c) => (
              <Button key={c.id} label={c.name} primary={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>
        </Card>

        <View style={styles.details}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Date, ${dayText}`}
            onPress={() => setPicking(true)}
            style={[styles.detailRow, styles.divider]}
          >
            <Icon name="calendar_today" size={20} color={colors.muted} />
            <Text style={styles.detailText}>{dayText}</Text>
            <Icon name="chevron_right" size={20} color={colors.muted} />
          </Pressable>
          <View style={styles.detailRow}>
            <Icon name="edit" size={20} color={colors.muted} />
            <TextInput
              style={styles.noteInput}
              accessibilityLabel="Note"
              placeholder="Note (optional)"
              value={note}
              onChangeText={setNote}
            />
          </View>
        </View>
        {picking ? (
          <DateTimePicker
            value={pickerDateFromIstDay(day)}
            maximumDate={pickerDateFromIstDay(today)}
            onValueChange={(_, date) => {
              setDay(istDayFromPicker(date));
              setPicking(false);
            }}
            onDismiss={() => setPicking(false)}
          />
        ) : undefined}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid }}
        disabled={!valid}
        onPress={save}
        style={({ pressed }) => [styles.save, !valid && styles.saveDisabled, pressed && styles.savePressed]}
      >
        <Text style={styles.saveText}>{cashSaveLabel(paise)}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 16 },
  amountBlock: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  amountLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  rupee: { fontSize: 32, fontWeight: '700', color: colors.muted },
  amountInput: { fontSize: 56, fontWeight: '800', minWidth: 120, minHeight: 72, padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  details: { backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: 18 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  detailText: { flex: 1, fontSize: 15, fontWeight: '600' },
  noteInput: { flex: 1, fontSize: 15, minHeight: 44 },
  save: {
    margin: 20,
    height: 56,
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: { opacity: 0.45 },
  savePressed: { opacity: 0.8 },
  saveText: { color: colors.onAccent, fontSize: 16, fontWeight: '800' },
});
