import { useMemo } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useDevices } from '../context/DevicesContext';
import { useInsights } from '../context/InsightsContext';
import { useFault } from '../context/FaultContext';
import { PRIORITY_RANK } from '../utils/insightEngine';
import { FAULT_RESOLUTION_CONFIG, getFaultTicketCopy } from '../utils/severity';
import { getTicketCostAvoidedTND } from '../utils/metricsEngine';

// Single source of truth for "every open ticket across every connected
// store, sorted Urgent-first then by impact" — merges BOTH ticket sources
// the app can produce into one normalized list:
//  - Insight tickets (InsightsContext) — deterministic advisory/
//    controllable cards, priority Urgent/Recommandé/Informationnel.
//  - Fault tickets (FaultContext) — live simulated incidents from the
//    Dashboard's "Simuler une panne" buttons / Auto-mode engine, severity
//    urgent/routine mapped to the same Urgent/Recommandé priority language.
// Shared by the Tickets Prioritaires tab (full list + counts), the Vue
// d'ensemble tab's critical-tickets preview, and — via useStoreSeverityMap,
// which is itself built from this same merged list — every place that
// colors a store urgent/routine/none (map markers, sidebar dot), so none of
// them can ever disagree about which stores are flagged or by how much.
export function useNetworkTickets() {
  const { allStores, connectedCodes } = useNetwork();
  const { getDeviceState } = useDevices();
  const { getInsightsForStore } = useInsights();
  const { activeFaults } = useFault();

  return useMemo(() => {
    const tickets = [];
    connectedCodes.forEach((code) => {
      const store = allStores.find((s) => s.code === code);
      if (!store) return;

      const insights = getInsightsForStore(store, getDeviceState(store).discoveredIds);
      insights
        .filter((insight) => insight.status === 'open')
        .forEach((insight) => tickets.push({ ...insight, store }));

      (activeFaults[code] || []).forEach((fault) => {
        const { title, description } = getFaultTicketCopy(fault);
        const config = FAULT_RESOLUTION_CONFIG[fault.type] ?? FAULT_RESOLUTION_CONFIG.compressor_vibration;
        const seed = `${config.seedPrefix}${store.code}-${fault.id}`;
        tickets.push({
          id: `fault-${fault.id}`,
          kind: 'fault',
          fault,
          store,
          priority: fault.severity === 'routine' ? 'Recommandé' : 'Urgent',
          category: config.category,
          title,
          estimatedImpact: description,
          impactMagnitudeTND: getTicketCostAvoidedTND(config.category, seed),
          timestamp: fault.triggeredAt,
        });
      });
    });
    return tickets.sort((a, b) => {
      const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.impactMagnitudeTND - a.impactMagnitudeTND;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStores, connectedCodes, getInsightsForStore, getDeviceState, activeFaults]);
}
