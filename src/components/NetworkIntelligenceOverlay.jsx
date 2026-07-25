import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNetwork } from '../context/NetworkContext';
import NetworkOverviewTab from './NetworkOverviewTab';
import NetworkRankingTab from './NetworkRankingTab';
import NetworkTicketsTab from './NetworkTicketsTab';
import NetworkCapExTab from './NetworkCapExTab';
import NetworkSustainabilityTab from './NetworkSustainabilityTab';
import ErrorBoundary from './ErrorBoundary';
import ArchitectureTrustPanel from './ArchitectureTrustPanel';
import './NetworkIntelligenceOverlay.css';

const TABS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'ranking', label: 'Classement' },
  { id: 'tickets', label: 'Tickets prioritaires' },
  { id: 'capex', label: 'Prévision CapEx' },
  { id: 'sustainability', label: 'Durabilité & Vision' },
];

function NetworkIntelligenceOverlay({ isClosing }) {
  const { allStores, connectedCodes, closeNetworkOverlay } = useNetwork();
  // Tickets Prioritaires is the default landing tab (not Vue d'ensemble) —
  // tab bar order is unchanged, only which one is pre-selected on open.
  const [activeTab, setActiveTab] = useState('tickets');
  const [isVisible, setIsVisible] = useState(false);
  const [isTrustPanelOpen, setIsTrustPanelOpen] = useState(false);

  // Starts hidden, then flips a frame later so the opacity/scale transition
  // to "visible" actually animates instead of snapping in — same pattern as
  // the per-store overlay.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const showVisible = isVisible && !isClosing;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) closeNetworkOverlay();
  };

  return (
    <>
      {createPortal(
        <div
          className={`network-overlay-backdrop ${showVisible ? 'is-visible' : ''}`}
          onClick={handleBackdropClick}
        >
          <div className="network-overlay" role="dialog" aria-modal="true">
            <header className="network-overlay__header">
              <div className="network-overlay__heading">
                <h2 className="network-overlay__title">Intelligence Réseau</h2>
                <div className="network-overlay__status-group">
                  <p className="network-overlay__subtitle">
                    {connectedCodes.length} magasins connectés sur {allStores.length}
                  </p>
                  <button
                    type="button"
                    className="network-overlay__trust-btn"
                    onClick={() => setIsTrustPanelOpen(true)}
                    title="Architecture & Sécurité"
                    aria-label="Voir l'architecture et la sécurité des données"
                  >
                    🛡️
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="network-overlay__close"
                onClick={closeNetworkOverlay}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>

            <nav className="network-overlay__tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`network-overlay__tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="network-overlay__content">
              <ErrorBoundary resetKey={activeTab}>
                {activeTab === 'overview' && <NetworkOverviewTab onNavigateToTab={setActiveTab} />}
                {activeTab === 'ranking' && <NetworkRankingTab />}
                {activeTab === 'tickets' && <NetworkTicketsTab />}
                {activeTab === 'capex' && <NetworkCapExTab />}
                {activeTab === 'sustainability' && <NetworkSustainabilityTab />}
              </ErrorBoundary>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isTrustPanelOpen && <ArchitectureTrustPanel onClose={() => setIsTrustPanelOpen(false)} />}
    </>
  );
}

export default NetworkIntelligenceOverlay;
