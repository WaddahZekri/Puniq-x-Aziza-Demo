import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './ArchitectureTrustPanel.css';

// Plain-language points, not a technical spec sheet — this panel exists to
// make the existing architecture legible to a non-technical buyer in a
// pitch, not to document it exhaustively. Point 3 is deliberately worded to
// stay consistent with the "exécutée localement via l'infrastructure P2/P3"
// language already used in the Intelligence tab's apply-confirmation dialog
// (InsightCard.jsx): controllable adjustments run locally, initiated from
// the store's own outbound channel — the cloud never opens a connection
// into the building, so this doesn't contradict that existing feature.
const TRUST_POINTS = [
  {
    icon: '↗',
    title: 'Flux sortant uniquement',
    body: "Chaque magasin envoie ses données vers le cloud PUNIQ. La connexion est toujours initiée depuis le magasin, jamais depuis l'extérieur.",
  },
  {
    icon: '🕓',
    title: 'Continuité hors ligne — 72h',
    body: 'Chaque site conserve une mémoire tampon locale de 72 heures. En cas de coupure de connectivité, la surveillance et les opérations se poursuivent normalement, sans perte de données.',
  },
  {
    icon: '🔒',
    title: 'Aucune commande entrante',
    body: "PUNIQ ne pilote jamais directement les équipements du magasin depuis l'extérieur. Les ajustements approuvés sont exécutés localement, par l'infrastructure P2/P3 du site.",
  },
];

function ArchitectureTrustPanel({ onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div className={`trust-panel-backdrop ${isVisible ? 'is-visible' : ''}`} onClick={handleBackdropClick}>
      <div className="trust-panel" role="dialog" aria-modal="true" aria-label="Architecture et sécurité">
        <header className="trust-panel__header">
          <span className="trust-panel__header-icon" aria-hidden="true">
            🛡️
          </span>
          <h3 className="trust-panel__title">Architecture &amp; Sécurité</h3>
          <button type="button" className="trust-panel__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className="trust-panel__points">
          {TRUST_POINTS.map((point) => (
            <div key={point.title} className="trust-panel__point">
              <span className="trust-panel__point-icon" aria-hidden="true">
                {point.icon}
              </span>
              <div>
                <p className="trust-panel__point-title">{point.title}</p>
                <p className="trust-panel__point-body">{point.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ArchitectureTrustPanel;
