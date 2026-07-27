import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { generateInsightsForStore } from '../utils/insightEngine';
import { getTicketSavingsPctBump } from '../utils/metricsEngine';

const InsightsContext = createContext(null);

const APPLY_TO_MEASURE_MS = 1500;

export function InsightsProvider({ children }) {
  const [runtimeByStore, setRuntimeByStore] = useState({});
  const timersRef = useRef(new Set());

  // Merges the deterministic ticket templates with whatever runtime status
  // this session has recorded for them (open tickets have no runtime entry
  // at all, so a store nobody has touched yet costs nothing to read).
  const getInsightsForStore = useCallback(
    (store, discoveredDeviceIds) => {
      const templates = generateInsightsForStore(store, discoveredDeviceIds);
      const runtime = runtimeByStore[store.code] ?? {};
      return templates.map((insight) => ({ ...insight, ...(runtime[insight.id] ?? {}) }));
    },
    [runtimeByStore],
  );

  const applyInsight = useCallback((store, insightId) => {
    setRuntimeByStore((prev) => {
      const storeRuntime = prev[store.code] ?? {};
      return {
        ...prev,
        [store.code]: {
          ...storeRuntime,
          [insightId]: { status: 'applied', appliedAt: Date.now() },
        },
      };
    });

    const timer = setTimeout(() => {
      setRuntimeByStore((prev) => {
        const storeRuntime = prev[store.code] ?? {};
        return {
          ...prev,
          [store.code]: {
            ...storeRuntime,
            [insightId]: { ...storeRuntime[insightId], status: 'measured', measuredAt: Date.now() },
          },
        };
      });
      timersRef.current.delete(timer);
    }, APPLY_TO_MEASURE_MS);
    timersRef.current.add(timer);
  }, []);

  const dismissInsight = useCallback((store, insightId) => {
    setRuntimeByStore((prev) => {
      const storeRuntime = prev[store.code] ?? {};
      return {
        ...prev,
        [store.code]: {
          ...storeRuntime,
          [insightId]: { status: 'dismissed', dismissedAt: Date.now() },
        },
      };
    });
  }, []);

  // Marks a batch of this store's insight tickets as 'queued' — real,
  // deterministic findings that exist but aren't surfaced as open tickets
  // (not 'open', so they're excluded everywhere an 'open' filter is
  // applied: severity map, network ticket panel, notification bell, the
  // store's own Intelligence tab). Used by MapSimulationOverlay's
  // connect-time flagged-store cap to keep the network's flagged
  // proportion realistic instead of every connected store showing amber/
  // red from day one. Only touches ids with no existing runtime entry, so
  // it can never silently override a ticket already actioned.
  const queueInsights = useCallback((store, insightIds) => {
    setRuntimeByStore((prev) => {
      const storeRuntime = prev[store.code] ?? {};
      const nextRuntime = { ...storeRuntime };
      insightIds.forEach((id) => {
        if (!nextRuntime[id]) {
          nextRuntime[id] = { status: 'queued' };
        }
      });
      return { ...prev, [store.code]: nextRuntime };
    });
  }, []);

  // Aggregated effect of every ticket this store has had actioned this
  // session — MEASURED (fully applied and confirmed) controllable cards
  // layer their setpoint/lighting adjustment on top of the store's base
  // deterministic metrics and contribute their TND straight to "Économies
  // générées", exactly as before. DISMISSED advisory cards ("marked as
  // followed up") contribute a savings-% bump here too, but NOT TND — a
  // dismissed ticket's TND value flows into "Coûts évités" instead (see
  // IncidentsContext.recordResolvedTicket, called alongside dismissInsight
  // in StoreOverlayIntelligenceTab.jsx), so the same ticket's dollar value
  // is never counted in two different headline totals at once.
  const getStoreImpact = useCallback(
    (store, discoveredDeviceIds) => {
      const storeRuntime = runtimeByStore[store.code];
      const empty = {
        extraSavingsTND: 0,
        healthBonus: 0,
        totalPctImpact: 0,
        savingsPctBoost: 0,
        adjustmentsByDepartment: {},
        hasAppliedThisSession: false,
      };
      if (!storeRuntime) return empty;

      const measuredIds = Object.entries(storeRuntime)
        .filter(([, state]) => state.status === 'measured')
        .map(([id]) => id);
      const dismissedIds = Object.entries(storeRuntime)
        .filter(([, state]) => state.status === 'dismissed')
        .map(([id]) => id);
      const hasAppliedThisSession = Object.values(storeRuntime).some(
        (state) => state.status === 'applied' || state.status === 'measured',
      );
      if (measuredIds.length === 0 && dismissedIds.length === 0) return { ...empty, hasAppliedThisSession };

      const insights = generateInsightsForStore(store, discoveredDeviceIds);
      const measured = insights.filter((insight) => measuredIds.includes(insight.id));
      const dismissed = insights.filter((insight) => dismissedIds.includes(insight.id));

      const adjustmentsByDepartment = {};
      let extraSavingsTND = 0;
      let healthBonus = 0;
      let totalPctImpact = 0;
      let savingsPctBoost = 0;

      measured.forEach((insight) => {
        extraSavingsTND += insight.tndImpact ?? 0;
        totalPctImpact += insight.pctImpact ?? 0;
        healthBonus += insight.healthBonus ?? 0;
        savingsPctBoost += getTicketSavingsPctBump(insight.id);
        if (insight.adjustment) {
          const key = insight.adjustment.departmentId;
          const existing = adjustmentsByDepartment[key] ?? { setpointDeltaC: 0, lightingPctDelta: 0 };
          existing.setpointDeltaC += insight.adjustment.setpointDeltaC ?? 0;
          existing.lightingPctDelta += insight.adjustment.lightingPctDelta ?? 0;
          adjustmentsByDepartment[key] = existing;
        }
      });

      dismissed.forEach((insight) => {
        savingsPctBoost += getTicketSavingsPctBump(insight.id);
      });

      return { extraSavingsTND, healthBonus, totalPctImpact, savingsPctBoost, adjustmentsByDepartment, hasAppliedThisSession };
    },
    [runtimeByStore],
  );

  const value = { getInsightsForStore, applyInsight, dismissInsight, queueInsights, getStoreImpact };

  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

export function useInsights() {
  const context = useContext(InsightsContext);
  if (!context) {
    throw new Error('useInsights must be used within an InsightsProvider');
  }
  return context;
}
