import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { repo } from '@/db/repo';
import { exportFileName, toCsv, toExportJson } from '@/domain/export';

// Writes to the app's cache (no storage permission) and hands the file to the Android share sheet; nothing leaves the
// phone unless the user picks a destination there
export async function exportData(kind: 'csv' | 'json'): Promise<void> {
  const [transactions, accounts, categories, rules] = await Promise.all([
    repo.allTransactions(),
    repo.accounts(),
    repo.categories(),
    repo.userRules(),
  ]);
  const now = Date.now();
  const content =
    kind === 'csv'
      ? toCsv(transactions, categories, accounts)
      : toExportJson({ transactions, accounts, categories, rules }, now);

  // An earlier export may still be in cache; clear old ones now rather than after sharing, as some apps read late
  for (const old of Paths.cache.list()) {
    if (old instanceof File && old.name.startsWith('expense-tracker-')) old.delete();
  }
  const file = new File(Paths.cache, exportFileName(kind, now));
  file.create({ overwrite: true });
  await file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: kind === 'csv' ? 'text/csv' : 'application/json',
    dialogTitle: kind === 'csv' ? 'Export Transactions (CSV)' : 'Export all data (JSON)',
  });
}
