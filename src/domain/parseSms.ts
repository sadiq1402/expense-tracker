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
// Ordered most-specific first; a capture naming the user's own account or bank is skipped, but a VPA never is
const MERCHANT = [
  /\nTo\s+([^\n]+)/,
  /trf to\s+(.+?)\s+Ref/i,
  /;\s*(.+?)\s+credited/i,
  /(?:UPI|IMPS)\/P2[MA]\/\d+\/([^\n]+)/i,
  new RegExp(String.raw`\bfor\s+([A-Z][A-Z0-9 &*.'-]+?)` + STOP),
  new RegExp(String.raw`\b(?:to|at|by|from)\s+(?:vpa\s+)?([A-Za-z0-9@][A-Za-z0-9@ &*.'_-]*?)` + STOP, 'gi'),
];
const NOT_MERCHANT = /a\/c|\bac\b|acct|account|card|bank|\byour\b|\batm\b|\bmobile\b|neft|imps|upi|^\d|^(?:rs|inr)\b/i;

// Fraud/helpline footers mention "to"/"at" too, so merchant search stops before them
const FOOTER = /\b(?:not (?:u|you)|if not|call\b|sms block|fwd this)/i;

const findMerchant = (sms: string) => {
  const cut = sms.search(FOOTER);
  const body = cut < 0 ? sms : sms.slice(0, cut);
  for (const p of MERCHANT) {
    const matches = p.global ? [...body.matchAll(p)] : [body.match(p)];
    for (const m of matches) {
      const name = m?.[1].trim();
      if (name && (/^\S+@\S+$/.test(name) || !NOT_MERCHANT.test(name))) return name.toUpperCase();
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
    },
  };
}
