import { useMemo } from 'react';
import { getBenchmarkPercentile } from '../utils/metricsEngine';

// List counterpart to useBenchmarkPercentile — see useStoreMetricsMap for
// why this is a map-returning hook rather than one hook call per store.
export function useBenchmarkPercentileMap(stores, allStores) {
  return useMemo(
    () => new Map(stores.map((store) => [store.code, getBenchmarkPercentile(store, allStores)])),
    [stores, allStores],
  );
}
