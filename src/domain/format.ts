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

export function formatSignedRupees(paise: number): string {
  return paise < 0 ? `−${formatRupees(-paise)}` : formatRupees(paise);
}

// Accepts "1,23,456.50"-style input; null for anything that isn't a positive rupee amount
export function rupeesToPaise(amount: string): number | null {
  const m = amount.trim().replace(/,/g, '').match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const paise = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return paise > 0 ? paise : null;
}

export function merchantLabel(t: Pick<Transaction, 'merchant' | 'isCash'>): string {
  return t.merchant ?? (t.isCash ? 'Cash' : 'Unknown');
}
