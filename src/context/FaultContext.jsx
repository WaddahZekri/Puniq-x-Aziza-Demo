import { createContext, useCallback, useContext, useState } from 'react';
import { getSeverityFromFaults } from '../utils/severity';

const FaultContext = createContext(null);

export function FaultProvider({ children }) {
  const [activeFaults, setActiveFaults] = useState({});

  const triggerFault = useCallback((storeCode, faultType, meta = {}) => {
    const fault = {
      id: crypto.randomUUID(),
      type: faultType,
      triggeredAt: Date.now(),
      ...meta,
    };
    setActiveFaults((prev) => ({
      ...prev,
      [storeCode]: [...(prev[storeCode] || []), fault],
    }));
    return fault.id;
  }, []);

  const resolveFault = useCallback((storeCode, faultId) => {
    setActiveFaults((prev) => {
      const faults = prev[storeCode];
      if (!faults) return prev;

      const remaining = faults.filter((fault) => fault.id !== faultId);
      const next = { ...prev };
      if (remaining.length > 0) {
        next[storeCode] = remaining;
      } else {
        delete next[storeCode];
      }
      return next;
    });
  }, []);

  // Single source of truth for a store's 3-tier severity (none/routine/
  // urgent) — the map, sidebar list, store overview alert, and
  // notification bell all call this instead of each re-deriving it, so
  // they can never disagree.
  const getSeverity = useCallback(
    (storeCode) => getSeverityFromFaults(activeFaults[storeCode]),
    [activeFaults],
  );

  const value = { activeFaults, triggerFault, resolveFault, getSeverity };

  return <FaultContext.Provider value={value}>{children}</FaultContext.Provider>;
}

export function useFault() {
  const context = useContext(FaultContext);
  if (!context) {
    throw new Error('useFault must be used within a FaultProvider');
  }
  return context;
}
