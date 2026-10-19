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
    const r = parseSms(
      sms('c1', 'VM-HDFCBK', 'Rs.500 credited to A/c XX1234 by RAHUL. If not you, report via the link sent SMS.'),
    );
    expect(r.kind === 'transaction' && [r.txn.direction, r.txn.merchant]).toEqual(['credit', 'RAHUL']);
  });

  test('merchant refund credit is a transaction, not ignored', () => {
    const r = parseSms(
      sms('rf', 'VM-HDFCBK', 'Rs 499.00 credited to your A/c XX1234 towards refund from AMAZON on 15-10-26.'),
    );
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
    const vpa = parseSms(
      sms('v', 'VM-HDFCBK', 'Rs 200 debited from A/c XX1234 to VPA shop@ybl on 15-10-26. UPI Ref 628812345678'),
    );
    expect(vpa.kind === 'transaction' && vpa.txn.merchant).toBe('SHOP@YBL');
    const amt = parseSms(
      sms(
        'm',
        'AD-SBIINB',
        'Your A/c X5678 credited by Rs.5,000.00 on 15Oct26 by a/c linked to mobile 9XXXXXX123 (IMPS Ref no 628812345678)',
      ),
    );
    expect(amt.kind === 'transaction' && amt.txn.merchant).toBeNull();
  });

  test('a word ending in "rs" is not an amount', () => {
    const r = parseSms(sms('w', 'VM-HDFCBK', 'Dear users 2 orders debited via UPI Ref 628812345678'));
    expect(r.kind).toBe('needs_review');
  });
});

describe('card SMS that name the payee inside a UPI tag', () => {
  test('Yes Bank card: "@UPI_<name> <date>"', () => {
    const r = parseSms(
      sms(
        'yc',
        'VM-YESBNK-S',
        'INR 45.00 spent on YES BANK Card X1234 @UPI_MAHADEV SUPER MARK 12-10-2026 08:41:10 am. Avl Lmt INR 12,345.00. SMS BLKCC 1234 to 9999999999 if not you',
      ),
    );
    expect(r.kind === 'transaction' && [r.txn.merchant, r.txn.amountPaise, r.txn.direction]).toEqual([
      'MAHADEV SUPER MARK',
      4500,
      'debit',
    ]);
  });

  test('ICICI card: "for UPI-<ref>-<name>" and never the footer word "dispute"', () => {
    const r = parseSms(
      sms(
        'ic',
        'AX-ICICIT-S',
        'ICICI Bank Credit Card XX7008 debited for INR 25.00 on 11-Jul-26 for UPI-192341379209-Mahadev. To dispute call 18001080/SMS BLOCK 7008 to 9215676766',
      ),
    );
    expect(r.kind === 'transaction' && [r.txn.merchant, r.txn.upiRef, r.txn.accountMask]).toEqual([
      'MAHADEV',
      '192341379209',
      '7008',
    ]);
  });

  test('a footer like "To dispute call" alone never becomes a Merchant', () => {
    const r = parseSms(
      sms('d', 'AX-ICICIT-S', 'ICICI Bank Card XX7008 debited for INR 25.00 on 11-Jul-26. To dispute call 18001080'),
    );
    expect(r.kind === 'transaction' && r.txn.merchant).toBeNull();
  });
});

describe('more payee formats from real inboxes', () => {
  const merchantOf = (sender: string, body: string) => {
    const r = parseSms(sms('m', sender, body));
    return r.kind === 'transaction' ? r.txn.merchant : 'not a transaction';
  };

  test('Yes Bank card with a plain merchant tag', () => {
    expect(
      merchantOf(
        'VM-YESBNK-S',
        'INR 250.00 spent on YES BANK Card X1234 @SWIGGYFOOD 12-10-2026 08:41:10 pm. Avl Lmt INR 12,345.00. SMS BLKCC 1234 to 9999999999 if not you',
      ),
    ).toBe('SWIGGYFOOD');
  });

  test('names that start with a digit', () => {
    expect(
      merchantOf(
        'VM-YESBNK-S',
        'INR 45.00 spent on YES BANK Card X1234 @UPI_7 ELEVEN PUNE 12-10-2026 08:41:10 pm. Avl Lmt INR 1,000.00.',
      ),
    ).toBe('7 ELEVEN PUNE');
  });

  test('the HDFC "To" line is always the payee, even a bank or wallet', () => {
    expect(
      merchantOf(
        'VM-HDFCBK-S',
        'Sent Rs.199.00\nFrom HDFC Bank A/C *1421\nTo AIRTEL PAYMENTS BANK LIMI\nOn 12/10/26\nRef 628812345678\nNot You?\nCall 18002586161',
      ),
    ).toBe('AIRTEL PAYMENTS BANK LIMI');
  });

  test('ICICI card "on <date> on <merchant>."', () => {
    expect(
      merchantOf(
        'AX-ICICIT-S',
        'INR 1,299.00 spent using ICICI Bank Card XX7008 on 12-Jul-26 on APPLE INDIA PRI. Avl Limit: INR 50,000.00. If not you, call 1800 1080/SMS BLOCK 7008 to 9215676766.',
      ),
    ).toBe('APPLE INDIA PRI');
  });

  test('HDFC card "At ..<merchant>_ On"', () => {
    expect(
      merchantOf(
        'VM-HDFCBK-S',
        'Spent Rs.1499 On HDFC Bank Card 1234 At ..RELIANCE TRENDS_ On 2026-10-12:18:22:10.Not You? To Block+Reissue Call 18002586161',
      ),
    ).toBe('RELIANCE TRENDS');
  });

  test('a card-bill app confirmation names the app as the Merchant', () => {
    expect(
      merchantOf(
        'JM-GKIWIP-S',
        'Your YES Bank Credit Card XXXX-1234 bill of Rs. 4250.00 has been successfully paid via Kiwi.',
      ),
    ).toBe('KIWI');
  });

  test('a VPA payee with a 4-digit-year date stays the VPA', () => {
    expect(
      merchantOf('VM-HDFCBK', 'Rs 200 debited from A/c XX1234 to VPA shop@ybl on 15-10-2026. UPI Ref 628812345678'),
    ).toBe('SHOP@YBL');
  });

  test('an ordinary bill paid via an app does not name the app', () => {
    expect(
      merchantOf('VM-HDFCBK', 'Your Electricity bill of Rs 1200 has been paid via PhonePe from A/c XX1234.'),
    ).not.toBe('PHONEPE');
  });

  test('a masked phone number is not a Merchant', () => {
    expect(
      merchantOf('VM-HDFCBK', 'Rs 200 debited from A/c XX1234 to 98XXXXXX12 on 15-10-26. UPI Ref 628812345678'),
    ).toBeNull();
  });

  test('the HDFC "To" line naming the user\'s own account or a block instruction is not a Merchant', () => {
    expect(
      merchantOf(
        'VM-HDFCBK',
        'Sent Rs.500.00\nFrom HDFC Bank A/C *1421\nTo HDFC Bank A/C *5678\nOn 12/10/26\nRef 628812345678',
      ),
    ).toBeNull();
    expect(
      merchantOf('VM-HDFCBK', 'Sent Rs.500.00\nFrom HDFC Bank A/C *1421\nTo block card, SMS BLOCK 1421 to 7308080808'),
    ).toBeNull();
  });

  test('a payment link is never a Merchant', () => {
    expect(
      merchantOf(
        'VM-HDFCBK-S',
        'Sent Rs.50.00\nFrom HDFC Bank A/C *1421\nTo https://x.hdfc.bank.in/HDFCBK/a/abc\nOn 12/10/26\nRef 628812345678',
      ),
    ).toBeNull();
  });
});
