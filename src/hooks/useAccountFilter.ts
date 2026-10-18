import { useSyncExternalStore } from 'react';

// One Account choice shared by Dashboard, Transactions and breakdowns; it resets when the app restarts
let selected: string | null = null;
const listeners = new Set<() => void>();

export function setAccountFilter(mask: string | null) {
  selected = mask;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => selected;

export function useAccountFilter(): string | null {
  return useSyncExternalStore(subscribe, snapshot);
}
