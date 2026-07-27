import { useEffect, useRef, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useDevices } from '../context/DevicesContext';
import { useInsights } from '../context/InsightsContext';
import { useFault } from '../context/FaultContext';
import { useActivityFeed } from '../context/ActivityFeedContext';
import { useSimulationTime } from '../context/SimulationTimeContext';
import { useTicketResolvers } from '../hooks/useTicketResolvers';
import { formatNumberFR, getStoreLabel } from '../utils/format';
import { AUTO_ADVANCE_MONTH_CEILING_INDEX, getSimulatedPeriod } from '../utils/simulationTime';
import { getStoreDepartments } from '../utils/metricsEngine';
import './MapSimulationOverlay.css';

// Staggered, not metronomic — same "organic" pacing idea as the ambient
// flux d'activité ticker — so tickets resolve across the network at
// irregular moments rather than in one scripted burst.
const AUTO_RESOLUTION_MIN_DELAY_MS = 800;
const AUTO_RESOLUTION_MAX_DELAY_MS = 1200;

// Independent of ticket resolution — a month passes on its own wall-clock
// cadence so it can never stall waiting on a thin ticket pool (early
// months, with few stores connected, may not have 8-15 tickets available
// at all). Capped at AUTO_ADVANCE_MONTH_CEILING_INDEX so a long-running
// session can't drift into implausible years.
const AUTO_MONTH_MIN_DELAY_MS = 8000;
const AUTO_MONTH_MAX_DELAY_MS = 12000;

// Fixed monthly ticket-resolution budget, independent of how many stores
// are connected — as the network grows this same budget spreads across a
// wider pool (broader coverage) instead of compounding into bigger totals.
// Re-rolled at every month transition so the cadence doesn't feel robotic.
const MONTHLY_TICKET_CAP_MIN = 8;
const MONTHLY_TICKET_CAP_MAX = 15;

// New stores onboard in a batch at every month transition (Mois 1 stays
// pilot-only — growth starts at the Mois 1 → Mois 2 transition) rather
// than all connecting in one instant burst. FULL_STORE_COVERAGE_MONTH_INDEX
// is a backstop: whatever hasn't connected by then joins in one final
// batch, guaranteeing full 89/89 coverage by Mois 12 regardless of how the
// random monthly batch sizes happened to land.
const MONTHLY_STORE_GROWTH_MIN = 7;
const MONTHLY_STORE_GROWTH_MAX = 11;
const FULL_STORE_COVERAGE_MONTH_INDEX = 11;

function randomInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const CATEGORY_LABELS = {
  stock_loss: 'perte de stock évitée',
  technician_callout: 'visite technicien évitée',
  downtime: 'arrêt évité',
  energy_waste: 'gaspillage énergétique évité',
};
const TICKET_CATEGORIES = Object.keys(CATEGORY_LABELS);

// New tickets appear gradually rather than all resolution activity being
// against tickets that already existed on day one — every 6-10s, one
// candidate new ticket is considered (subject to the flagged-store cap
// below), so a network-wide "few per month" pace emerges naturally rather
// than a scripted burst.
const TICKET_GENERATION_MIN_DELAY_MS = 6000;
const TICKET_GENERATION_MAX_DELAY_MS = 10000;

// The one enforced cap on the network's overall flagged (amber/red)
// proportion — covers BOTH live incidents (Faults, this file) AND real
// audit findings (Insights, InsightsContext/insightEngine.js) together, so
// neither layer can push the network past a realistic look on its own. A
// newly-connected store that doesn't win the cap's headroom (see the
// connect-time effect below) has its real insight tickets queued (held
// back, not counted anywhere — see InsightsContext.queueInsights) rather
// than shown open. Faults stay the ongoing, renewable mechanism that keeps
// re-flagging and resolving stores for as long as the simulation runs, so
// the mix never permanently drains to all-blue even once every store's
// one-time insight pool has been resolved.
const FLAGGED_STORE_CAP_PCT_MIN = 0.1;
const FLAGGED_STORE_CAP_PCT_MAX = 0.2;

// A new ticket is usually routine (amber) — only occasionally urgent
// (red), and only rarely does an already-routine store additionally
// escalate to urgent, matching "blue → amber" being the common case and
// "→ red" the exception.
const NEW_TICKET_URGENT_PROBABILITY = 0.25;
const ESCALATION_PROBABILITY = 0.15;
const FAULT_TYPES = ['refrigeration_drift', 'compressor_vibration'];

// From this month index onward (Mois 2), the network must visibly contain
// at least one urgent and one routine ticket — a hard floor on top of the
// probabilistic cap-fill below, so the severity system, urgent alert card,
// notification bell, and cluster-exclusion behavior are demonstrable early
// regardless of how the random rolls happened to land.
const GUARANTEE_MONTH_INDEX = 1;
const GUARANTEE_MIN_URGENT = 1;
const GUARANTEE_MIN_ROUTINE = 1;

// Mirrors exactly what the Dashboard tab's manual 🔧/⚙ buttons already pass
// as fault meta (departmentLabel/unitName/unitId from a real refrigerated
// department+unit) — reuses getStoreDepartments directly (the same pure
// function useStoreDepartments wraps) so a generated fault looks
// identical to a manually-triggered one. Returns null if this store has no
// refrigerated department to draw a plausible unit from.
function getRandomFaultUnit(store) {
  const eligible = getStoreDepartments(store).filter((dept) => dept.units.length > 0);
  if (eligible.length === 0) return null;
  const dept = eligible[Math.floor(Math.random() * eligible.length)];
  const unit = dept.units[Math.floor(Math.random() * dept.units.length)];
  return { departmentLabel: dept.label, unitName: unit.name, unitId: unit.unitId };
}

// A store counts as "flagged" against the shared cap if it has either an
// active live fault OR at least one real, open, severity-affecting
// (Urgent/Recommandé) insight ticket — Informationnel insights never flag
// a store (see useStoreSeverityMap), and a 'queued' insight isn't 'open'
// at all, so it doesn't count either. Takes getDeviceState/getInsightsForStore
// as params (rather than reading context directly) so it can be called
// from inside the effects below using latestRef's always-current values.
function hasOpenSeverityInsight(store, getDeviceState, getInsightsForStore) {
  const discoveredIds = getDeviceState(store).discoveredIds;
  return getInsightsForStore(store, discoveredIds).some(
    (insight) => insight.status === 'open' && insight.priority !== 'Informationnel',
  );
}

// Demo-only tooling for driving the store-connection simulation, and (in
// Auto mode) the ticket-resolution simulation too — floats over the map
// instead of living in the fixed sidebar, so it visually reads as tooling
// sitting on top of the product rather than part of the core interface.
// Deliberately self-contained (reads every context it needs directly, no
// props from MapScreen) so it can be deleted later without touching
// OverviewPanel or any other permanent UI. The connected-count text this
// used to sit above stays behind in the sidebar (see ConnectionProgress.jsx)
// — this component owns the mode toggle, the action button(s), the
// simulated-period readout, the background ticket-auto-resolution timer
// (with its monthly cap), the ticket-generation timer (with its
// flagged-store cap), the simulated-month advance (button in Manuel, its
// own timer in Auto), and the monthly store-growth batch.
function MapSimulationOverlay() {
  const { allStores, connectedCodes, simulationMode, setSimulationMode, connectNextStore, connectStoreBatch } =
    useNetwork();
  const { getDeviceState } = useDevices();
  const { getInsightsForStore, queueInsights, applyInsight } = useInsights();
  const { activeFaults, triggerFault } = useFault();
  const { addFeedItem } = useActivityFeed();
  const { currentMonthIndex, advanceMonth } = useSimulationTime();
  const { resolveFaultTicket, resolveAdvisoryTicket, resolveSyntheticTicket } = useTicketResolvers();

  // Every store's real advisory/fault tickets are a small, finite, one-time
  // set (see useTicketResolvers' own comment) — once every connected store's
  // pool is exhausted, this counter feeds resolveSyntheticTicket a fresh,
  // never-repeating seed per event, so ongoing-operations activity (and the
  // totals it drives) keeps accumulating indefinitely instead of plateauing.
  const syntheticTicketCounterRef = useRef(0);

  // Tracks which connected stores have already had their one-time
  // insight-queue decision made (see the connect-time effect below) — a
  // Set, not a boolean flag, so it persists independently and never
  // re-decides a store that's already been through it.
  const insightDecisionMadeRef = useRef(new Set());

  // Own, persistent "is the Auto engine actually running" flag. Not tied to
  // any store-connect sub-state, so it can't be silently reset by a
  // side-effect elsewhere — the button reflects and controls exactly this,
  // start to stop.
  const [isAutoRunning, setIsAutoRunning] = useState(false);

  // Always holds the LATEST values without the timer effect needing to
  // tear down and reschedule whenever any of them change — same
  // stable-cadence pattern as the ambient ticker in useLiveEventFeed.js.
  const latestRef = useRef({});
  latestRef.current = { allStores, connectedCodes, getDeviceState, getInsightsForStore, activeFaults, currentMonthIndex };

  // Resets every month: how many tickets have resolved this month, and this
  // month's cap (re-rolled within 8-15 each transition).
  const monthlyQuotaRef = useRef({ resolvedThisMonth: 0, cap: randomInRange(MONTHLY_TICKET_CAP_MIN, MONTHLY_TICKET_CAP_MAX) });
  useEffect(() => {
    monthlyQuotaRef.current = { resolvedThisMonth: 0, cap: randomInRange(MONTHLY_TICKET_CAP_MIN, MONTHLY_TICKET_CAP_MAX) };
  }, [currentMonthIndex]);

  // Connects a fresh batch of stores at every month transition — mirrors
  // real onboarding (growth happens once a month, not all at once) and
  // applies whether the transition came from Auto's own timer or a Manuel
  // "Mois suivant" click, since both change the same currentMonthIndex this
  // effect watches. Mois 1 (index 0) stays pilot-only.
  useEffect(() => {
    if (currentMonthIndex === 0) return;
    const remaining = allStores.length - latestRef.current.connectedCodes.length;
    if (remaining <= 0) return;
    const batchSize =
      currentMonthIndex >= FULL_STORE_COVERAGE_MONTH_INDEX
        ? remaining
        : Math.min(remaining, randomInRange(MONTHLY_STORE_GROWTH_MIN, MONTHLY_STORE_GROWTH_MAX));
    connectStoreBatch(batchSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthIndex]);

  // Seeds tickets the moment stores connect, independent of Manuel/Auto and
  // independent of the Auto-only wall-clock generation timer further below.
  // Without this, a Manuel-mode session that only ever clicks "Mois
  // suivant"/"Magasin suivant" never runs that timer at all — stores
  // connect but never receive a single ticket, which is exactly the "12
  // connected, still 0 pannes évitées" bug this fixes. Fires on every
  // connection-count or month change, in both modes.
  useEffect(() => {
    const {
      allStores: stores,
      connectedCodes: connected,
      activeFaults: faults,
      currentMonthIndex: monthIndex,
      getDeviceState: deviceState,
      getInsightsForStore: insightsForStore,
    } = latestRef.current;
    const connectedStores = stores.filter((store) => connected.includes(store.code));
    if (connectedStores.length === 0) return;

    // Local working copy of fault state so consecutive triggers within this
    // one pass see each other's effects immediately, without waiting on
    // React's async state update from triggerFault to land first.
    const faultsByCode = new Map(connectedStores.map((store) => [store.code, faults[store.code] || []]));
    const isHealthy = (code) => (faultsByCode.get(code)?.length || 0) === 0;
    const hasUrgent = (code) => faultsByCode.get(code)?.some((fault) => fault.severity === 'urgent');
    const hasOpenInsight = (store) => hasOpenSeverityInsight(store, deviceState, insightsForStore);

    const fireFault = (store, severity) => {
      const target = getRandomFaultUnit(store);
      if (!target) return false;
      const type = FAULT_TYPES[Math.floor(Math.random() * FAULT_TYPES.length)];
      triggerFault(store.code, type, { ...target, severity });
      faultsByCode.set(store.code, [...(faultsByCode.get(store.code) || []), { severity }]);
      return true;
    };

    const capCount = Math.max(
      1,
      Math.ceil(
        connectedStores.length *
          (FLAGGED_STORE_CAP_PCT_MIN + Math.random() * (FLAGGED_STORE_CAP_PCT_MAX - FLAGGED_STORE_CAP_PCT_MIN)),
      ),
    );

    // 0) One-time, per newly-connected store: decide whether its real
    //    insight findings get to show as open tickets right away, or get
    //    queued (held back, not counted anywhere — see queueInsights).
    //    Runs before the fault cap-fill below so both layers draw from the
    //    same running flaggedCount and can never combine past capCount.
    //
    //    The starting flaggedCount only counts stores whose flagged status
    //    is ALREADY settled — active faults (dynamic, always accurate) and
    //    stores whose insight-queue decision was already made in an earlier
    //    pass. A not-yet-decided store's insights default to 'open' before
    //    any decision runs, so counting them here too would double-count
    //    every undecided store as already flagged before the loop below
    //    even gets to choose — starting the pool artificially full and
    //    queuing every single store, including the one meant to stay open.
    let flaggedCount = connectedStores.filter(
      (store) => !isHealthy(store.code) || (insightDecisionMadeRef.current.has(store.code) && hasOpenInsight(store)),
    ).length;

    connectedStores.forEach((store) => {
      if (insightDecisionMadeRef.current.has(store.code)) return;
      insightDecisionMadeRef.current.add(store.code);

      const discoveredIds = deviceState(store).discoveredIds;
      const openSeverityInsights = insightsForStore(store, discoveredIds).filter(
        (insight) => insight.status === 'open' && insight.priority !== 'Informationnel',
      );
      if (openSeverityInsights.length === 0) return;

      if (flaggedCount < capCount) {
        flaggedCount += 1;
      } else {
        queueInsights(
          store,
          openSeverityInsights.map((insight) => insight.id),
        );
      }
    });

    // 1) Fill any remaining cap headroom with fresh live faults on stores
    //    still genuinely healthy (no fault, no open insight ticket either)
    //    — the same target the periodic Auto timer pursues, now actually
    //    reached as soon as stores connect rather than only while Auto is
    //    running and has had time to tick.
    const healthyPool = connectedStores.filter((store) => isHealthy(store.code) && !hasOpenInsight(store));

    while (flaggedCount < capCount && healthyPool.length > 0) {
      const [store] = healthyPool.splice(Math.floor(Math.random() * healthyPool.length), 1);
      const severity = Math.random() < NEW_TICKET_URGENT_PROBABILITY ? 'urgent' : 'routine';
      if (fireFault(store, severity)) flaggedCount += 1;
    }

    // 2) Hard minimum guarantee, from Mois 2 onward — at least one urgent
    //    and one routine ticket must exist somewhere on the map regardless
    //    of how the probabilistic cap-fill above happened to land.
    if (monthIndex >= GUARANTEE_MONTH_INDEX) {
      const isFlaggedNow = (store) => !isHealthy(store.code) || hasOpenInsight(store);
      let missingUrgent = connectedStores.some((store) => hasUrgent(store.code)) ? 0 : GUARANTEE_MIN_URGENT;
      let missingRoutine =
        connectedStores.filter((store) => isFlaggedNow(store) && !hasUrgent(store.code)).length >=
        GUARANTEE_MIN_ROUTINE
          ? 0
          : GUARANTEE_MIN_ROUTINE;

      while (missingUrgent > 0 && healthyPool.length > 0) {
        const [store] = healthyPool.splice(Math.floor(Math.random() * healthyPool.length), 1);
        if (fireFault(store, 'urgent')) missingUrgent -= 1;
      }
      while (missingRoutine > 0 && healthyPool.length > 0) {
        const [store] = healthyPool.splice(Math.floor(Math.random() * healthyPool.length), 1);
        if (fireFault(store, 'routine')) missingRoutine -= 1;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedCodes.length, currentMonthIndex]);

  // Auto-resolves one random pending ticket — a P2/P3 fault currently
  // active, or a P1 advisory card still open — at a random connected
  // store, every 0.8-1.2s, up to this month's fixed quota (see
  // monthlyQuotaRef above) regardless of how many stores are connected —
  // growth in network size spreads this same budget across a wider pool
  // instead of compounding totals. Gated on simulationMode + isAutoRunning;
  // switching to Manuel, or clicking "Arrêter la simulation", both stop
  // this via the effect cleanup below — cleanly, without resetting
  // anything already accumulated in IncidentsContext/InsightsContext.
  useEffect(() => {
    if (simulationMode !== 'auto' || !isAutoRunning) return undefined;

    let timer;

    const scheduleNext = () => {
      const delay =
        AUTO_RESOLUTION_MIN_DELAY_MS + Math.random() * (AUTO_RESOLUTION_MAX_DELAY_MS - AUTO_RESOLUTION_MIN_DELAY_MS);
      timer = setTimeout(() => {
        const quota = monthlyQuotaRef.current;
        if (quota.resolvedThisMonth < quota.cap) {
          const {
            allStores: stores,
            connectedCodes: connected,
            getDeviceState: deviceState,
            getInsightsForStore: insightsForStore,
            activeFaults: faults,
          } = latestRef.current;
          const connectedStores = stores.filter((store) => connected.includes(store.code));

          const pool = [];
          connectedStores.forEach((store) => {
            const discoveredIds = deviceState(store).discoveredIds;
            insightsForStore(store, discoveredIds)
              .filter((insight) => insight.status === 'open')
              .forEach((insight) =>
                pool.push({ store, kind: insight.controllable ? 'controllable' : 'advisory', insight }),
              );
            (faults[store.code] || []).forEach((fault) => pool.push({ store, kind: 'fault', fault }));
          });

          let resolved = null;
          if (pool.length > 0) {
            const picked = pool[Math.floor(Math.random() * pool.length)];
            if (picked.kind === 'fault') {
              resolved = { store: picked.store, ...resolveFaultTicket(picked.store, picked.fault) };
            } else if (picked.kind === 'controllable') {
              // applyInsight (unlike the useTicketResolvers functions) has no
              // return value — its TND/category are already on the ticket
              // itself (the same figures the Intelligence tab already shows
              // for it), so the feed message below reads them directly.
              applyInsight(picked.store, picked.insight.id);
              resolved = {
                store: picked.store,
                category: picked.insight.category,
                valueTND: picked.insight.tndImpact ?? 0,
              };
            } else {
              resolved = { store: picked.store, ...resolveAdvisoryTicket(picked.store, picked.insight) };
            }
          } else if (connectedStores.length > 0) {
            // Real pool exhausted — keep the network "alive" with a
            // synthetic ongoing-operations event instead of going silent.
            const store = connectedStores[Math.floor(Math.random() * connectedStores.length)];
            const category = TICKET_CATEGORIES[Math.floor(Math.random() * TICKET_CATEGORIES.length)];
            syntheticTicketCounterRef.current += 1;
            const seed = `synthetic-${store.code}-${syntheticTicketCounterRef.current}`;
            resolved = { store, ...resolveSyntheticTicket(store, category, seed) };
          }

          if (resolved) {
            const categoryLabel = CATEGORY_LABELS[resolved.category] ?? 'coût évité';
            addFeedItem(
              getStoreLabel(resolved.store),
              `Panne résolue automatiquement — ${formatNumberFR(resolved.valueTND)} TND (${categoryLabel})`,
            );
            quota.resolvedThisMonth += 1;
          }
        }

        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationMode, isAutoRunning]);

  // Generates new tickets over time — the counterpart to the resolution
  // timer above. Each tick either escalates one already-routine store to
  // urgent (small probability, among stores already counted against the
  // cap — doesn't raise the flagged-store count) or, if the network is
  // currently under its flagged-store cap, gives one healthy (no active
  // fault) store a fresh routine/urgent ticket. Reuses the exact same
  // triggerFault path the Dashboard's manual buttons use, so generated
  // tickets resolve, display, and count identically to manual ones.
  useEffect(() => {
    if (simulationMode !== 'auto' || !isAutoRunning) return undefined;

    let timer;

    const scheduleNext = () => {
      const delay =
        TICKET_GENERATION_MIN_DELAY_MS +
        Math.random() * (TICKET_GENERATION_MAX_DELAY_MS - TICKET_GENERATION_MIN_DELAY_MS);
      timer = setTimeout(() => {
        const {
          allStores: stores,
          connectedCodes: connected,
          activeFaults: faults,
          getDeviceState: deviceState,
          getInsightsForStore: insightsForStore,
        } = latestRef.current;
        const connectedStores = stores.filter((store) => connected.includes(store.code));

        if (connectedStores.length > 0) {
          const hasUrgentFault = (code) => faults[code]?.some((fault) => fault.severity === 'urgent');
          const isFlagged = (store) =>
            (faults[store.code]?.length ?? 0) > 0 || hasOpenSeverityInsight(store, deviceState, insightsForStore);

          // Routine (amber, not urgent) stores — whether flagged by a live
          // fault or a real insight finding — are equally eligible to
          // escalate to a fresh urgent fault, so an insight-driven amber
          // store can turn red too, not only a fault-driven one.
          const routineOnlyStores = connectedStores.filter(
            (store) => isFlagged(store) && !hasUrgentFault(store.code),
          );

          if (routineOnlyStores.length > 0 && Math.random() < ESCALATION_PROBABILITY) {
            const store = routineOnlyStores[Math.floor(Math.random() * routineOnlyStores.length)];
            const target = getRandomFaultUnit(store);
            if (target) {
              const type = FAULT_TYPES[Math.floor(Math.random() * FAULT_TYPES.length)];
              triggerFault(store.code, type, { ...target, severity: 'urgent' });
            }
          } else {
            const healthyStores = connectedStores.filter((store) => !isFlagged(store));
            const capCount = Math.max(
              1,
              Math.round(
                connectedStores.length *
                  (FLAGGED_STORE_CAP_PCT_MIN + Math.random() * (FLAGGED_STORE_CAP_PCT_MAX - FLAGGED_STORE_CAP_PCT_MIN)),
              ),
            );
            const flaggedCount = connectedStores.length - healthyStores.length;

            if (flaggedCount < capCount && healthyStores.length > 0) {
              const store = healthyStores[Math.floor(Math.random() * healthyStores.length)];
              const target = getRandomFaultUnit(store);
              if (target) {
                const type = FAULT_TYPES[Math.floor(Math.random() * FAULT_TYPES.length)];
                const severity = Math.random() < NEW_TICKET_URGENT_PROBABILITY ? 'urgent' : 'routine';
                triggerFault(store.code, type, { ...target, severity });
              }
            }
          }
        }

        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationMode, isAutoRunning]);

  // Advances the simulated month on its own wall-clock cadence while Auto
  // is running — independent of ticket resolution so it can't stall on a
  // thin early-month pool. Capped so a long-running session can't drift
  // past a plausible number of years.
  useEffect(() => {
    if (simulationMode !== 'auto' || !isAutoRunning) return undefined;

    let timer;

    const scheduleNext = () => {
      const delay = AUTO_MONTH_MIN_DELAY_MS + Math.random() * (AUTO_MONTH_MAX_DELAY_MS - AUTO_MONTH_MIN_DELAY_MS);
      timer = setTimeout(() => {
        if (latestRef.current.currentMonthIndex < AUTO_ADVANCE_MONTH_CEILING_INDEX) {
          advanceMonth();
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationMode, isAutoRunning]);

  const isComplete = connectedCodes.length >= allStores.length;
  const { monthNumber, label: periodLabel } = getSimulatedPeriod(currentMonthIndex);

  return (
    <div className="map-sim-overlay">
      <div className="map-sim-overlay__period">
        <span className="map-sim-overlay__period-badge">Mois {monthNumber}</span>
        <span className="map-sim-overlay__period-label">{periodLabel}</span>
      </div>

      <div className="map-sim-overlay__mode" role="group" aria-label="Mode de simulation">
        <button
          type="button"
          className={`map-sim-overlay__mode-btn ${simulationMode === 'manual' ? 'is-active' : ''}`}
          onClick={() => setSimulationMode('manual')}
        >
          Manuel
        </button>
        <button
          type="button"
          className={`map-sim-overlay__mode-btn ${simulationMode === 'auto' ? 'is-active' : ''}`}
          onClick={() => setSimulationMode('auto')}
        >
          Auto
        </button>
      </div>

      {simulationMode === 'manual' ? (
        <>
          {isComplete ? (
            <p className="map-sim-overlay__complete">Réseau connecté</p>
          ) : (
            <button type="button" className="map-sim-overlay__action" onClick={connectNextStore}>
              Magasin suivant →
            </button>
          )}
          <button
            type="button"
            className="map-sim-overlay__action map-sim-overlay__action--month"
            onClick={advanceMonth}
          >
            Mois suivant →
          </button>
        </>
      ) : (
        <button
          type="button"
          className={`map-sim-overlay__action map-sim-overlay__action--auto ${
            isAutoRunning ? 'map-sim-overlay__action--running' : ''
          }`}
          onClick={() => setIsAutoRunning((prev) => !prev)}
        >
          <span className="map-sim-overlay__icon" aria-hidden="true">
            {isAutoRunning ? '⏸' : '▶'}
          </span>
          {isAutoRunning ? 'Arrêter la simulation' : 'Démarrer la simulation'}
        </button>
      )}
    </div>
  );
}

export default MapSimulationOverlay;
