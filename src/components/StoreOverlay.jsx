import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNetwork } from '../context/NetworkContext';
import { useFault } from '../context/FaultContext';
import { formatDateFR, getConnectionDate } from '../utils/metricsEngine';
import { getStoreShortName } from '../utils/format';
import StoreOverlayOverviewTab from './StoreOverlayOverviewTab';
import StoreOverlayDashboardTab from './StoreOverlayDashboardTab';
import StoreOverlayDiscoveryTab from './StoreOverlayDiscoveryTab';
import StoreOverlayIntelligenceTab from './StoreOverlayIntelligenceTab';
import ErrorBoundary from './ErrorBoundary';
import ArchitectureTrustPanel from './ArchitectureTrustPanel';
import './StoreOverlay.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'intelligence', label: 'Intelligence' },
];

function StoreOverlay({ store, isClosing }) {
  const { connectedCodes, closeStoreOverlay, connectSpecificStore, activeStoreInitialTab, activeStoreFocusInsightId } =
    useNetwork();
  const { activeFaults } = useFault();
  const [activeTab, setActiveTab] = useState(activeStoreInitialTab ?? 'overview');
  const [isVisible, setIsVisible] = useState(false);
  const [isTrustPanelOpen, setIsTrustPanelOpen] = useState(false);

  const isConnected = connectedCodes.includes(store.code);
  const hasUnresolvedFaults = (activeFaults[store.code] || []).length > 0;

  // Starts hidden, then flips a frame later so the opacity/scale transition
  // to "visible" actually animates instead of snapping in.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const showVisible = isVisible && !isClosing;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) closeStoreOverlay();
  };

  return (
    <>
      {createPortal(
        <div
          className={`store-overlay-backdrop ${showVisible ? 'is-visible' : ''}`}
          onClick={handleBackdropClick}
        >
          <div className="store-overlay" role="dialog" aria-modal="true">
            <header className="store-overlay__header">
              <div className="store-overlay__heading">
                <h2 className="store-overlay__title">{getStoreShortName(store)}</h2>
                <p className="store-overlay__subtitle">
                  {store.ville} · Code {store.code}
                </p>
              </div>

              <div className="store-overlay__status-group">
                {isConnected ? (
                  <span className="store-overlay__badge store-overlay__badge--connected">
                    Connecté depuis {formatDateFR(getConnectionDate(store))}
                  </span>
                ) : (
                  <span className="store-overlay__badge">Non connecté</span>
                )}
                <button
                  type="button"
                  className="store-overlay__trust-btn"
                  onClick={() => setIsTrustPanelOpen(true)}
                  title="Architecture & Sécurité"
                  aria-label="Voir l'architecture et la sécurité des données"
                >
                  🛡️
                </button>
              </div>

              <button type="button" className="store-overlay__close" onClick={closeStoreOverlay} aria-label="Fermer">
                ×
              </button>
            </header>

            <nav className="store-overlay__tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`store-overlay__tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {tab.id === 'intelligence' && hasUnresolvedFaults && (
                    <span className="store-overlay__tab-dot" aria-label="Alerte non résolue" />
                  )}
                </button>
              ))}
            </nav>

            <div className="store-overlay__content">
              <ErrorBoundary resetKey={`${store.code}-${activeTab}`}>
                {activeTab === 'overview' && (
                  <StoreOverlayOverviewTab
                    store={store}
                    isConnected={isConnected}
                    onNavigateToTab={setActiveTab}
                  />
                )}
                {activeTab === 'dashboard' && (
                  <StoreOverlayDashboardTab
                    store={store}
                    isConnected={isConnected}
                    onConnect={() => connectSpecificStore(store.code)}
                  />
                )}
                {activeTab === 'discovery' && (
                  <StoreOverlayDiscoveryTab
                    store={store}
                    isConnected={isConnected}
                    onConnect={() => connectSpecificStore(store.code)}
                  />
                )}
                {activeTab === 'intelligence' && (
                  <StoreOverlayIntelligenceTab
                    store={store}
                    isConnected={isConnected}
                    onConnect={() => connectSpecificStore(store.code)}
                    focusInsightId={activeStoreFocusInsightId}
                  />
                )}
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

export default StoreOverlay;
