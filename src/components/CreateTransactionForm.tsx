import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextInput } from '@/components/Text';
import { Button } from '@/components/Button';

import type { NeedsReviewItem } from '@/db/repo';
import { rupeesToPaise } from '@/domain/format';
import { findDirection } from '@/domain/parseSms';
import type { Direction } from '@/domain/types';
import { createFromReview } from '@/services/ingestion';
import { inputStyle } from '@/theme';

export function CreateTransactionForm({
  item,
  onCancel,
  onDone,
}: {
  item: NeedsReviewItem;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>(findDirection(item.sms.body) ?? 'debit');
  const [merchant, setMerchant] = useState('');
  const amountPaise = rupeesToPaise(amount);

  const save = async () => {
    if (!amountPaise) return;
    await createFromReview(item.sms, {
      amountPaise,
      direction,
      merchant: merchant.trim().toUpperCase() || null,
    });
    onDone();
  };

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="Amount (₹)"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />
      <View style={styles.actions}>
        <Button label="Debit" onPress={() => setDirection('debit')} primary={direction === 'debit'} />
        <Button label="Credit" onPress={() => setDirection('credit')} primary={direction === 'credit'} />
      </View>
      <TextInput style={styles.input} placeholder="Merchant (optional)" value={merchant} onChangeText={setMerchant} />
      <View style={styles.actions}>
        <Button label="Save" onPress={save} primary disabled={!amountPaise} />
        <Button label="Cancel" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  form: { gap: 8 },
  input: inputStyle,
});
