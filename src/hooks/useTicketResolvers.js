import { useCallback } from 'react';
import { useFault } from '../context/FaultContext';
import { useIncidents } from '../context/IncidentsContext';
import { useInsights } from '../context/InsightsContext';
import { getTicketCostAvoidedTND, getTicketSavingsPctBump } from '../utils/metricsEngine';
import { getStoreShortName } from '../utils/format';
import { FAULT_RESOLUTION_CONFIG } from '../utils/severity';

// Single source of truth for "what happens when a ticket is resolved" —
// used by both the manual Intelligence-tab UI (StoreOverlayIntelligenceTab)
// and MapSimulationOverlay's auto-resolution timer, so the two paths can
// never compute a ticket's TND/pct effect differently. Each resolver
// returns the {category, valueTND} it actually recorded, so a caller that
// needs to report the action (e.g. the auto-resolver's flux d'activité
// entry) reads the real recorded value instead of recomputing it.
export function useTicketResolvers() {
  const { resolveFault } = useFault();
  const { recordResolvedTicket } = useIncidents();
  const { dismissInsight } = useInsights();

  const resolveFaultTicket = useCallback(
    (store, fault) => {
      const config = FAULT_RESOLUTION_CONFIG[fault.type] ?? FAULT_RESOLUTION_CONFIG.compressor_vibration;
      const seed = `${config.seedPrefix}${store.code}-${fault.id}`;
      const valueTND = getTicketCostAvoidedTND(config.category, seed);
      recordResolvedTicket(
        store.code,
        getStoreShortName(store),
        config.category,
        valueTND,
        getTicketSavingsPctBump(seed),
      );
      resolveFault(store.code, fault.id);
      return { category: config.category, valueTND };
    },
    [resolveFault, recordResolvedTicket],
  );

  // A dismissed P1 advisory card ("marqué comme suivi") counts as a
  // resolved ticket too — its cost-avoided value flows into "Coûts
  // évités" here; its savings-% bump is tracked separately via
  // InsightsContext (see getStoreImpact), so it isn't passed through here.
  const resolveAdvisoryTicket = useCallback(
    (store, insight) => {
      const valueTND = getTicketCostAvoidedTND(insight.category, insight.id);
      dismissInsight(store, insight.id);
      recordResolvedTicket(store.code, getStoreShortName(store), insight.category, valueTND);
      return { category: insight.category, valueTND };
    },
    [dismissInsight, recordResolvedTicket],
  );

  // Every store's real advisory/fault tickets are a small, finite, one-time
  // set — once resolved they don't regenerate. This lets the Auto engine
  // keep going indefinitely once that real pool runs dry, by recording a
  // fresh ongoing-operations event straight into the log (no real
  // insight/fault object to dismiss/resolve, since none exists) — same
  // TND/pct math as a real ticket, just driven by a caller-supplied unique
  // seed instead of a real ticket id.
  const resolveSyntheticTicket = useCallback(
    (store, category, seed) => {
      const valueTND = getTicketCostAvoidedTND(category, seed);
      recordResolvedTicket(store.code, getStoreShortName(store), category, valueTND, getTicketSavingsPctBump(seed));
      return { category, valueTND };
    },
    [recordResolvedTicket],
  );

  return { resolveFaultTicket, resolveAdvisoryTicket, resolveSyntheticTicket };
}
