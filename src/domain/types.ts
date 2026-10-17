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
}

export type ParseResult =
  | { kind: 'transaction'; txn: ParsedTxn }
  | { kind: 'needs_review'; sms: RawSms; reason: string }
  | { kind: 'ignored' };
