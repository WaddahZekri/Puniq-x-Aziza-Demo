import { useMemo } from 'react';
import { getBenchmarkPercentile } from '../utils/metricsEngine';

// Thin wrapper around getBenchmarkPercentile — single-store usage only. List
// consumers (e.g. a ranking table row per connected store) can't call a
// hook per iteration, so they use useBenchmarkPercentileMap instead.
export function useBenchmarkPercentile(store, allStores) {
  return useMemo(() => getBenchmarkPercentile(store, allStores), [store, allStores]);
}
