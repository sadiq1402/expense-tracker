# Glossary

**Transaction**: A single movement of money into or out of one of the user's accounts, either a debit or a credit.

**Expense**: A debit Transaction that is not a Self-Transfer.

**Refund**: A credit from a Merchant the user has previously paid for a purchase (a payment in any Category other than Other or Transfers to People); it takes that payment's Category and reduces that Category's spending instead of counting as income.

**Self-Transfer**: A Transaction that moves money between two of the user's own accounts. It is never counted as an Expense.

**Account**: One of the user's own bank accounts or cards, identified by its masked number and given a friendly name by the user.

**Cash Transaction**: A Transaction the user enters by hand because no message reports it.

**Excluded**: A Transaction the user has chosen to hide from the dashboard and all totals.

**Category**: A label for what a Transaction was spent on or received for (e.g. Food, Travel, Rent).

**Merchant**: The person or business on the other side of a Transaction.

**Merchant Rule**: A remembered mapping from a Merchant to a Category, created when the user corrects a Transaction's Category.

**Mixed Merchant**: A Merchant the user has put in more than one Category, so it has no Merchant Rule and each of its new Expenses goes to the Category Check.

**Category Check**: The sheet that opens when the app is opened or returned to, listing new Unchecked Expenses so the user can confirm or change their Categories in one go.

**Unchecked**: The state of a new SMS Expense whose Category the user hasn't confirmed yet.

**Needs Review**: The state of a message the app could not confidently turn into a Transaction; the user resolves it manually.

**UPI Reference**: The unique reference number of a UPI payment, used to recognise that two messages describe the same Transaction.
