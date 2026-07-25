import { useMemo, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import {
  formatDateFR,
  getEmissionsEquivalence,
  CO2_PER_TND_SPEND,
  getPortfolioAnmeCompliance,
  getPortfolioSolarPotential,
  ANME_TOE_THRESHOLD,
} from '../utils/metricsEngine';
import { useStoreMetricsMap } from '../hooks/useStoreMetricsMap';
import { formatNumberFR, getStoreLabel } from '../utils/format';
import VisionTeaser from './VisionTeaser';
import ComplianceExportModal from './ComplianceExportModal';
import './NetworkSustainabilityTab.css';

const ANME_STATUS_LABELS = {
  above: 'Au-dessus du seuil',
  near: 'Proche du seuil',
  below: 'En dessous du seuil',
};

const SOLAR_PHASE_LABELS = {
  priority: 'Phase 1 — prioritaire',
  phase2: 'Phase 2',
  evaluate: 'À évaluer',
};

const REPORT_LOADING_MS = 1500;
const REPORT_PERIOD_DAYS = 14;

const VISION_BULLETS = [
  'Croisement des données d’achat et de stock à l’échelle du réseau',
  'Anticipation des besoins d’approvisionnement selon la saisonnalité',
  'Optimisation région par région, magasin par magasin',
];

function NetworkSustainabilityTab() {
  const { allStores, connectedCodes, openStoreFromNetworkOverlay } = useNetwork();
  const [reportState, setReportState] = useState('idle');
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [isEuSectionOpen, setIsEuSectionOpen] = useState(false);

  const anmeCompliance = useMemo(
    () => getPortfolioAnmeCompliance(allStores, connectedCodes),
    [allStores, connectedCodes],
  );
  const solarPotential = useMemo(() => getPortfolioSolarPotential(allStores), [allStores]);
  const connectedCodeSet = useMemo(() => new Set(connectedCodes), [connectedCodes]);

  const connectedStores = allStores.filter((store) => connectedCodes.includes(store.code));
  const metricsByCode = useStoreMetricsMap(connectedStores);
  const monthlyEnergyCostTND = connectedStores.reduce(
    (sum, store) => sum + metricsByCode.get(store.code).monthlyEnergyCostTND,
    0,
  );
  const kgCO2ePerMonth = Math.round(monthlyEnergyCostTND * CO2_PER_TND_SPEND);
  const equivalence = getEmissionsEquivalence(kgCO2ePerMonth);

  const fullScaleKgCO2ePerMonth =
    connectedStores.length > 0
      ? Math.round((kgCO2ePerMonth / connectedStores.length) * allStores.length)
      : 0;
  const fullScaleEquivalence = getEmissionsEquivalence(fullScaleKgCO2ePerMonth);

  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - (REPORT_PERIOD_DAYS - 1));

  const handleGenerateReport = () => {
    setReportState('loading');
    setTimeout(() => setReportState('success'), REPORT_LOADING_MS);
  };

  return (
    <div className="network-sustainability-tab">
      <div className="network-sustainability-tab__cards">
        <div className="network-sustainability-tab__card">
          <p className="network-sustainability-tab__label">Rapport de durabilité consolidé</p>
          <p className="network-sustainability-tab__value">{formatNumberFR(kgCO2ePerMonth)} kgCO2e/mois</p>
          <p className="network-sustainability-tab__equivalence">
            Équivalent à environ {formatNumberFR(equivalence.treesEquivalent)} arbres plantés par an, ou{' '}
            {formatNumberFR(equivalence.vehiclesEquivalent)} véhicules retirés de la circulation.
          </p>
          <p className="network-sustainability-tab__caption">
            Estimation illustrative basée sur un facteur de {CO2_PER_TND_SPEND} kgCO2e par TND de dépense
            énergétique, appliqué à la consommation mensuelle agrégée des magasins connectés.
          </p>

          {reportState === 'idle' && (
            <button type="button" className="network-sustainability-tab__report-btn" onClick={handleGenerateReport}>
              Générer le rapport
            </button>
          )}

          {reportState === 'loading' && (
            <p className="network-sustainability-tab__report-status">Génération en cours&hellip;</p>
          )}

          {reportState === 'success' && (
            <p className="network-sustainability-tab__report-success">
              ✓ Rapport généré — {connectedStores.length} magasin{connectedStores.length > 1 ? 's' : ''} inclus,
              période {formatDateFR(periodStart)} – {formatDateFR(periodEnd)}
            </p>
          )}
        </div>

        <div className="network-sustainability-tab__card network-sustainability-tab__card--projection">
          <p className="network-sustainability-tab__label">Potentiel à pleine échelle ({allStores.length} magasins)</p>
          <p className="network-sustainability-tab__value network-sustainability-tab__value--amber">
            {formatNumberFR(fullScaleKgCO2ePerMonth)} kgCO2e/mois
          </p>
          <p className="network-sustainability-tab__equivalence">
            Équivalent à environ {formatNumberFR(fullScaleEquivalence.treesEquivalent)} arbres plantés par an, ou{' '}
            {formatNumberFR(fullScaleEquivalence.vehiclesEquivalent)} véhicules retirés de la circulation.
          </p>
          <p className="network-sustainability-tab__caption">
            Estimation illustrative — extrapolation proportionnelle de la consommation moyenne des magasins
            connectés à l&rsquo;ensemble du réseau national.
          </p>
        </div>

      </div>

      <div className="network-sustainability-tab__anme">
        <div className="network-sustainability-tab__anme-summary">
          <p className="network-sustainability-tab__label">
            Conformité Audit Énergétique (ANME) — Portefeuille connecté
          </p>
          <p className="network-sustainability-tab__value">
            {anmeCompliance.totalAnnualToe.toFixed(1)} tep/an
          </p>
          <p className="network-sustainability-tab__caption">
            {anmeCompliance.atOrAboveCount} magasin{anmeCompliance.atOrAboveCount > 1 ? 's' : ''} sur{' '}
            {anmeCompliance.storeCount} connecté{anmeCompliance.storeCount > 1 ? 's' : ''} au-dessus du seuil
            individuel de {ANME_TOE_THRESHOLD} tep/an fixé par la loi 2005-82. Estimation illustrative — PUNIQ ne
            connaît pas le statut de conformité réel d&rsquo;un magasin.
          </p>
        </div>

        {anmeCompliance.items.length > 0 && (
          <div className="network-sustainability-tab__anme-table-wrapper">
            <table className="network-sustainability-tab__anme-table">
              <thead>
                <tr>
                  <th>Magasin</th>
                  <th>Consommation annuelle estimée</th>
                  <th>Statut vs seuil (500 tep/an)</th>
                </tr>
              </thead>
              <tbody>
                {anmeCompliance.items.map(({ store, annualToe, status }) => (
                  <tr
                    key={store.code}
                    className="network-sustainability-tab__anme-row"
                    onClick={() => openStoreFromNetworkOverlay(store.code, { tab: 'overview' })}
                  >
                    <td>{getStoreLabel(store)}</td>
                    <td>{annualToe.toFixed(1)} tep/an</td>
                    <td>
                      <span
                        className={`network-sustainability-tab__anme-badge network-sustainability-tab__anme-badge--${status}`}
                        title={`Ce magasin est ${ANME_STATUS_LABELS[status].toLowerCase()} de ${ANME_TOE_THRESHOLD} tep/an fixé par la loi 2005-82.`}
                      >
                        {ANME_STATUS_LABELS[status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {anmeCompliance.atOrAboveCount > 0 && (
          <p className="network-sustainability-tab__anme-note">
            Les magasins au-dessus du seuil doivent déclarer leur consommation à l&rsquo;ANME chaque année et
            réaliser un audit énergétique accrédité tous les 5 ans. Une non-conformité expose à une amende de
            20 000 à 50 000 TND.
          </p>
        )}

        <p className="network-sustainability-tab__anme-offer">
          Le pré-audit gratuit PUNIQ peut constituer une première étape vers votre audit énergétique
          réglementaire, éligible à une prime ANME de 70% du coût (plafonnée à 30 000 TND).
        </p>
      </div>

      <div className="network-sustainability-tab__solar">
        <p className="network-sustainability-tab__label">
          Potentiel autoconsommation solaire — classement par site
        </p>
        <p className="network-sustainability-tab__caption">
          Sites classés par potentiel estimé (basé sur la consommation vérifiée) et groupés en phases pour
          prioriser les discussions. Un projet solaire se structure site par site, pas comme un contrat unique à
          l&rsquo;échelle du réseau.
        </p>

        <div className="network-sustainability-tab__solar-table-wrapper">
          <table className="network-sustainability-tab__solar-table">
            <thead>
              <tr>
                <th>Magasin</th>
                <th>Volume annuel estimé</th>
                <th>Phase suggérée</th>
              </tr>
            </thead>
            <tbody>
              {solarPotential.items.map(({ store, annualPotentialTND, phase }) => (
                <tr
                  key={store.code}
                  className="network-sustainability-tab__solar-row"
                  onClick={() => openStoreFromNetworkOverlay(store.code, { tab: 'overview' })}
                >
                  <td>
                    {getStoreLabel(store)}
                    {connectedCodeSet.has(store.code) && (
                      <span
                        className="network-sustainability-tab__solar-connected-dot"
                        title="Magasin connecté"
                      />
                    )}
                  </td>
                  <td>{formatNumberFR(Math.round(annualPotentialTND))} TND/an</td>
                  <td>
                    <span
                      className={`network-sustainability-tab__solar-phase network-sustainability-tab__solar-phase--${phase}`}
                    >
                      {SOLAR_PHASE_LABELS[phase]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="network-sustainability-tab__solar-caveat">
          Estimation basée sur la consommation vérifiée. Une évaluation de faisabilité (toiture, orientation,
          structure) est nécessaire par site avant tout projet.
        </p>
      </div>

      <VisionTeaser
        title="Phase suivante — Pilotage prédictif à l'échelle nationale"
        bullets={VISION_BULLETS}
        caption="Disponible après intégration de vos systèmes internes"
      />

      <div className="network-sustainability-tab__eu-section">
        <button
          type="button"
          className="network-sustainability-tab__eu-toggle"
          onClick={() => setIsEuSectionOpen((prev) => !prev)}
        >
          Pertinent si votre structure actionnariale inclut une obligation de reporting européenne
          <span aria-hidden="true">{isEuSectionOpen ? ' ▲' : ' ▼'}</span>
        </button>

        {isEuSectionOpen && (
          <div className="network-sustainability-tab__card">
            <p className="network-sustainability-tab__label">Export conformité</p>
            <p className="network-sustainability-tab__compliance-body">
              Aperçu du contenu d&rsquo;un rapport CSRD / Taxonomie UE — intensité énergétique, émissions évitées
              et indicateurs clés du portefeuille connecté, à partir des données déjà calculées dans PUNIQ.
            </p>
            <button
              type="button"
              className="network-sustainability-tab__report-btn"
              onClick={() => setIsComplianceModalOpen(true)}
            >
              Exporter le rapport de conformité
            </button>
            <p className="network-sustainability-tab__caption">
              Aperçu illustratif — export PDF certifié et pipeline d&rsquo;audit complet disponibles sur demande.
            </p>
          </div>
        )}
      </div>

      {isComplianceModalOpen && (
        <ComplianceExportModal
          allStores={allStores}
          connectedCodes={connectedCodes}
          onClose={() => setIsComplianceModalOpen(false)}
        />
      )}
    </div>
  );
}

export default NetworkSustainabilityTab;
