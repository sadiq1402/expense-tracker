import { sameAccount } from '@/domain/accounts';
import { istFields } from '@/domain/dateRange';
import type { Account, Category, MerchantRule, Transaction } from '@/domain/types';

const COLUMNS = [
  'date',
  'time',
  'direction',
  'amount',
  'merchant',
  'category',
  'account',
  'channel',
  'upi_reference',
  'note',
  'refund',
  'self_transfer',
  'excluded',
  'cash',
];

const pad = (n: number) => String(n).padStart(2, '0');
const yesNo = (b: boolean) => (b ? 'yes' : 'no');

// Text starting with = + - @ (or tab / CR) runs as a formula in spreadsheets, so it is prefixed with ' to stay text
const cell = (value: string | null) => {
  if (value === null) return '';
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) || text !== value ? `"${text.replace(/"/g, '""')}"` : text;
};

const istDate = (ms: number) => {
  const { year, month, day } = istFields(ms);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
};

export function toCsv(txns: Transaction[], categories: Category[], accounts: Account[]): string {
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const accountName = (mask: string | null) =>
    mask
      ? ((accounts.find((a) => a.mask === mask) ?? accounts.find((a) => sameAccount(a.mask, mask)))?.name ??
        `··${mask}`)
      : null;
  const rows = [...txns]
    .sort((a, b) => a.occurredAt - b.occurredAt)
    .map((t) => {
      const { hour, minute } = istFields(t.occurredAt);
      return [
        istDate(t.occurredAt),
        `${pad(hour)}:${pad(minute)}`,
        t.direction,
        (t.amountPaise / 100).toFixed(2),
        cell(t.merchant),
        cell(t.categoryId ? (categoryNames.get(t.categoryId) ?? t.categoryId) : null),
        cell(accountName(t.accountMask)),
        t.channel,
        t.upiRef ?? '',
        cell(t.note),
        yesNo(t.isRefund),
        yesNo(t.isSelfTransfer),
        yesNo(t.isExcluded),
        yesNo(t.isCash),
      ].join(',');
    });
  // BOM so Excel reads ₹ and Hindi as UTF-8; CRLF line endings, as Excel and Sheets expect
  return '\uFEFF' + [COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}

export interface ExportData {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  rules: MerchantRule[];
}

export function toExportJson(data: ExportData, now: number): string {
  return JSON.stringify(
    {
      format: 'expense-tracker',
      version: 1,
      exportedAt: new Date(now).toISOString(),
      transactions: data.transactions,
      accounts: data.accounts,
      categories: data.categories,
      merchantRules: data.rules,
    },
    null,
    2,
  );
}

export function exportFileName(kind: 'csv' | 'json', now: number): string {
  return `expense-tracker-${istDate(now)}.${kind}`;
}
