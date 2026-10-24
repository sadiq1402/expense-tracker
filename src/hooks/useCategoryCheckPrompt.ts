import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { repo } from '@/db/repo';
import { uncheckedExpenses } from '@/domain/categoryCheck';
import { onIngested } from '@/services/ingestion';

// Opens the Category Check after the scan that follows a launch or a return to the app; scans while the app
// stays open don't interrupt the user
export function useCategoryCheckPrompt() {
  const path = usePathname();
  const pathname = useRef(path);
  useEffect(() => {
    pathname.current = path;
  }, [path]);

  useEffect(() => {
    let armed = true;
    const prompt = async () => {
      if (!armed) return;
      armed = false;
      // Returning to the app with the sheet already up must not stack a second one
      if (pathname.current === '/category-check') return;
      const [txns, accounts] = await Promise.all([repo.allTransactions(), repo.accounts()]);
      if (uncheckedExpenses(txns, accounts).length > 0) router.push('/category-check');
    };
    const stop = onIngested(() => {
      prompt().catch((e) => console.error('Opening the Category Check failed', e));
    });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') armed = true;
    });
    return () => {
      stop();
      appState.remove();
    };
  }, []);
}
