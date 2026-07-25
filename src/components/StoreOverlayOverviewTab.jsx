import { useNetwork } from '../context/NetworkContext';
import { useDevices } from '../context/DevicesContext';
import { useInsights } from '../context/InsightsContext';
import { useIncidents } from '../context/IncidentsContext';
import { useFault } from '../context/FaultContext';
import { useTicketResolvers } from '../hooks/useTicketResolvers';
import { useStoreTickingCounter } from '../hooks/useStoreTickingCounter';
import { useStoreMetrics } from '../hooks/useStoreMetrics';
import { useStoreLeadQualification } from '../hooks/useStoreLeadQualification';
import { useBenchmarkPercentile } from '../hooks/useBenchmarkPercentile';
import { useStoreDepartments } from '../hooks/useStoreDepartments';
import { useInternalMode } from '../hooks/useInternalMode';
import { useTicker } from '../hooks/useTicker';
import { useCountUp } from '../hooks/useCountUp';
import {
  getBaselineHealthScore,
  getCurrentHealthScore,
  getDataMapSample,
  getDataMapTotalCount,
  getEffectiveSavingsPct,
  getStoreMetricTrendPct,
  getStoreSolarPotential,
} from '../utils/metricsEngine';
import { PRIORITY_RANK } from '../utils/insightEngine';
import { getPriorityClass } from '../utils/priority';
import { formatNumberFR } from '../utils/format';
import HealthGauge from './HealthGauge';
import FaultAlertCard from './FaultAlertCard';
import './StoreOverlayOverviewTab.css';

function TrendLine({ pct, invert }) {
  const isGoodDirection = invert ? pct <= 0 : pct >= 0;
  const arrow = pct >= 0 ? '▲' : '▼';
  return (
    <p className={`overview-tab__trend ${isGoodDirection ? 'is-good' : 'is-warn'}`}>
      {arrow} {Math.abs(pct)}% vs mois dernier
    </p>
  );
}

function StoreOverlayOverviewTab({ store, isConnected, onNavigateToTab }) {
  const { allStores, connectSpecificStore, connectedAt, openNetworkOverlay } = useNetwork();
  const { getDeviceState } = useDevices();
  const { getStoreImpact, getInsightsForStore } = useInsights();
  const { getStoreSavingsPctBoost } = useIncidents();
  const { activeFaults } = useFault();
  const { resolveFaultTicket } = useTicketResolvers();
  const metrics = useStoreMetrics(store);
  const leadQualification = useStoreLeadQualification(store);
  const isInternal = useInternalMode();
  const dataPoints = useStoreTickingCounter(store, isConnected);

  // Health score ramps live off elapsed session time, so this view needs to
  // re-render periodically even though no prop/state actually changed.
  useTicker(800);

  const discoveredDeviceIds = getDeviceState(store).discoveredIds;
  const storeImpact = getStoreImpact(store, discoveredDeviceIds);
  // Resolving any ticket at this store (P1 controllable applied, P1
  // advisory dismissed, or a P2/P3 fault resolved) nudges this store's own
  // displayed % up — same combiner as the network-wide aggregate, so a
  // presenter sees the exact number they just moved.
  const effectiveSavingsPct = getEffectiveSavingsPct(
    store,
    storeImpact.savingsPctBoost + getStoreSavingsPctBoost(store.code),
  );

  const baseline = getBaselineHealthScore(store);
  const current = getCurrentHealthScore(store, connectedAt[store.code], storeImpact.healthBonus);
  const displayScore = Math.round(useCountUp(isConnected ? current : baseline));
  const savingsDisplay = useCountUp(metrics.monthlySavingsTND + storeImpact.extraSavingsTND);

  const ranking = useBenchmarkPercentile(store, allStores);
  const savingsTrend = getStoreMetricTrendPct(store, 'savings');
  const costTrend = getStoreMetricTrendPct(store, 'costPerVisitor');

  const dataMapSample = getDataMapSample(store);
  const dataMapTotal = getDataMapTotalCount(store);
  const solarPotentialTND = getStoreSolarPotential(store);

  const departments = useStoreDepartments(store);

  const openInsights = getInsightsForStore(store, discoveredDeviceIds)
    .filter((insight) => insight.status === 'open')
    .sort((a, b) => {
      const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.impactMagnitudeTND - a.impactMagnitudeTND;
    });
  const topInsight = openInsights[0];

  // Top visual priority when present, per the store overview's design: an
  // active urgent fault outranks every metric/contact section below it.
  // Collapses entirely (no reserved space) when there isn't one.
  const urgentFault = isConnected
    ? (activeFaults[store.code] || []).find((fault) => fault.severity === 'urgent')
    : null;

  return (
    <div className="overview-tab">
      {urgentFault && (
        <FaultAlertCard fault={urgentFault} size="hero" onResolve={() => resolveFaultTicket(store, urgentFault)} />
      )}

      {/* The panel's centerpiece — outranks every other section (hero
          stats included) except the urgent alert above it, per the
          overview's visual hierarchy. Content/structure unchanged, only
          moved up and given heavier visual weight (see .overview-tab__insight-preview). */}
      {isConnected && topInsight && (
        <div className="overview-tab__insight-preview">
          <p className="overview-tab__insight-preview-label">Aperçu Intelligence</p>
          <div
            className={`overview-tab__insight-card priority-border--${getPriorityClass(topInsight.priority)}`}
          >
            <div className="overview-tab__insight-card-header">
              <span className={`priority-badge priority-badge--${getPriorityClass(topInsight.priority)}`}>
                {topInsight.priority}
              </span>
              <h4 className="overview-tab__insight-card-title">{topInsight.title}</h4>
            </div>
            <p className="overview-tab__insight-card-department">{topInsight.departmentLabel}</p>
            <p className="overview-tab__insight-card-impact">{topInsight.estimatedImpact}</p>
          </div>
          <button
            type="button"
            className="overview-tab__insight-link"
            onClick={() => onNavigateToTab?.('intelligence')}
          >
            Voir tous les tickets →
          </button>
        </div>
      )}

      {!isConnected && (
        <div className="overview-tab__insight-preview">
          <p className="overview-tab__insight-preview-label">Aperçu Intelligence</p>
          <p className="overview-tab__insight-example-intro">
            L&rsquo;analyse Intelligence commence dès la connexion — exemple du type d&rsquo;insight que PUNIQ
            génère une fois ce magasin actif :
          </p>
          <div className="overview-tab__insight-card overview-tab__insight-card--example">
            <div className="overview-tab__insight-card-header">
              <span className="overview-tab__insight-example-badge">Exemple</span>
              <h4 className="overview-tab__insight-card-title">Optimisation détectée — Climatisation</h4>
            </div>
            <p className="overview-tab__insight-card-department">Département type</p>
            <p className="overview-tab__insight-card-impact">
              Impact estimé : -200 TND/mois, -8% de consommation sur cette zone
            </p>
          </div>
        </div>
      )}

      <div className="overview-tab__hero">
        {leadQualification.isTempting ? (
          <div className="overview-tab__stat">
            <p className="overview-tab__stat-label">
              {isConnected ? 'Réduction de la consommation énergétique' : 'Potentiel de réduction énergétique (estimé)'}
            </p>
            <p className="overview-tab__stat-value overview-tab__stat-value--amber">
              {Math.round((isConnected ? effectiveSavingsPct : leadQualification.savingsPct) * 100)}%
            </p>
            <p className="overview-tab__stat-caption">
              Soit {formatNumberFR(isConnected ? savingsDisplay : metrics.monthlySavingsTND)} TND/mois
            </p>
            <TrendLine pct={savingsTrend} />
          </div>
        ) : (
          <div className="overview-tab__stat overview-tab__stat--fleet-note">
            <p className="overview-tab__stat-label">Valeur de ce magasin</p>
            <p className="overview-tab__fleet-note-text">
              Pris isolément, ce magasin affiche un potentiel d&rsquo;économie modeste. Sa vraie valeur apparaît à
              l&rsquo;échelle du portefeuille — {formatNumberFR(dataMapTotal)} points de données déjà documentés
              ici alimentent la vue consolidée du réseau.
            </p>
            <button type="button" className="overview-tab__fleet-note-link" onClick={openNetworkOverlay}>
              Voir Intelligence Réseau →
            </button>
          </div>
        )}

        <div className="overview-tab__stat">
          <p className="overview-tab__stat-label">
            {isConnected ? 'Coût énergétique par visiteur' : 'Coût énergétique par visiteur (estimé)'}
          </p>
          <p className="overview-tab__stat-value">{metrics.costPerVisitorTND.toFixed(2)} TND</p>
          <TrendLine pct={costTrend} invert />
        </div>

        <div className="overview-tab__stat overview-tab__stat--gauge">
          <p className={`overview-tab__stat-label ${!isConnected ? 'overview-tab__stat-label--warn' : ''}`}>
            {isConnected ? 'Score de santé du magasin' : 'Score du pré-audit'}
          </p>
          <HealthGauge score={displayScore} size={66} />
          <p className="overview-tab__health-caption">
            {isConnected
              ? `Score au moment de la connexion : ${baseline} → en amélioration continue`
              : "Estimation réalisée lors de la visite de pré-audit gratuite, basée sur l'état visible des équipements — pas une mesure en temps réel."}
          </p>
        </div>

        <div className={`overview-tab__stat ${!isConnected ? 'overview-tab__stat--locked' : ''}`}>
          <p className="overview-tab__stat-label">Classement du magasin</p>
          {isConnected ? (
            <>
              <p className="overview-tab__stat-value">Top {ranking.percentile}%</p>
              <p className="overview-tab__stat-caption">
                {ranking.comparableCount} magasin{ranking.comparableCount > 1 ? 's' : ''} comparable
                {ranking.comparableCount > 1 ? 's' : ''}
              </p>
            </>
          ) : (
            <>
              <div className="overview-tab__locked-content">
                <span className="overview-tab__locked-icon" aria-hidden="true">
                  🔒
                </span>
                <p className="overview-tab__locked-text">Classement disponible après connexion à PUNIQ</p>
              </div>
              <button
                type="button"
                className="overview-tab__locked-cta"
                onClick={() => connectSpecificStore(store.code)}
              >
                Débloquer le classement
              </button>
            </>
          )}
        </div>
      </div>

      {isInternal && (
        <p className="overview-tab__internal-tag">
          [INTERNE] isTempting : {leadQualification.isTempting ? 'true' : 'false'} · marge ×
          {leadQualification.marginRatio.toFixed(1)} · {formatNumberFR(leadQualification.monthlySavingsTND)} TND vs{' '}
          {formatNumberFR(leadQualification.monthlyCostTND)} TND (coût PUNIQ)
        </p>
      )}

      <div className="overview-tab__counter">
        <p className="overview-tab__counter-label">Points de données collectés — ce magasin</p>
        {isConnected ? (
          <p className="overview-tab__counter-value">{formatNumberFR(dataPoints)}</p>
        ) : (
          <p className="overview-tab__counter-empty">
            Aucune donnée — la surveillance PUNIQ n&rsquo;est pas encore active sur ce magasin.
          </p>
        )}
      </div>

      <div className="overview-tab__datamap">
        <p className="overview-tab__section-label">
          {isConnected ? 'Carte de données documentée' : 'Inventaire relevé lors du pré-audit gratuit'}
        </p>
        <div className="overview-tab__datamap-table-wrapper">
          <table className="overview-tab__datamap-table">
            <thead>
              <tr>
                <th className="overview-tab__datamap-th">Système</th>
                <th className="overview-tab__datamap-th">Appareil</th>
                {isConnected && (
                  <>
                    <th className="overview-tab__datamap-th">Nom normalisé PUNIQ</th>
                    <th className="overview-tab__datamap-th">Qualité</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {dataMapSample.map((row) => (
                <tr key={row.nomNormalisePuniq}>
                  <td className="overview-tab__datamap-td">{row.système}</td>
                  <td className="overview-tab__datamap-td">{row.appareil}</td>
                  {isConnected && (
                    <>
                      <td className="overview-tab__datamap-td overview-tab__datamap-td--code">
                        {row.nomNormalisePuniq}
                      </td>
                      <td className="overview-tab__datamap-td">{row.qualité}%</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isConnected && (
          <p className="overview-tab__datamap-caption">
            Carte complète : {dataMapTotal} points de données documentés pour ce magasin.
          </p>
        )}
      </div>

      <div className="overview-tab__departments">
        <p className="overview-tab__section-label">Départements couverts</p>
        <div className="overview-tab__department-pills">
          {departments.map((department) => (
            <span key={department.id} className="overview-tab__department-pill">
              {department.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overview-tab__solar">
        <p className="overview-tab__counter-label">
          Volume vérifié — Potentiel autoconsommation solaire (ce magasin)
        </p>
        <p className="overview-tab__solar-value">{formatNumberFR(Math.round(solarPotentialTND))} TND/an</p>
        <p className="overview-tab__solar-caveat">
          PUNIQ peut vous aider à sélectionner et gérer une installation solaire adaptée à ce site, en
          s&rsquo;appuyant sur les données de consommation déjà collectées. Une évaluation de faisabilité
          (toiture, orientation, structure) reste nécessaire avant tout projet.
        </p>
      </div>

      {(store.directeur || store.tel) && (
        <div className="overview-tab__contact">
          <p className="overview-tab__section-label">Contact du magasin</p>
          <div className="overview-tab__contact-rows">
            {store.directeur && (
              <p className="overview-tab__contact-row">
                <span className="overview-tab__contact-label">Directeur</span>
                <span className="overview-tab__contact-value">{store.directeur}</span>
              </p>
            )}
            {store.tel && (
              <p className="overview-tab__contact-row">
                <span className="overview-tab__contact-label">Téléphone</span>
                <span className="overview-tab__contact-value">{store.tel}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {!isConnected && (
        <button
          type="button"
          className="overview-tab__connect-btn"
          onClick={() => connectSpecificStore(store.code)}
        >
          Ajouter ce magasin à la simulation
        </button>
      )}
    </div>
  );
}

export default StoreOverlayOverviewTab;
