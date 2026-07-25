import { useMemo } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useIncidents } from '../context/IncidentsContext';
import { useDevices } from '../context/DevicesContext';
import { useInsights } from '../context/InsightsContext';
import { useNetworkTickets } from '../hooks/useNetworkTickets';
import { useTicker } from '../hooks/useTicker';
import { useCountUp } from '../hooks/useCountUp';
import {
  getEffectiveSavingsPct,
  getMetricTrend,
  getNetworkAggregate,
  getNetworkBestWorst,
  getNetworkPotential,
  getPortfolioPeakExposure,
  getRegionalBreakdown,
  TOU_BANDS,
} from '../utils/metricsEngine';
import { formatNumberFR, getStoreLabel, getStoreShortName } from '../utils/format';
import HealthGauge from './HealthGauge';
import RegionalBreakdownChart from './RegionalBreakdownChart';
import './NetworkOverviewTab.css';

const CRITICAL_TICKETS_PREVIEW_COUNT = 3;

function TrendTag({ trend }) {
  const isUp = trend.direction === 'up';
  return (
    <span className={`network-overview-tab__trend ${isUp ? 'is-up' : 'is-down'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(trend.deltaPct)}% vs 7j
    </span>
  );
}

function NetworkOverviewTab({ onNavigateToTab }) {
  const { allStores, connectedCodes, connectedAt, openStoreFromNetworkOverlay } = useNetwork();
  const { resolvedTicketLog, totalCoutsEvitesTND, getStoreSavingsPctBoost } = useIncidents();
  const { getDeviceState } = useDevices();
  const { getStoreImpact } = useInsights();
  const criticalTickets = useNetworkTickets();

  const tick = useTicker(800);

  const connectedStores = useMemo(
    () => allStores.filter((store) => connectedCodes.includes(store.code)),
    [allStores, connectedCodes],
  );

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
  const potential = useMemo(
    () => getNetworkPotential(allStores, connectedCodes),
    [allStores, connectedCodes],
  );
  const peakExposureTND = useMemo(
    () => getPortfolioPeakExposure(allStores, connectedCodes),
    [allStores, connectedCodes],
  );
  const bestWorst = useMemo(
    () => getNetworkBestWorst(allStores, connectedCodes, connectedAt),
    [allStores, connectedCodes, connectedAt, tick],
  );
  // Simple average of each connected store's own effective savings % (base
  // + ticket-resolution boost, capped) — same combiner as OverviewPanel.jsx
  // so the sidebar and this overlay never disagree.
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

  // Both counters only move on an explicit user action — start at 0, no
  // baseline. P1 controllable cards are excluded (their TND already flows
  // into "Économies générées" instead).
  const panneCount = resolvedTicketLog.length;
  const coutsEvitesTND = totalCoutsEvitesTND;

  const savingsDisplay = useCountUp(aggregate.totalMonthlySavingsTND);
  const coutsEvitesDisplay = useCountUp(coutsEvitesTND);
  const healthDisplay = useCountUp(aggregate.averageHealthScore);
  const potentialDisplay = useCountUp(potential.potentialSavingsTND);
  const capturedPctDisplay = useCountUp(potential.capturedPct);
  const peakExposureDisplay = useCountUp(peakExposureTND.value);
  const peakBand = TOU_BANDS.find((band) => band.id === 'pointe');

  const trendSavings = getMetricTrend('networkSavings', aggregate.totalMonthlySavingsTND, connectedCodes.length);
  const trendPanneCount = getMetricTrend('panneCount', panneCount, connectedCodes.length);
  const trendCoutsEvites = getMetricTrend('coutsEvites', coutsEvitesTND, connectedCodes.length);
  const trendHealth = getMetricTrend('healthScore', aggregate.averageHealthScore, connectedCodes.length);

  const handleViewStore = (code) => openStoreFromNetworkOverlay(code, { tab: 'intelligence' });

  return (
    <div className="network-overview-tab">
      <div className="network-overview-tab__stats">
        <div className="network-overview-tab__stat">
          <p className="network-overview-tab__stat-label">Économies générées</p>
          <p className="network-overview-tab__stat-value">{Math.round(avgSavingsPct * 100)}%</p>
          <p className="network-overview-tab__stat-desc">
            {formatNumberFR(savingsDisplay)} TND/mois sur le réseau connecté
          </p>
          {aggregate.totalMonthlySavingsTND > 0 && <TrendTag trend={trendSavings} />}
        </div>

        <div className="network-overview-tab__stat">
          <p className="network-overview-tab__stat-label">Pannes évitées</p>
          <p className="network-overview-tab__stat-value">{panneCount}</p>
          <p className="network-overview-tab__stat-desc">Détection P2/P3 et tickets P1 actionnés</p>
          {panneCount > 0 && <TrendTag trend={trendPanneCount} />}
        </div>

        <div className="network-overview-tab__stat">
          <p className="network-overview-tab__stat-label">Coûts évités</p>
          <p className="network-overview-tab__stat-value">{formatNumberFR(coutsEvitesDisplay)} TND</p>
          <p className="network-overview-tab__stat-desc">Stock, technicien, arrêt et énergie cumulés</p>
          {coutsEvitesTND > 0 && <TrendTag trend={trendCoutsEvites} />}
        </div>

        <div className="network-overview-tab__stat network-overview-tab__stat--gauge">
          <p className="network-overview-tab__stat-label">Score de santé moyen</p>
          <HealthGauge score={healthDisplay} size={64} />
          <TrendTag trend={trendHealth} />
        </div>
      </div>

      <div className="network-overview-tab__potential">
        <p className="network-overview-tab__potential-label">Potentiel non exploité</p>
        <p className="network-overview-tab__potential-value">{formatNumberFR(potentialDisplay)} TND/mois</p>
        <p className="network-overview-tab__potential-text">
          de valeur estimée sur les {potential.nonConnectedCount} magasin{potential.nonConnectedCount > 1 ? 's' : ''}{' '}
          non encore connecté{potential.nonConnectedCount > 1 ? 's' : ''}.
        </p>
        <div className="network-overview-tab__potential-bar-row">
          <p className="network-overview-tab__potential-bar-label">
            Vous exploitez actuellement {Math.round(capturedPctDisplay)}% du potentiel total du réseau
          </p>
          <div className="network-overview-tab__potential-bar">
            <div
              className="network-overview-tab__potential-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, capturedPctDisplay))}%` }}
            />
          </div>
        </div>
      </div>

      {(bestWorst.best || bestWorst.worst) && (
        <div className="network-overview-tab__spotlight">
          {bestWorst.best && (
            <div className="network-overview-tab__spotlight-card network-overview-tab__spotlight-card--good">
              <p className="network-overview-tab__spotlight-label">Meilleur magasin</p>
              <p className="network-overview-tab__spotlight-name">{getStoreShortName(bestWorst.best.store)}</p>
              <p className="network-overview-tab__spotlight-ville">{bestWorst.best.store.ville}</p>
              <p className="network-overview-tab__spotlight-score">
                Score de santé : {Math.round(bestWorst.best.healthScore)}
              </p>
              <button
                type="button"
                className="network-overview-tab__spotlight-link"
                onClick={() => handleViewStore(bestWorst.best.store.code)}
              >
                Voir le détail →
              </button>
            </div>
          )}

          {bestWorst.worst && (
            <div className="network-overview-tab__spotlight-card network-overview-tab__spotlight-card--warn">
              <p className="network-overview-tab__spotlight-label">Magasin à risque</p>
              <p className="network-overview-tab__spotlight-name">{getStoreShortName(bestWorst.worst.store)}</p>
              <p className="network-overview-tab__spotlight-ville">{bestWorst.worst.store.ville}</p>
              <p className="network-overview-tab__spotlight-score">
                Score de santé : {Math.round(bestWorst.worst.healthScore)}
              </p>
              <button
                type="button"
                className="network-overview-tab__spotlight-link"
                onClick={() => handleViewStore(bestWorst.worst.store.code)}
              >
                Voir le détail →
              </button>
            </div>
          )}
        </div>
      )}

      <div className="network-overview-tab__section">
        <p className="network-overview-tab__section-label">Répartition régionale — score de santé moyen</p>
        {regionalData.length > 0 ? (
          <RegionalBreakdownChart data={regionalData} networkAverage={aggregate.averageHealthScore} />
        ) : (
          <p className="network-overview-tab__empty">Aucun magasin connecté.</p>
        )}
      </div>

      <div className="network-overview-tab__section">
        <div className="network-overview-tab__tickets-header">
          <p className="network-overview-tab__section-label">Derniers tickets critiques</p>
          {criticalTickets.length > 0 && (
            <button
              type="button"
              className="network-overview-tab__tickets-link"
              onClick={() => onNavigateToTab?.('tickets')}
            >
              Voir tous les tickets →
            </button>
          )}
        </div>
        {criticalTickets.length > 0 ? (
          <div className="network-overview-tab__tickets-list">
            {criticalTickets.slice(0, CRITICAL_TICKETS_PREVIEW_COUNT).map((ticket) => (
              <div key={ticket.id} className="network-overview-tab__ticket-row">
                <span className="network-overview-tab__ticket-store">{getStoreLabel(ticket.store)}</span>
                <span className="network-overview-tab__ticket-title">{ticket.title}</span>
                <span className="network-overview-tab__ticket-impact">{formatNumberFR(ticket.impactMagnitudeTND)} TND</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="network-overview-tab__empty">Aucun ticket actif sur le réseau pour l&rsquo;instant.</p>
        )}
      </div>

      <button
        type="button"
        className="network-overview-tab__solar-link"
        onClick={() => onNavigateToTab?.('sustainability')}
      >
        Potentiel autoconsommation solaire — voir le classement par site →
      </button>

      <div className="network-overview-tab__peak-exposure">
        <p className="network-overview-tab__peak-exposure-label">Exposition aux heures de pointe (tarif TOU)</p>
        <p className="network-overview-tab__peak-exposure-value">{formatNumberFR(peakExposureDisplay)} TND/mois</p>
        <p className="network-overview-tab__peak-exposure-caption">
          Part du coût énergétique mensuel des magasins connectés facturée sur la tranche tarifaire la plus
          chère ({peakBand.label}, {peakBand.hours}) — un levier de décalage de charge encore peu exploité.
        </p>
      </div>
    </div>
  );
}

export default NetworkOverviewTab;
