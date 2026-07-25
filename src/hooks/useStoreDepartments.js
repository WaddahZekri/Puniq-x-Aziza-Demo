import { useMemo } from 'react';
import { getStoreDepartments } from '../utils/metricsEngine';

// Thin wrapper around getStoreDepartments — single-store usage only.
export function useStoreDepartments(store) {
  return useMemo(() => getStoreDepartments(store), [store]);
}
