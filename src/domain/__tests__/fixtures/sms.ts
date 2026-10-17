import type { ParseResult, RawSms } from '@/domain/types';

export const AT = Date.UTC(2026, 9, 15, 8, 52);

export const sms = (id: string, sender: string, body: string): RawSms => ({
  id,
  sender,
  body,
  receivedAt: AT,
});

const upiDebit = (
  id: string,
  amountPaise: number,
  accountMask: string,
  upiRef: string,
  merchant: string,
): ParseResult => ({
  kind: 'transaction',
  txn: {
    amountPaise,
    direction: 'debit',
    occurredAt: AT,
    accountMask,
    upiRef,
    merchant,
    channel: 'upi',
    sourceSmsId: id,
  },
});

export const upiDebitFixtures: { name: string; sms: RawSms; expected: ParseResult }[] = [
  {
    name: 'HDFC UPI debit',
    sms: sms(
      'h1',
      'VM-HDFCBK',
      'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 15/10/26\nRef 628812345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808',
    ),
    expected: upiDebit('h1', 25000, '1234', '628812345678', 'SWIGGY'),
  },
  {
    name: 'SBI UPI debit',
    sms: sms(
      's1',
      'JD-SBIUPI',
      'Dear UPI user A/C X5678 debited by 120.0 on date 15Oct26 trf to ZOMATO LTD Refno 628812345679. If not u? call 1800111109. -SBI',
    ),
    expected: upiDebit('s1', 12000, '5678', '628812345679', 'ZOMATO LTD'),
  },
  {
    name: 'ICICI UPI debit',
    sms: sms(
      'i1',
      'AX-ICICIB',
      'ICICI Bank Acct XX901 debited for Rs 99.00 on 15-Oct-26; UBER INDIA credited. UPI:628812345680. Call 18002662 for dispute. SMS BLOCK 901 to 9215676766.',
    ),
    expected: upiDebit('i1', 9900, '901', '628812345680', 'UBER INDIA'),
  },
  {
    name: 'Axis UPI debit',
    sms: sms(
      'a1',
      'VK-AXISBK-S',
      'INR 1,250.00 debited\nA/c no. XX4321\n15-10-26, 14:22:10\nUPI/P2M/628812345681/AMAZON PAY\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank',
    ),
    expected: upiDebit('a1', 125000, '4321', '628812345681', 'AMAZON PAY'),
  },
];
