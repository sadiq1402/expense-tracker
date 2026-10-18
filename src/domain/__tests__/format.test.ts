import {
  accountLabel,
  bankFromSender,
  formatRupees,
  formatSignedRupees,
  formatWholeRupees,
  merchantLabel,
  rupeesToPaise,
} from '@/domain/format';

test('formats paise as Indian-grouped rupees', () => {
  expect(formatRupees(12345650)).toBe('₹1,23,456.50');
  expect(formatRupees(25000)).toBe('₹250');
  expect(formatRupees(9905)).toBe('₹99.05');
});

test('reads user-typed rupee amounts as paise', () => {
  expect(rupeesToPaise('1,23,456.50')).toBe(12345650);
  expect(rupeesToPaise(' 500 ')).toBe(50000);
  expect(rupeesToPaise('99.5')).toBe(9950);
  expect(rupeesToPaise('0')).toBeNull();
  expect(rupeesToPaise('12.345')).toBeNull();
  expect(rupeesToPaise('abc')).toBeNull();
});

test('signed rupees use a true minus sign for negative net spend', () => {
  expect(formatSignedRupees(-12345650)).toBe('−₹1,23,456.50');
  expect(formatSignedRupees(25000)).toBe('₹250');
});

test('labels an Account by the name the user gave it, else bank and mask', () => {
  const names = new Map([
    ['1234', 'Salary'],
    ['1421', 'A/c XX1421'],
  ]);
  expect(accountLabel('1234', names, 'VM-HDFCBK')).toBe('Salary');
  expect(accountLabel('1421', names, 'VM-HDFCBK')).toBe('HDFC ··1421');
  expect(accountLabel('5678', names, 'AX-ICICIB')).toBe('ICICI ··5678');
  expect(accountLabel('5678', names, 'VM-UNKNWN')).toBe('··5678');
  expect(accountLabel(null, names, 'VM-HDFCBK')).toBeNull();
});

test('reads the bank from the SMS sender header', () => {
  expect(bankFromSender('JD-SBIUPI')).toBe('SBI');
  expect(bankFromSender('VK-AXISBK-S')).toBe('Axis');
  expect(bankFromSender('VM-KOTAKB')).toBe('Kotak');
  expect(bankFromSender('')).toBeNull();
});

test('summary amounts round to whole rupees', () => {
  expect(formatWholeRupees(8416962)).toBe('₹84,170');
  expect(formatWholeRupees(-12345)).toBe('−₹123');
});

test('Merchant names read in title case, VPAs stay as typed', () => {
  expect(merchantLabel({ merchant: 'SARAVANA STORE', isCash: false })).toBe('Saravana Store');
  expect(merchantLabel({ merchant: 'PUSHPENDRA SINGH TOMAR', isCash: false })).toBe('Pushpendra Singh Tomar');
  expect(merchantLabel({ merchant: 'BLINKIT@HDFCBANK', isCash: false })).toBe('blinkit@hdfcbank');
  expect(merchantLabel({ merchant: 'AMAZON PAY', isCash: false })).toBe('Amazon Pay');
});
