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

  test('takes the debited amount, not the available balance', () => {
    const r = parseSms(
      sms(
        'b1',
        'JD-SBIUPI',
        'Dear UPI user A/C X5678 debited by 120.0 on date 15Oct26 trf to ZOMATO LTD Refno 628812345679. Avl Bal Rs 5,000.00 -SBI',
      ),
    );
    expect(r.kind === 'transaction' && r.txn.amountPaise).toBe(12000);
  });

  test.each([
    ['failed txn', 'Your UPI txn of Rs 500 to SWIGGY failed. Amount if debited will be refunded in 3 days.'],
    ['reversal', 'Rs 500 debited from A/c XX1234 on 15-10-26 has been reversed. -HDFC'],
    ['bill reminder', 'Your HDFC Credit Card bill of Rs 12,000 is due on 20-10-26. Ignore if already paid.'],
    ['auto-debit mandate notice', 'Rs 499 will be auto-debited from A/c XX1234 on 20-10-26 for NETFLIX mandate.'],
    ['credit with "sent" in footer', 'Rs.500 credited to A/c XX1234 by RAHUL. If not you, report via the link sent SMS.'],
  ])('ignores %s', (_name, body) => {
    expect(parseSms(sms('n', 'VM-HDFCBK', body))).toEqual({ kind: 'ignored' });
  });

  test.each([
    ['card spend', 'Rs 1,200.00 spent on HDFC Bank Card XX1234 at AMAZON on 15-10-26.'],
    ['ATM withdrawal', 'Rs 2,000 withdrawn from A/c XX1234 at ATM on 15-10-26.'],
  ])('ignores non-UPI debit for now: %s', (_name, body) => {
    expect(parseSms(sms('c', 'VM-HDFCBK', body))).toEqual({ kind: 'ignored' });
  });

  test('a word ending in "rs" is not an amount', () => {
    const r = parseSms(sms('w', 'VM-HDFCBK', 'Dear users 2 orders debited via UPI Ref 628812345678'));
    expect(r.kind).toBe('needs_review');
  });
});
