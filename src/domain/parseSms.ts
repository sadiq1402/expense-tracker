import type { ParseResult, RawSms } from '@/domain/types';

// DLT sender headers, e.g. VM-HDFCBK or VK-AXISBK-S; personal numbers never match
const BANK_SENDER = /^([A-Z]{2}-)?[A-Z0-9]{6}(-[A-Z])?$/i;
const IGNORE =
  /\botp\b|one time password|failed|declined|reversed|refund|\bdue\b|reminder|request|(?:will|shall) be (?:auto[- ]?)?debited|if (?:already )?paid|if debited/i;
const CREDIT_TO_USER = /credited to (?:your )?(?:a\/c|acct)/i;
const DEBIT = /\b(?:debited|sent|spent|withdrawn)\b|\bpaid to\b/i;

const NUMBER = String.raw`(\d[\d,]*(?:\.\d{1,2})?)`;
const DEBITED_AMOUNT = new RegExp(String.raw`debited (?:by|for)\s*(?:rs\.?|inr|₹)?\s*` + NUMBER, 'i');
const ANY_AMOUNT = new RegExp(String.raw`(?:\b(?:rs\.?|inr)|₹)\s*` + NUMBER, 'gi');
const BEFORE_BALANCE = /(?:bal(?:ance)?|limit)[\s.:]*$/i;
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

// Prefer the amount tied to "debited"; otherwise the first currency amount that isn't a balance or limit
const findAmount = (body: string) => {
  const debited = body.match(DEBITED_AMOUNT);
  if (debited) return debited[1];
  for (const m of body.matchAll(ANY_AMOUNT)) {
    if (!BEFORE_BALANCE.test(body.slice(Math.max(0, m.index - 20), m.index))) return m[1];
  }
  return null;
};

const toPaise = (amount: string) => {
  const [rupees, fraction = ''] = amount.replace(/,/g, '').split('.');
  return Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
};

export function parseSms(sms: RawSms): ParseResult {
  const { body } = sms;
  if (!BANK_SENDER.test(sms.sender) || IGNORE.test(body) || CREDIT_TO_USER.test(body) || !DEBIT.test(body)) {
    return { kind: 'ignored' };
  }

  const upiRef = body.match(UPI_REF)?.[1] ?? null;
  // Card, ATM and NEFT debits come in #2
  if (!upiRef && !/\bupi\b/i.test(body)) return { kind: 'ignored' };

  const amount = findAmount(body);
  if (!amount) return { kind: 'needs_review', sms, reason: 'amount not found' };

  return {
    kind: 'transaction',
    txn: {
      amountPaise: toPaise(amount),
      direction: 'debit',
      occurredAt: sms.receivedAt,
      accountMask: body.match(ACCOUNT_MASK)?.[1] ?? null,
      upiRef,
      merchant: firstMatch(body, MERCHANT)?.trim().toUpperCase() ?? null,
      channel: 'upi',
      sourceSmsId: sms.id,
    },
  };
}
