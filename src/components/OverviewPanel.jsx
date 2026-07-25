import { useEffect, useMemo } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useIncidents } from '../context/IncidentsContext';
import { useDevices } from '../context/DevicesContext';
import { useInsights } from '../context/InsightsContext';
import { useActivityFeed } from '../context/ActivityFeedContext';
import { useSimulationTime } from '../context/SimulationTimeContext';
import { useCountUp } from '../hooks/useCountUp';
import { useFlashOnChange } from '../hooks/useFlashOnChange';
import { useLiveEventFeed } from '../hooks/useLiveEventFeed';
import { useTickingCounter } from '../hooks/useTickingCounter';
import { useTicker } from '../hooks/useTicker';
import {
  getEffectiveSavingsPct,
  getMetricTrend,
  getNetworkAggregate,
  getNetworkDataPointsBaseline,
  getRegionalBreakdown,
} from '../utils/metricsEngine';
import { formatNumberFR } from '../utils/format';
import HealthGauge from './HealthGauge';
import RegionalBreakdownChart from './RegionalBreakdownChart';
import LiveEventFeed from './LiveEventFeed';
import ConnectionProgress from './ConnectionProgress';
import MetricSparkline from './MetricSparkline';
import './OverviewPanel.css';

function TrendTag({ trend }) {
  const isUp = trend.direction === 'up';
  return (
    <span className={`overview-panel__trend ${isUp ? 'is-up' : 'is-down'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(trend.deltaPct)}% vs 7j
    </span>
  );
}

function OverviewPanel() {
  const { allStores, connectedCodes, connectedAt } = useNetwork();
  const { resolvedTicketLog, totalCoutsEvitesTND, getStoreSavingsPctBoost } = useIncidents();
  const { getDeviceState } = useDevices();
  const { getStoreImpact } = useInsights();
  const { currentMonthIndex, monthlyHistory, recordSnapshot } = useSimulationTime();
  const connectedStores = useMemo(
    () => allStores.filter((store) => connectedCodes.includes(store.code)),
    [allStores, connectedCodes],
  );
  const dataPoints = useTickingCounter(getNetworkDataPointsBaseline(connectedStores), connectedCodes.length);
  const { items: feedItems } = useActivityFeed();
  useLiveEventFeed(connectedCodes, allStores);
  const isFlashing = useFlashOnChange(connectedCodes.length);
  const connectedDisplay = useCountUp(connectedCodes.length);

  // Health scores ramp off elapsed session time, so this needs to
  // recompute periodically even when connectedCodes itself hasn't changed.
  const tick = useTicker(800);

  // Layers every connected store's applied-insight impact on top of its
  // base metrics, so the network-wide total stays consistent with what
  // each store's own Overview tab shows.
  const impactByStoreCode = useMemo(() => {
    const map = {};
    connectedCodes.forEach((code) => {
      const store = allStores.find((s) => s.code === code);
      if (!store) return;
      map[code] = getStoreImpact(store, getDeviceState(store).discoveredIds);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStores, connectedCodes, getStoreImpact, getDeviceState, tick]);

  const aggregate = useMemo(
    () => getNetworkAggregate(allStores, connectedCodes, connectedAt, impactByStoreCode),
    [allStores, connectedCodes, connectedAt, impactByStoreCode, tick],
  );
  const regionalData = useMemo(
    () => getRegionalBreakdown(allStores, connectedCodes, connectedAt),
    [allStores, connectedCodes, connectedAt, tick],
  );
  // "Économies générées" is a genuine aggregate (simple average) of each
  // connected store's own individual savings %, not a flat network number
  // — each store's effective % is its deterministic base plus whatever
  // ticket-resolution boost it's earned this session (P1 controllable
  // apply/measured, P1 advisory dismissed, or a P2/P3 fault resolved),
  // capped at SAVINGS_PCT_CEILING. Resolving a ticket at one store visibly
  // pulls this average up.
  const avgSavingsPct = useMemo(() => {
    if (connectedStores.length === 0) return 0;
    const total = connectedStores.reduce((sum, store) => {
      const impact = impactByStoreCode[store.code];
      const boost = (impact?.savingsPctBoost ?? 0) + getStoreSavingsPctBoost(store.code);
      return sum + getEffectiveSavingsPct(store, boost);
    }, 0);
    return total / connectedStores.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedStores, impactByStoreCode, getStoreSavingsPctBoost]);

  // Both counters only ever move on an explicit user action (a P2/P3 fault
  // resolved, or a P1 advisory card marked as followed up), so they
  // genuinely start at 0 for a freshly-connected store — no baseline
  // injected. P1 controllable cards are deliberately excluded (their TND
  // already flows into "Économies générées" instead, see InsightsContext).
  const panneCount = resolvedTicketLog.length;
  const coutsEvitesTND = totalCoutsEvitesTND;

  // Snapshots the current cumulative totals into the shared monthly-history
  // array every time the simulated month advances (MapSimulationOverlay
  // decides WHEN — a Manuel click or an Auto-mode timer — this just reacts
  // to the result), giving the sparklines below a fixed x-axis anchored at
  // Mois 1. Deliberately keyed on currentMonthIndex alone so it snapshots
  // only at transitions, not on every metric-driven re-render in between.
  useEffect(() => {
    recordSnapshot(currentMonthIndex, { avgSavingsPct, panneCount, coutsEvitesTND });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthIndex]);

  const sortedHistory = useMemo(
    () => [...monthlyHistory].sort((a, b) => a.monthIndex - b.monthIndex),
    [monthlyHistory],
  );
  const savingsHistorySeries = sortedHistory.map((entry) => entry.avgSavingsPct * 100);
  const panneHistorySeries = sortedHistory.map((entry) => entry.panneCount);
  const coutsHistorySeries = sortedHistory.map((entry) => entry.coutsEvitesTND);

  const savingsDisplay = useCountUp(aggregate.totalMonthlySavingsTND);
  const coutsEvitesDisplay = useCountUp(coutsEvitesTND);
  const healthDisplay = useCountUp(aggregate.averageHealthScore);

  const trendSavings = getMetricTrend('networkSavings', aggregate.totalMonthlySavingsTND, connectedCodes.length);
  const trendPanneCount = getMetricTrend('panneCount', panneCount, connectedCodes.length);
  const trendCoutsEvites = getMetricTrend('coutsEvites', coutsEvitesTND, connectedCodes.length);
  const trendHealth = getMetricTrend('healthScore', aggregate.averageHealthScore, connectedCodes.length);

  return (
    <aside className="overview-panel">
      <div className="overview-panel__stats">
        <p className="overview-panel__stat-label">{allStores.length} magasins géolocalisés</p>
        <p className={`overview-panel__connected ${isFlashing ? 'overview-panel__connected--flash' : ''}`}>
          {Math.round(connectedDisplay)} connectés
        </p>
      </div>

      <div className="overview-panel__metric-cards">
        <div className="overview-panel__metric-card">
          <p className="overview-panel__metric-label">Économies générées</p>
          <p className="overview-panel__metric-value">{Math.round(avgSavingsPct * 100)}%</p>
          <p className="overview-panel__metric-subtext">
            {formatNumberFR(savingsDisplay)} TND/mois sur le réseau connecté
          </p>
          {aggregate.totalMonthlySavingsTND > 0 && <TrendTag trend={trendSavings} />}
          <MetricSparkline values={savingsHistorySeries} />
        </div>

        <div className="overview-panel__metric-card">
          <p className="overview-panel__metric-label">Pannes évitées</p>
          <p className="overview-panel__metric-value">{panneCount}</p>
          <p className="overview-panel__metric-subtext">Détection P2/P3 et tickets P1 actionnés</p>
          {panneCount > 0 && <TrendTag trend={trendPanneCount} />}
          <MetricSparkline values={panneHistorySeries} />
        </div>

        <div className="overview-panel__metric-card">
          <p className="overview-panel__metric-label">Coûts évités</p>
          <p className="overview-panel__metric-value">{formatNumberFR(coutsEvitesDisplay)} TND</p>
          <p className="overview-panel__metric-subtext">Stock, technicien, arrêt et énergie cumulés</p>
          {coutsEvitesTND > 0 && <TrendTag trend={trendCoutsEvites} />}
          <MetricSparkline values={coutsHistorySeries} />
        </div>
      </div>

      <div className="overview-panel__counter">
        <p className="overview-panel__counter-label">Points de données collectés</p>
        <p className="overview-panel__counter-value">{formatNumberFR(dataPoints)}</p>
      </div>

      <LiveEventFeed items={feedItems} />

      <div className="overview-panel__health">
        <div className="overview-panel__health-text">
          <p className="overview-panel__section-label">Score de santé moyen du réseau</p>
          <p className="overview-panel__health-baseline">
            Moyenne avant connexion : {Math.round(aggregate.averageBaselineHealthScore)}
          </p>
          <TrendTag trend={trendHealth} />
        </div>
        <HealthGauge score={healthDisplay} size={56} />
      </div>

      <div className="overview-panel__regional">
        <p className="overview-panel__section-label">Répartition régionale</p>
        {regionalData.length > 0 ? (
          <RegionalBreakdownChart data={regionalData} networkAverage={aggregate.averageHealthScore} />
        ) : (
          <p className="overview-panel__empty">Aucun magasin connecté.</p>
        )}
      </div>

      <ConnectionProgress />
    </aside>
  );
}

export default OverviewPanel;
