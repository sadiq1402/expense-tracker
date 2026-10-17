import type { ParseResult, RawSms } from '@/domain/types';

// DLT sender headers, e.g. VM-HDFCBK or VK-AXISBK-S; personal numbers never match
const BANK_SENDER = /^([A-Z]{2}-)?[A-Z0-9]{6}(-[A-Z])?$/i;
const IGNORE = /\botp\b|one time password|will be debited/i;
const DEBIT = /\b(debited|sent|spent|paid|withdrawn)\b/i;

const AMOUNT = [/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i, /debited (?:by|for)\s+([\d,]+(?:\.\d{1,2})?)/i];
const ACCOUNT_MASK = /(?:a\/c|acct)\.?(?:\s*no\.?)?\s*[x*]+(\d{3,4})/i;
const UPI_REF = /(?:ref(?:\s*no)?|upi)[\s:/#.-]*(?:p2[ma]\/)?(\d{12})\b/i;
const MERCHANT = [
  /\nTo\s+([^\n]+)/,
  /trf to\s+(.+?)\s+Ref/i,
  /;\s*(.+?)\s+credited/i,
  /UPI\/P2[MA]\/\d+\/([^\n]+)/i,
];

const firstMatch = (body: string, patterns: RegExp[]) => {
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return m[1];
  }
  return null;
};

const toPaise = (amount: string) => {
  const [rupees, fraction = ''] = amount.replace(/,/g, '').split('.');
  return Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
};

export function parseSms(sms: RawSms): ParseResult {
  const { body } = sms;
  if (!BANK_SENDER.test(sms.sender) || IGNORE.test(body) || !DEBIT.test(body)) {
    return { kind: 'ignored' };
  }

  const amount = firstMatch(body, AMOUNT);
  if (!amount) return { kind: 'needs_review', sms, reason: 'amount not found' };

  const upiRef = body.match(UPI_REF)?.[1] ?? null;
  return {
    kind: 'transaction',
    txn: {
      amountPaise: toPaise(amount),
      direction: 'debit',
      occurredAt: sms.receivedAt,
      accountMask: body.match(ACCOUNT_MASK)?.[1] ?? null,
      upiRef,
      merchant: firstMatch(body, MERCHANT)?.trim().toUpperCase() ?? null,
      channel: upiRef || /\bupi\b/i.test(body) ? 'upi' : 'other',
      sourceSmsId: sms.id,
    },
  };
}
