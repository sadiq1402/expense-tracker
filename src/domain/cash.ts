import { formatRupees, rupeesToPaise } from '@/domain/format';
import type { Transaction } from '@/domain/types';

const MIDDAY_MS = 12 * 60 * 60_000;

export interface CashInput {
  amount: string;
  categoryId: string;
  note: string;
  // IST midnight of the picked day
  day: number;
}

export function newCashTransaction(input: CashInput, newId: () => string): Transaction | null {
  const amountPaise = rupeesToPaise(input.amount);
  if (!amountPaise) return null;
  const id = newId();
  const sourceSmsId = `cash:${id}`;
  return {
    id,
    amountPaise,
    direction: 'debit',
    // Midday, so no clock or timezone drift can move it off the picked IST day
    occurredAt: input.day + MIDDAY_MS,
    accountMask: null,
    upiRef: null,
    merchant: null,
    channel: 'other',
    sourceSmsId,
    sourceSender: '',
    sourceSmsIds: [sourceSmsId],
    sourceSenders: [],
    categoryId: input.categoryId,
    note: input.note.trim() || null,
    isSelfTransfer: false,
    selfTransferManual: false,
    isExcluded: false,
    isRefund: false,
    isCash: true,
    accountId: null,
  };
}

export function cashSaveLabel(paise: number | null): string {
  return paise ? `Save ${formatRupees(paise)}` : 'Save';
}
