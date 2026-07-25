import { useMemo } from 'react';
import { getStoreLeadQualification } from '../utils/metricsEngine';

// Thin wrapper around getStoreLeadQualification — single-store usage only.
export function useStoreLeadQualification(store) {
  return useMemo(() => getStoreLeadQualification(store), [store]);
}
