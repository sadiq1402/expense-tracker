import { parseSms } from '@/domain/parseSms';

import { sms, upiDebitFixtures } from './fixtures/sms';

const amountOf = (body: string) => {
  const r = parseSms(sms('x', 'VM-HDFCBK', body));
  return r.kind === 'transaction' ? r.txn.amountPaise : null;
};

describe('parseSms', () => {
  test.each(upiDebitFixtures)('parses $name', ({ sms: input, expected }) => {
    expect(parseSms(input)).toEqual(expected);
  });

  test('amount formats', () => {
    expect(amountOf('Rs.1,23,456.50 debited from A/c XX1234 UPI Ref 628812345678')).toBe(12345650);
    expect(amountOf('INR 500 debited from A/c XX1234 UPI Ref 628812345678')).toBe(50000);
    expect(amountOf('Rs 500.00 debited from A/c XX1234 UPI Ref 628812345678')).toBe(50000);
    expect(amountOf('₹500 debited from A/c XX1234 UPI Ref 628812345678')).toBe(50000);
  });

  test('ignores OTP messages that mention an amount', () => {
    const r = parseSms(
      sms('o1', 'VM-HDFCBK', '123456 is your OTP for txn of Rs 500.00 at AMAZON. Do not share. -HDFC Bank'),
    );
    expect(r).toEqual({ kind: 'ignored' });
  });

  test('ignores SMS from personal numbers', () => {
    const r = parseSms(sms('p1', '+919876543210', 'Rs 500 debited from A/c XX1234 UPI Ref 628812345678'));
    expect(r).toEqual({ kind: 'ignored' });
  });

  test('ignores SMS with no debit keyword', () => {
    expect(parseSms(sms('n1', 'VM-HDFCBK', 'Your statement for Oct is ready.'))).toEqual({ kind: 'ignored' });
  });

  test('debit keyword without an amount goes to needs_review', () => {
    const input = sms('r1', 'VM-HDFCBK', 'Your A/c XX1234 has been debited. Ref 628812345678');
    expect(parseSms(input)).toEqual({ kind: 'needs_review', sms: input, reason: 'amount not found' });
  });
});
