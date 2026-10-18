import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { addInboxListener, requestPermission } from '../../modules/sms-reader';
import { repo } from '@/db/repo';
import type { Account, Category, Transaction } from '@/domain/types';
import { runIngestion } from '@/services/ingestion';

export type LedgerStatus = 'loading' | 'denied' | 'error' | 'ready';

export interface Ledger {
  status: LedgerStatus;
  txns: Transaction[];
  categories: Category[];
  accounts: Account[];
  reviewCount: number;
  reviewReasons: string[];
  // When this snapshot was loaded; screens use it as "now" so render stays pure
  loadedAt: number;
}

const INITIAL: Ledger = {
  status: 'loading',
  txns: [],
  categories: [],
  accounts: [],
  reviewCount: 0,
  reviewReasons: [],
  loadedAt: 0,
};

// Re-scans and reloads on focus, on return to the foreground and whenever a new SMS lands
export function useLedger(): Ledger {
  const [ledger, setLedger] = useState<Ledger>(INITIAL);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const refresh = async () => {
        try {
          const granted = await requestPermission();
          if (!granted) {
            if (!cancelled) setLedger({ ...INITIAL, status: 'denied', loadedAt: Date.now() });
            return;
          }
          await runIngestion();
          const [txns, needsReview, categories, accounts] = await Promise.all([
            repo.allTransactions(),
            repo.listNeedsReview(),
            repo.categories(),
            repo.accounts(),
          ]);
          if (!cancelled)
            setLedger({
              status: 'ready',
              txns,
              categories,
              accounts,
              reviewCount: needsReview.length,
              reviewReasons: needsReview.map((r) => r.reason),
              loadedAt: Date.now(),
            });
        } catch (e) {
          console.error('Ingestion failed', e);
          if (!cancelled) setLedger((l) => ({ ...l, status: 'error' }));
        }
      };
      refresh();
      const inbox = addInboxListener(refresh);
      const appState = AppState.addEventListener('change', (s) => s === 'active' && refresh());
      return () => {
        cancelled = true;
        inbox.remove();
        appState.remove();
      };
    }, []),
  );

  return ledger;
}
