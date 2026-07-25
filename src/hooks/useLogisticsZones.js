import { useMemo } from 'react';
import { getLogisticsZones } from '../utils/metricsEngine';

// Thin wrapper around getLogisticsZones — single-store usage only.
export function useLogisticsZones(store) {
  return useMemo(() => getLogisticsZones(store), [store]);
}
