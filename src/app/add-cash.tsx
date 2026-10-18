import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { Button } from '@/components/Button';
import { repo } from '@/db/repo';
import { newCashTransaction } from '@/domain/cash';
import { OTHER_ID } from '@/domain/categorize';
import { dayRange, istDayFromPicker, pickerDateFromIstDay } from '@/domain/dateRange';
import type { Category } from '@/domain/types';
import { inputStyle } from '@/theme';

export default function AddCashScreen() {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(OTHER_ID);
  const [note, setNote] = useState('');
  // Today in IST, not the phone's calendar day
  const [today] = useState(() => dayRange(Date.now(), Date.now()).start);
  const [day, setDay] = useState(today);
  const [picking, setPicking] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

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

  const txn = newCashTransaction({ amount, categoryId, note, day }, randomUUID);

  const save = async () => {
    if (!txn) return;
    await repo.upsertTransactions([txn]);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.input}
        placeholder="Amount (₹)"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        autoFocus
      />

      <Text style={styles.heading}>Category</Text>
      <View style={styles.chips}>
        {categories.map((c) => (
          <Button key={c.id} label={c.name} primary={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
        ))}
      </View>

      <Text style={styles.heading}>Date</Text>
      <View style={styles.row}>
        <Button
          label={pickerDateFromIstDay(day).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
          onPress={() => setPicking(true)}
        />
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

      <TextInput style={styles.input} placeholder="Note (optional)" value={note} onChangeText={setNote} />

      <View style={styles.row}>
        <Button label="Save" primary disabled={!txn} onPress={save} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  heading: { marginTop: 16, fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: inputStyle,
});
