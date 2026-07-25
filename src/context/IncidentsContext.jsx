import { createContext, useCallback, useContext, useState } from 'react';

const IncidentsContext = createContext(null);

// A single unified log for every resolved ticket that counts toward
// "Pannes évitées" / "Coûts évités" — P2/P3 fault resolutions (see
// FaultContext's 'refrigeration_drift'/'compressor_vibration' fault types)
// and actioned P1 advisory cards (see InsightsContext's dismissInsight).
// P1 controllable cards are NOT logged here — those already have their own
// TND flowing into "Économies générées" via InsightsContext's
// extraSavingsTND, so logging them here too would double-count the same
// ticket's dollar value across two different headline totals.
export function IncidentsProvider({ children }) {
  const [resolvedTicketLog, setResolvedTicketLog] = useState([]);
  const [totalCoutsEvitesTND, setTotalCoutsEvitesTND] = useState(0);

  // savingsPctBump travels with each log entry (not just the running TND
  // total) so a store's contribution to the network "économies générées"
  // percentage can be re-derived later from the log, the same way its TND
  // contribution already is. Ticket categories resolved via InsightsContext
  // (advisory dismissals) already get their bump tracked there instead, so
  // they're logged here with savingsPctBump left at its 0 default.
  const recordResolvedTicket = useCallback((storeCode, storeName, category, valueTND, savingsPctBump = 0) => {
    setResolvedTicketLog((prev) => [
      ...prev,
      { storeCode, storeName, category, valueTND, savingsPctBump, timestamp: Date.now() },
    ]);
    setTotalCoutsEvitesTND((prev) => prev + valueTND);
  }, []);

  const getStoreSavingsPctBoost = useCallback(
    (storeCode) =>
      resolvedTicketLog
        .filter((entry) => entry.storeCode === storeCode)
        .reduce((sum, entry) => sum + entry.savingsPctBump, 0),
    [resolvedTicketLog],
  );

  const value = {
    resolvedTicketLog,
    totalCoutsEvitesTND,
    recordResolvedTicket,
    getStoreSavingsPctBoost,
  };

  return <IncidentsContext.Provider value={value}>{children}</IncidentsContext.Provider>;
}

export function useIncidents() {
  const context = useContext(IncidentsContext);
  if (!context) {
    throw new Error('useIncidents must be used within an IncidentsProvider');
  }
  return context;
}
