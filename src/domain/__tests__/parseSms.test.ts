import { parseSms } from '@/domain/parseSms';

import { sms, transactionFixtures } from './fixtures/sms';

const amountOf = (body: string) => {
  const r = parseSms(sms('x', 'VM-HDFCBK', body));
  return r.kind === 'transaction' ? r.txn.amountPaise : null;
};

describe('parseSms', () => {
  test.each(transactionFixtures)('parses $name', ({ sms: input, expected }) => {
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
    ['promo', 'Get Rs 100 cashback on your first UPI payment of Rs 500! T&C apply. -HDFC Bank'],
    ['offer credited', 'Congrats! Rs 50 cashback credited as reward points. Pay now to claim. -PhonePe'],
    ['balance only', 'Avl Bal in A/c XX1234 is Rs 5,000.00 as on 15-10-26. -HDFC Bank'],
    ['money request', 'RAHUL has requested Rs 500 from you on UPI. Pay via the app. -HDFC'],
    ['discount promo', 'Get Rs 100 off! Use code SAVE on payments of Rs 500 debited via UPI. -Paytm'],
    ['will be debited', 'Your A/c XX1234 will be debited with Rs 499 on 20-10-26 for NETFLIX. -ICICI'],
  ])('ignores %s', (_name, body) => {
    expect(parseSms(sms('n', 'VM-HDFCBK', body))).toEqual({ kind: 'ignored' });
  });

  test('credit with "sent" in its footer is a credit', () => {
    const r = parseSms(sms('c1', 'VM-HDFCBK', 'Rs.500 credited to A/c XX1234 by RAHUL. If not you, report via the link sent SMS.'));
    expect(r.kind === 'transaction' && [r.txn.direction, r.txn.merchant]).toEqual(['credit', 'RAHUL']);
  });

  test('merchant refund credit is a transaction, not ignored', () => {
    const r = parseSms(sms('rf', 'VM-HDFCBK', 'Rs 499.00 credited to your A/c XX1234 towards refund from AMAZON on 15-10-26.'));
    expect(r.kind === 'transaction' && [r.txn.direction, r.txn.amountPaise]).toEqual(['credit', 49900]);
  });

  test('credit keyword without an amount goes to needs_review', () => {
    const input = sms('r2', 'VM-KOTAKB', 'Your Kotak AC X7788 has been credited via IMPS. Check app for details.');
    expect(parseSms(input)).toEqual({ kind: 'needs_review', sms: input, reason: 'amount not found' });
  });

  test('ACH debits are auto-debits', () => {
    const r = parseSms(sms('ach', 'VM-HDFCBK', 'Rs.2000 debited from A/c XX1234 towards ACH D- BSE LTD on 15-10-26.'));
    expect(r.kind === 'transaction' && r.txn.channel).toBe('autodebit');
  });

  test('merchant drops a VPA label and never captures an amount', () => {
    const vpa = parseSms(sms('v', 'VM-HDFCBK', 'Rs 200 debited from A/c XX1234 to VPA shop@ybl on 15-10-26. UPI Ref 628812345678'));
    expect(vpa.kind === 'transaction' && vpa.txn.merchant).toBe('SHOP@YBL');
    const amt = parseSms(
      sms('m', 'AD-SBIINB', 'Your A/c X5678 credited by Rs.5,000.00 on 15Oct26 by a/c linked to mobile 9XXXXXX123 (IMPS Ref no 628812345678)'),
    );
    expect(amt.kind === 'transaction' && amt.txn.merchant).toBeNull();
  });

  test('a word ending in "rs" is not an amount', () => {
    const r = parseSms(sms('w', 'VM-HDFCBK', 'Dear users 2 orders debited via UPI Ref 628812345678'));
    expect(r.kind).toBe('needs_review');
  });
});
