import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { NeedsReviewItem } from '@/db/repo';
import { rupeesToPaise } from '@/domain/format';
import { findDirection } from '@/domain/parseSms';
import type { Direction } from '@/domain/types';
import { createFromReview } from '@/services/ingestion';

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

export function Button({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, primary && styles.primary, disabled && styles.disabled]}
    >
      <Text style={primary ? styles.primaryText : undefined}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  form: { gap: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 6,
    padding: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
  },
  primary: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  primaryText: { color: '#fff' },
  disabled: { opacity: 0.4 },
});
