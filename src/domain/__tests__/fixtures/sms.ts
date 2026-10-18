import type { Channel, Direction, ParseResult, RawSms } from '@/domain/types';

export const AT = Date.UTC(2026, 9, 15, 8, 52);

export const sms = (id: string, sender: string, body: string): RawSms => ({
  id,
  sender,
  body,
  receivedAt: AT,
});

const txn = (
  id: string,
  sourceSender: string,
  direction: Direction,
  channel: Channel,
  amountPaise: number,
  accountMask: string | null,
  upiRef: string | null,
  merchant: string | null,
): ParseResult => ({
  kind: 'transaction',
  txn: { amountPaise, direction, occurredAt: AT, accountMask, upiRef, merchant, channel, sourceSmsId: id, sourceSender },
});

type Fixture = { name: string; sms: RawSms; expected: ParseResult };

const fixture = (
  name: string,
  id: string,
  sender: string,
  body: string,
  ...rest: Parameters<typeof txn> extends [string, string, ...infer R] ? R : never
): Fixture => ({ name, sms: sms(id, sender, body), expected: txn(id, sender, ...rest) });

export const transactionFixtures: Fixture[] = [
  fixture(
    'HDFC UPI debit',
    'h1',
    'VM-HDFCBK',
    'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 15/10/26\nRef 628812345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808',
    'debit', 'upi', 25000, '1234', '628812345678', 'SWIGGY',
  ),
  fixture(
    'HDFC UPI credit',
    'h2',
    'VM-HDFCBK',
    'Received Rs.500.00 in your HDFC Bank A/c XX1234 from rahul.k@okaxis on 15-10-26 by UPI Ref No 628812345690. -HDFC Bank',
    'credit', 'upi', 50000, '1234', '628812345690', 'RAHUL.K@OKAXIS',
  ),
  fixture(
    'HDFC card spend',
    'h3',
    'VM-HDFCBK',
    'Rs 1,200.00 spent on HDFC Bank Card XX1234 at AMAZON on 15-10-26. Not you? Call 18002586161',
    'debit', 'card', 120000, '1234', null, 'AMAZON',
  ),
  fixture(
    'SBI UPI debit',
    's1',
    'JD-SBIUPI',
    'Dear UPI user A/C X5678 debited by 120.0 on date 15Oct26 trf to ZOMATO LTD Refno 628812345679. If not u? call 1800111109. -SBI',
    'debit', 'upi', 12000, '5678', '628812345679', 'ZOMATO LTD',
  ),
  fixture(
    'SBI ATM withdrawal',
    's2',
    'AD-SBIINB',
    'Dear Customer, Rs.2,000 withdrawn at SBI ATM S1BW000123 from A/c X5678 on 15Oct26. Avl Bal Rs.8,000. -SBI',
    'debit', 'atm', 200000, '5678', null, null,
  ),
  fixture(
    'SBI NEFT credit',
    's3',
    'AD-SBIINB',
    'Dear Customer, your A/c X5678 is credited with INR 45,000.00 on 15Oct26 by NEFT from ACME PVT LTD. Avl Bal INR 53,000.00 -SBI',
    'credit', 'neft_imps', 4500000, '5678', null, 'ACME PVT LTD',
  ),
  fixture(
    'ICICI UPI debit',
    'i1',
    'AX-ICICIB',
    'ICICI Bank Acct XX901 debited for Rs 99.00 on 15-Oct-26; UBER INDIA credited. UPI:628812345680. Call 18002662 for dispute. SMS BLOCK 901 to 9215676766.',
    'debit', 'upi', 9900, '901', '628812345680', 'UBER INDIA',
  ),
  fixture(
    'ICICI auto-debit',
    'i2',
    'AX-ICICIB',
    'Your ICICI Bank Acct XX901 has been debited with INR 499.00 on 15-Oct-26 towards NACH mandate for NETFLIX. Avl Bal INR 1,200.00.',
    'debit', 'autodebit', 49900, '901', null, 'NETFLIX',
  ),
  fixture(
    'Axis UPI debit',
    'a1',
    'VK-AXISBK-S',
    'INR 1,250.00 debited\nA/c no. XX4321\n15-10-26, 14:22:10\nUPI/P2M/628812345681/AMAZON PAY\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank',
    'debit', 'upi', 125000, '4321', '628812345681', 'AMAZON PAY',
  ),
  fixture(
    'Axis IMPS credit',
    'a2',
    'VK-AXISBK',
    'INR 3,000.00 credited\nA/c no. XX4321\n15-10-26, 10:01:44\nIMPS/P2A/628812345682/PRIYA S\nAxis Bank',
    'credit', 'neft_imps', 300000, '4321', null, 'PRIYA S',
  ),
  fixture(
    'Kotak UPI debit',
    'k1',
    'VM-KOTAKB',
    'Sent Rs.80.00 from Kotak Bank AC X7788 to blinkit@hdfcbank on 15-10-26.UPI Ref 628812345683. Not you, https://kotak.com/fraud',
    'debit', 'upi', 8000, '7788', '628812345683', 'BLINKIT@HDFCBANK',
  ),
  fixture(
    'Kotak UPI credit',
    'k2',
    'VM-KOTAKB',
    'Received Rs.1,500.00 in your Kotak Bank AC X7788 from amit@ybl on 15-10-26.UPI Ref:628812345684.',
    'credit', 'upi', 150000, '7788', '628812345684', 'AMIT@YBL',
  ),
  fixture(
    'PNB debit',
    'p1',
    'BP-PNBSMS',
    'A/c XX3344 debited INR 650.00 Dt 15-10-26 thru UPI:628812345685. Bal INR 9,350.00 Not u? Fwd this SMS to 9264092640 to block UPI. -PNB',
    'debit', 'upi', 65000, '3344', '628812345685', null,
  ),
  fixture(
    'BoB credit',
    'b1',
    'VM-BOBTXN',
    'Rs.2000.00 Credited to A/c ...6677 thru UPI/628812345686 by suresh@paytm on 15-10-26. Total Bal:Rs.12000.00CR -Bank of Baroda',
    'credit', 'upi', 200000, '6677', '628812345686', 'SURESH@PAYTM',
  ),
  fixture(
    'PhonePe payment',
    'pp1',
    'VM-PHONPE',
    'Paid ₹349 to Zepto Marketplace from A/c XX1234. UPI Ref No 628812345687. -PhonePe',
    'debit', 'upi', 34900, '1234', '628812345687', 'ZEPTO MARKETPLACE',
  ),
  fixture(
    'Paytm payment',
    'pt1',
    'JM-PAYTMB',
    'Rs.150 paid to IRCTC from Paytm Payments Bank a/c XX9900. UPI Ref: 628812345688. -Paytm',
    'debit', 'upi', 15000, '9900', '628812345688', 'IRCTC',
  ),
  fixture(
    'Google Pay payment',
    'g1',
    'AD-GPAYIN',
    'You paid ₹1,000 to Ramesh Kumar via Google Pay from A/c XX4321. UPI transaction ID 628812345689.',
    'debit', 'upi', 100000, '4321', '628812345689', 'RAMESH KUMAR',
  ),
];
