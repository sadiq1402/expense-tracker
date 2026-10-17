# Expense Tracker — Spec (v1)

Personal Android app, sideloaded as an APK. Terms are defined in `GLOSSARY.md`; architecture rationale in `docs/adr/0001-on-device-sms-ingestion.md`.

## Ingestion
- Source: bank / UPI SMS from any Indian bank. Covers UPI, card, ATM, NEFT/IMPS, auto-debit.
- First launch: scan the last 6 months of inbox SMS.
- New SMS are captured on arrival; on every app open, the inbox is re-scanned since the last processed SMS to catch misses.
- Parsing: generic patterns extract amount, direction (debit/credit), Account (masked number), UPI Reference, Merchant, timestamp. Non-transactional SMS (OTP, promos, balance alerts, "will be debited" reminders) are ignored. Transaction-looking SMS that cannot be confidently parsed go to Needs Review.
- Dedup: messages with the same UPI Reference are one Transaction. Without a reference: same amount, same direction, within 5 minutes, from different senders → one Transaction.

## Accounts and Self-Transfers
- Accounts are discovered from masked numbers in SMS; user can rename/confirm.
- A debit from one Account and a credit of equal amount to another Account within 10 minutes → both marked Self-Transfer.
- User can manually mark/unmark Self-Transfer.

## Categories
- Defaults: Food, Groceries, Shopping, Travel, Bills & Utilities, Rent, Entertainment, Health, Transfers to People, Other. User can add more.
- Assigned via Merchant Rules (built-in seed list + user corrections). Correcting a Transaction's Category creates/updates the Merchant Rule.
- Refund: credit from a Merchant previously debited → takes that Merchant's Category and reduces the Category's spend.
- Friend repayments are ordinary credits.

## Editing
- Edit Category, Merchant, note; mark Self-Transfer; mark Excluded.
- Add Cash Transaction (amount, Category, note, date).
- Resolve Needs Review items into Transactions or dismiss them.

## Dashboard
- Spend by Category, monthly trend, top Merchants.
- Range: current month by default; switcher for week / month / custom.
- Spend = sum of Expenses minus Refunds, ignoring Excluded and Self-Transfers.

## Safety
- All data on-device in SQLite; no network.
- Manual export to JSON and CSV.
- App lock with fingerprint / device PIN.
