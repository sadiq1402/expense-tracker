import { exportFileName, toCsv, toExportJson } from '@/domain/export';

import { txn } from './fixtures/txn';

const ist = (iso: string) => Date.parse(`${iso}+05:30`);
const categories = [{ id: 'food', name: 'Food', builtIn: true }];
const accounts = [{ id: 'a1', mask: '1421', name: 'Salary', confirmed: false, hidden: false }];
const rules = [{ merchant: 'SWIGGY', categoryId: 'food', source: 'user' as const }];

describe('toCsv', () => {
  test('one header row and one row per Transaction with readable values', () => {
    const csv = toCsv(
      [
        txn({
          id: 't1',
          occurredAt: ist('2026-10-18T13:12:00'),
          amountPaise: 34950,
          merchant: 'SWIGGY',
          categoryId: 'food',
          accountMask: '1421',
          channel: 'upi',
          upiRef: '628812345678',
          note: 'team lunch',
        }),
      ],
      categories,
      accounts,
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const [header, row, ...rest] = csv.slice(1).split('\r\n');
    expect(header).toBe(
      'date,time,direction,amount,merchant,category,account,channel,upi_reference,note,refund,self_transfer,excluded,cash',
    );
    expect(row).toBe('2026-10-18,13:12,debit,349.50,SWIGGY,Food,Salary,upi,628812345678,team lunch,no,no,no,no');
    expect(rest).toEqual(['']);
  });

  test('quotes fields with commas, quotes or newlines', () => {
    const csv = toCsv([txn({ merchant: 'A, "B"', note: 'line1\nline2', categoryId: null, accountMask: null })], [], []);
    expect(csv.split('\r\n')[1]).toContain('"A, ""B""",');
    expect(csv).toContain('"line1\nline2"');
  });

  test('neutralises spreadsheet formulas in text fields', () => {
    const row = toCsv([txn({ merchant: '=HYPERLINK("x")' })], [], []).split('\r\n')[1];
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
  });

  test('uses IST for the date, so a late-night payment keeps its day', () => {
    expect(toCsv([txn({ occurredAt: ist('2026-10-31T23:30:00') })], [], []).split('\r\n')[1]).toMatch(
      /^2026-10-31,23:30,/,
    );
  });
});

describe('toExportJson', () => {
  test('contains every collection plus format version and export time', () => {
    const t = txn({ id: 't1' });
    const data = JSON.parse(
      toExportJson({ transactions: [t], accounts, categories, rules }, ist('2026-10-18T10:00:00')),
    );
    expect(data).toEqual({
      format: 'expense-tracker',
      version: 1,
      exportedAt: '2026-10-18T04:30:00.000Z',
      transactions: [t],
      accounts,
      categories,
      merchantRules: rules,
    });
  });
});

test('file names carry the IST date', () => {
  expect(exportFileName('csv', ist('2026-10-18T23:59:00'))).toBe('expense-tracker-2026-10-18.csv');
});

test('an exact mask match wins over a 3-digit suffix match', () => {
  const two = [
    { id: 'x', mask: '1901', name: 'HDFC card', confirmed: false, hidden: false },
    { id: 'y', mask: '901', name: 'ICICI', confirmed: false, hidden: false },
  ];
  expect(toCsv([txn({ accountMask: '901' })], [], two).split('\r\n')[1]).toContain(',ICICI,');
});
