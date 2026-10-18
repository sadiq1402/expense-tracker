import type { Transaction } from '@/domain/types';

let n = 0;

export const txn = (over: Partial<Transaction> = {}): Transaction => {
  n++;
  return {
    amountPaise: 500000,
    direction: 'debit',
    occurredAt: 0,
    accountMask: '1234',
    upiRef: null,
    merchant: null,
    channel: 'upi',
    sourceSmsId: `s${n}`,
    sourceSender: 'VM-HDFCBK',
    id: `t${n}`,
    sourceSmsIds: [`s${n}`],
    sourceSenders: ['VM-HDFCBK'],
    categoryId: null,
    note: null,
    isSelfTransfer: false,
    selfTransferManual: false,
    isExcluded: false,
    isRefund: false,
    isCash: false,
    accountId: null,
    ...over,
  };
};
