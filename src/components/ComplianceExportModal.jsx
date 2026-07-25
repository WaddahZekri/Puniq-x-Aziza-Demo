import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPortfolioSustainabilitySummary, formatDateFR } from '../utils/metricsEngine';
import { formatNumberFR } from '../utils/format';
import './ComplianceExportModal.css';

// Every row here reads from getPortfolioSustainabilitySummary — the same
// aggregation NetworkSustainabilityTab's two existing cards already use —
// so nothing in this table is a new or independently-derived figure.
const TABLE_ROWS = [
  {
    label: 'Périmètre du rapport',
    value: (s) => `${s.storeCount} / ${s.totalStoreCount} magasins connectés`,
    category: 'Portée organisationnelle',
  },
  {
    label: 'Consommation énergétique totale',
    value: (s) => `${formatNumberFR(s.monthlyEnergyCostTND)} TND/mois`,
    category: 'E1 — Énergie',
  },
  {
    label: 'Intensité énergétique (portefeuille)',
    value: (s) => `${s.energyIntensityTNDPerVisit.toFixed(3)} TND/visite`,
    category: 'E1 — Énergie',
  },
  {
    label: 'Émissions de GES estimées',
    value: (s) => `${formatNumberFR(s.kgCO2ePerMonth)} kgCO2e/mois`,
    category: 'E1 — Climat',
  },
  {
    label: 'Émissions évitées estimées (grâce à PUNIQ)',
    value: (s) => `${formatNumberFR(s.kgCO2eAvoidedPerMonth)} kgCO2e/mois`,
    category: 'E1 — Climat',
  },
];

function ComplianceExportModal({ allStores, connectedCodes, onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const summary = useMemo(
    () => getPortfolioSustainabilitySummary(allStores, connectedCodes),
    [allStores, connectedCodes],
  );

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div className={`compliance-modal-backdrop ${isVisible ? 'is-visible' : ''}`} onClick={handleBackdropClick}>
      <div className="compliance-modal" role="dialog" aria-modal="true" aria-label="Rapport de conformité">
        <header className="compliance-modal__header">
          <div className="compliance-modal__heading">
            <h3 className="compliance-modal__title">Rapport de conformité — Aperçu</h3>
            <p className="compliance-modal__subtitle">Généré le {formatDateFR(new Date())} · PUNIQ × Aziza</p>
          </div>
          <div className="compliance-modal__header-actions">
            <button type="button" className="compliance-modal__print-btn" onClick={() => window.print()}>
              Imprimer / Exporter en PDF
            </button>
            <button type="button" className="compliance-modal__close" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          </div>
        </header>

        <div className="compliance-modal__content">
          <p className="compliance-modal__disclaimer">
            Aperçu illustratif du contenu d&rsquo;un rapport de conformité CSRD / Taxonomie UE, généré à partir des
            données actuellement disponibles dans PUNIQ pour les magasins connectés. L&rsquo;export PDF certifié et
            le pipeline d&rsquo;audit complet sont disponibles sur demande — cette vue démontre la structure et les
            données, ce n&rsquo;est pas un document final prêt pour un audit.
          </p>

          <div className="compliance-modal__stats">
            <div className="compliance-modal__stat">
              <p className="compliance-modal__stat-label">Intensité énergétique — portefeuille connecté</p>
              <p className="compliance-modal__stat-value">
                {summary.energyIntensityTNDPerVisit.toFixed(3)} TND/visite
              </p>
              <p className="compliance-modal__stat-caption">
                {formatNumberFR(summary.monthlyEnergyCostTND)} TND/mois ÷ {formatNumberFR(summary.monthlyFootfall)}{' '}
                visites/mois estimées
              </p>
            </div>

            <div className="compliance-modal__stat">
              <p className="compliance-modal__stat-label">Émissions évitées estimées</p>
              <p className="compliance-modal__stat-value compliance-modal__stat-value--good">
                {formatNumberFR(summary.kgCO2eAvoidedPerMonth)} kgCO2e/mois
              </p>
              <p className="compliance-modal__stat-caption">
                Équivalent à environ {formatNumberFR(summary.avoidedEquivalence.treesEquivalent)} arbres plantés par
                an
              </p>
            </div>
          </div>

          <div className="compliance-modal__table-wrapper">
            <table className="compliance-modal__table">
              <thead>
                <tr>
                  <th>Indicateur</th>
                  <th>Valeur estimée</th>
                  <th>Catégorie ESRS / Taxonomie (indicative)</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.value(summary)}</td>
                    <td>{row.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="compliance-modal__footnote">
            Chiffres estimés à partir des données PUNIQ pour les {summary.storeCount} magasin
            {summary.storeCount > 1 ? 's' : ''} connecté{summary.storeCount > 1 ? 's' : ''} au moment de la
            génération. Catégories ESRS/Taxonomie indiquées à titre de repère, non certifiées.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ComplianceExportModal;
