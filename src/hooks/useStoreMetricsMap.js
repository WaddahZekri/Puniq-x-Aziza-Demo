import { useMemo } from 'react';
import { getStoreMetrics } from '../utils/metricsEngine';

// List counterpart to useStoreMetrics — for components that need every
// connected store's metrics in one pass (a ranking table row per store, a
// network-wide sum), where calling a hook once per array item would break
// React's rules of hooks. Still a single hook call per component; the loop
// happens inside it. Returns a Map keyed by store code so callers do
// `map.get(store.code)` instead of re-deriving the lookup themselves.
export function useStoreMetricsMap(stores) {
  return useMemo(() => new Map(stores.map((store) => [store.code, getStoreMetrics(store)])), [stores]);
}
