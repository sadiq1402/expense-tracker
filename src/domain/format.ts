import type { Transaction } from '@/domain/types';

// Hand-rolled lakh/crore grouping so output doesn't depend on the device's Intl data
export function formatRupees(paise: number): string {
  const rupees = Math.floor(paise / 100).toString();
  const fraction = paise % 100;
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `₹${grouped}${fraction ? `.${fraction.toString().padStart(2, '0')}` : ''}`;
}

// Summaries (totals, averages) read better without paise; individual Transactions keep them
export function formatWholeRupees(paise: number): string {
  const whole = Math.round(Math.abs(paise) / 100) * 100;
  return paise < 0 ? `−${formatRupees(whole)}` : formatRupees(whole);
}

export function formatSignedRupees(paise: number): string {
  return paise < 0 ? `−${formatRupees(-paise)}` : formatRupees(paise);
}

// Accepts "1,23,456.50"-style input; null for anything that isn't a positive rupee amount
export function rupeesToPaise(amount: string): number | null {
  const m = amount
    .trim()
    .replace(/,/g, '')
    .match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const paise = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return paise > 0 ? paise : null;
}

// SMS shout Merchant names; show them as words, but leave VPAs (they're addresses) lowercase
const titleCase = (name: string) =>
  name.includes('@')
    ? name.toLowerCase()
    : name.toLowerCase().replace(/(^|[\s.&-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());

export function merchantLabel(t: Pick<Transaction, 'merchant' | 'isCash'>): string {
  return t.merchant ? titleCase(t.merchant) : t.isCash ? 'Cash' : 'Unknown';
}

const BANKS: [RegExp, string][] = [
  [/HDFC/, 'HDFC'],
  [/SBI/, 'SBI'],
  [/ICICI/, 'ICICI'],
  [/AXIS/, 'Axis'],
  [/KOTAK/, 'Kotak'],
  [/PNB/, 'PNB'],
  [/BOB|BARODA/, 'BoB'],
  [/PAYTM/, 'Paytm'],
  [/YESB/, 'Yes Bank'],
  [/IDFC/, 'IDFC'],
  [/INDUS/, 'IndusInd'],
  [/CANBNK|CANARA/, 'Canara'],
  [/UNION/, 'Union Bank'],
];

export function bankFromSender(sender: string): string | null {
  const s = sender.toUpperCase();
  return BANKS.find(([p]) => p.test(s))?.[1] ?? null;
}

// The user's name for the Account when they've renamed it, else "<bank> ··<mask>" from the SMS sender
export function accountLabel(mask: string | null, names: Map<string, string>, sender: string): string | null {
  if (!mask) return null;
  const name = names.get(mask);
  if (name && name !== `A/c XX${mask}`) return name;
  const bank = bankFromSender(sender);
  return bank ? `${bank} ··${mask}` : `··${mask}`;
}
