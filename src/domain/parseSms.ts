import { rupeesToPaise } from '@/domain/format';
import type { Channel, Direction, ParseResult, RawSms } from '@/domain/types';

// DLT sender headers, e.g. VM-HDFCBK or VK-AXISBK-S; personal numbers never match
const BANK_SENDER = /^([A-Z]{2}-)?[A-Z0-9]{6}(-[A-Z])?$/i;
const IGNORE =
  /\botp\b|one time password|failed|declined|reversed|\bdue\b|reminder|request|(?:will|shall) be (?:auto[- ]?)?debited|if (?:already )?paid|if debited|cashback|reward|offer|\bwin\b|\bclaim\b|voucher|coupon|pre-?approved|use code|\boff!/i;
const DEBIT = /\b(?:debited|sent|spent|withdrawn|paid)\b/i;
const CREDIT = /\b(?:credited|received|deposited)\b/i;

const CHANNELS: [Channel, RegExp][] = [
  ['autodebit', /\b(?:nach|ach|ecs|mandate|auto[- ]?debit|standing instruction)\b/i],
  ['atm', /\batm\b/i],
  ['neft_imps', /\b(?:neft|imps|rtgs)\b/i],
  ['upi', /\b(?:upi|vpa)\b/i],
  ['card', /\bcard\b/i],
];

const NUMBER = String.raw`(\d[\d,]*(?:\.\d{1,2})?)`;
const CURRENCY = String.raw`(?:rs\.?|inr|₹)`;
const KEYWORD_AMOUNT = new RegExp(
  String.raw`(?:debited|credited)(?: (?:by|for|with))?\s*` + CURRENCY + String.raw`?\s*` + NUMBER,
  'i',
);
const ANY_AMOUNT = new RegExp(String.raw`(?:\b(?:rs\.?|inr)|₹)\s*` + NUMBER, 'gi');
const BEFORE_BALANCE = /(?:bal(?:ance)?|limit)[\s.:]*$/i;
const ACCOUNT_MASK = /(?:a\/c|acct|\bac|account|card)\.?(?:\s*no\.?)?\s*(?:[x*.]+|ending(?: with)?\s*)(\d{3,4})\b/i;
const UPI_REF = /(?:ref(?:\s*no)?|upi|transaction id|rrn)[\s:/#.-]*(?:p2[ma]\/)?(\d{12})\b/i;

const STOP = String.raw`(?=\s+(?:on|ref|refno|upi|via|from|to|at|by|thru|in|is|dt)\b|\.(?:\s|$)|[,;(\n]|$)`;
// Ordered most-specific first. A structured slot (HDFC's "To" line, a card's payee tag) is trusted as the payee even
// when it names a bank or wallet; loose "to/at/by …" matches skip anything that looks like the user's own account
const MERCHANT: { re: RegExp; trusted: boolean; unless?: RegExp }[] = [
  // The user's own account or a fraud-help instruction can sit on that line too
  { re: /\nTo\s+([^\n]+)/, trusted: true, unless: /a\/c|\bblock\b|\breport\b/i },
  { re: /trf to\s+(.+?)\s+Ref/i, trusted: true },
  { re: /;\s*(.+?)\s+credited/i, trusted: true },
  { re: /(?:UPI|IMPS)\/P2[MA]\/\d+\/([^\n]+)/i, trusted: true },
  // Card SMS that tag the payee: Yes Bank "@UPI_NAME 12-10-2026" or "@SWIGGYFOOD 12-10-2026", ICICI "for UPI-<ref>-Name."
  { re: /(?:^|\s)@(?:UPI_)?(.+?)\s+\d{2}-\d{2}-\d{4}/i, trusted: true },
  { re: /\bUPI-\d+-([^.\n]+)/i, trusted: true },
  // Card-bill apps confirming a payment: "Your YES Bank Credit Card ... bill of Rs. 4250 ... paid via Kiwi."
  { re: /credit card\b.*?\bbill\b.*?\bpaid via\s+([A-Za-z]+)/i, trusted: true },
  // ICICI card "on 12-Jul-26 on APPLE INDIA PRI." and HDFC card "At ..RELIANCE TRENDS_ On"
  { re: /\bon\s+\d{1,2}-[A-Za-z]{3}-\d{2,4}\s+on\s+([^.\n]+)\./i, trusted: true },
  { re: /\bAt\s+\.\.(.+?)_?\s+On\b/i, trusted: true },
  { re: new RegExp(String.raw`\bfor\s+([A-Z][A-Z0-9 &*.'-]+?)` + STOP), trusted: false },
  {
    re: new RegExp(String.raw`\b(?:to|at|by|from)\s+(?:vpa\s+)?([A-Za-z0-9@][A-Za-z0-9@ &*.'_-]*?)` + STOP, 'gi'),
    trusted: false,
  },
];
const NOT_MERCHANT = /a\/c|\bac\b|acct|account|card|bank|\byour\b|\batm\b|\bmobile\b|neft|imps|upi|^\d|^(?:rs|inr)\b/i;
const NEVER_MERCHANT = /https?:|www\.|^\d+$/i;

// Fraud/helpline footers mention "to"/"at" too, so merchant search stops before them
const FOOTER = /\b(?:not (?:u|you)|if not|call\b|sms block|fwd this|to dispute)/i;

const findMerchant = (sms: string) => {
  const cut = sms.search(FOOTER);
  const body = cut < 0 ? sms : sms.slice(0, cut);
  for (const { re, trusted, unless } of MERCHANT) {
    const matches = re.global ? [...body.matchAll(re)] : [body.match(re)];
    for (const m of matches) {
      const name = m?.[1].trim();
      if (!name || NEVER_MERCHANT.test(name) || unless?.test(name)) continue;
      if (trusted || /^\S+@\S+$/.test(name) || !NOT_MERCHANT.test(name)) return name.toUpperCase();
    }
  }
  return null;
};

// Earliest keyword wins: "debited ...; UBER credited" is a debit, "credited ... link sent" a credit
export const findDirection = (body: string): Direction | null => {
  const d = body.search(DEBIT);
  const c = body.search(CREDIT);
  if (d < 0 && c < 0) return null;
  if (d < 0) return 'credit';
  if (c < 0) return 'debit';
  return d < c ? 'debit' : 'credit';
};

// Prefer the amount tied to the debit/credit keyword; otherwise the first that isn't a balance or limit
const findAmount = (body: string) => {
  const keyed = body.match(KEYWORD_AMOUNT);
  if (keyed) return keyed[1];
  for (const m of body.matchAll(ANY_AMOUNT)) {
    if (!BEFORE_BALANCE.test(body.slice(Math.max(0, m.index - 20), m.index))) return m[1];
  }
  return null;
};

export function parseSms(sms: RawSms): ParseResult {
  const { body } = sms;
  if (!BANK_SENDER.test(sms.sender) || IGNORE.test(body)) return { kind: 'ignored' };

  const direction = findDirection(body);
  if (!direction) return { kind: 'ignored' };

  const found = findAmount(body);
  const amountPaise = found === null ? null : rupeesToPaise(found);
  if (!amountPaise) return { kind: 'needs_review', sms, reason: 'amount not found' };

  const channel = CHANNELS.find(([, p]) => p.test(body))?.[0] ?? 'other';
  return {
    kind: 'transaction',
    txn: {
      amountPaise,
      direction,
      occurredAt: sms.receivedAt,
      accountMask: body.match(ACCOUNT_MASK)?.[1] ?? null,
      upiRef: channel === 'upi' ? (body.match(UPI_REF)?.[1] ?? null) : null,
      merchant: findMerchant(body),
      channel,
      sourceSmsId: sms.id,
      sourceSender: sms.sender,
    },
  };
}
