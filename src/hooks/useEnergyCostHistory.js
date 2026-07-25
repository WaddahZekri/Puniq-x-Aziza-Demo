import { useMemo } from 'react';
import { getEnergyCostHistory } from '../utils/metricsEngine';

// Thin wrapper around getEnergyCostHistory — single-store usage only.
export function useEnergyCostHistory(store, isConnected, appliedAdjustmentPct = 0) {
  return useMemo(
    () => getEnergyCostHistory(store, isConnected, appliedAdjustmentPct),
    [store, isConnected, appliedAdjustmentPct],
  );
}
