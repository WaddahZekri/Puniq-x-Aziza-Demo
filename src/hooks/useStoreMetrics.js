import { useMemo } from 'react';
import { getStoreMetrics } from '../utils/metricsEngine';

// Thin wrapper around getStoreMetrics — the single place a future backend
// swap needs to touch (e.g. useState/useEffect around a fetch, or a
// query-library hook) instead of the 5+ components that used to call the
// metricsEngine function directly. Memoized on `store` so behavior matches
// (or improves toward) how each prior call site already treated it.
export function useStoreMetrics(store) {
  return useMemo(() => getStoreMetrics(store), [store]);
}
