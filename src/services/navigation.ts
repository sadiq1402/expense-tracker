import { router } from 'expo-router';

import type { BreakdownFilter } from '@/domain/breakdown';
import type { DateRange } from '@/domain/dateRange';

// Route params are strings, so the range travels as epoch-ms text alongside its display label
export function openBreakdown(filter: BreakdownFilter, range: DateRange, label: string) {
  router.push({
    pathname: '/breakdown',
    params: { kind: filter.kind, key: filter.key, start: String(range.start), end: String(range.end), label },
  });
}
