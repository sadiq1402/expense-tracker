export type Direction = 'debit' | 'credit';

export type Channel = 'upi' | 'card' | 'atm' | 'neft_imps' | 'autodebit' | 'other';

export interface RawSms {
  id: string;
  sender: string;
  body: string;
  receivedAt: number;
}

export interface ParsedTxn {
  amountPaise: number;
  direction: Direction;
  occurredAt: number;
  accountMask: string | null;
  upiRef: string | null;
  merchant: string | null;
  channel: Channel;
  sourceSmsId: string;
  sourceSender: string;
}

export type ParseResult =
  | { kind: 'transaction'; txn: ParsedTxn }
  | { kind: 'needs_review'; sms: RawSms; reason: string }
  | { kind: 'ignored' };

export interface Transaction extends ParsedTxn {
  id: string;
  sourceSmsIds: string[];
  sourceSenders: string[];
  categoryId: string | null;
  note: string | null;
  isSelfTransfer: boolean;
  selfTransferManual: boolean;
  isExcluded: boolean;
  isRefund: boolean;
  isCash: boolean;
  accountId: string | null;
  // Set on SMS Expenses awaiting the Category Check; rows stored before it read as checked
  unchecked?: boolean;
}

export interface Category {
  id: string;
  name: string;
  builtIn: boolean;
}

export interface MerchantRule {
  merchant: string;
  categoryId: string;
  source: 'seed' | 'user';
}

export interface Account {
  id: string;
  mask: string;
  name: string;
  confirmed: boolean;
  hidden: boolean;
}
