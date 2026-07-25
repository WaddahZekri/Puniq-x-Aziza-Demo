import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import LeafletMap from '../components/LeafletMap';
import StoreListPanel from '../components/StoreListPanel';
import OverviewPanel from '../components/OverviewPanel';
import StoreOverlay from '../components/StoreOverlay';
import NetworkIntelligenceOverlay from '../components/NetworkIntelligenceOverlay';
import MapSimulationOverlay from '../components/MapSimulationOverlay';
import './MapScreen.css';

const OVERLAY_EXIT_DURATION_MS = 220;

function MapScreen() {
  const { allStores, activeStoreCode, setActiveStore, isNetworkOverlayOpen } = useNetwork();
  const [displayedStore, setDisplayedStore] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef(null);

  const [isNetworkOverlayDisplayed, setIsNetworkOverlayDisplayed] = useState(false);
  const [isNetworkOverlayClosing, setIsNetworkOverlayClosing] = useState(false);
  const networkCloseTimerRef = useRef(null);

  const [hoveredCode, setHoveredCode] = useState(null);
  const [flyToRequest, setFlyToRequest] = useState(null);

  // Keeps the overlay mounted briefly after close so its fade-out can play,
  // instead of unmounting instantly when activeStoreCode clears.
  useEffect(() => {
    if (activeStoreCode) {
      clearTimeout(closeTimerRef.current);
      setIsClosing(false);
      setDisplayedStore(allStores.find((store) => store.code === activeStoreCode) || null);
    } else if (displayedStore) {
      setIsClosing(true);
      closeTimerRef.current = setTimeout(() => {
        setDisplayedStore(null);
        setIsClosing(false);
      }, OVERLAY_EXIT_DURATION_MS);
    }

    return () => clearTimeout(closeTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreCode]);

  // Same mount-briefly-during-exit pattern as the store overlay above.
  useEffect(() => {
    if (isNetworkOverlayOpen) {
      clearTimeout(networkCloseTimerRef.current);
      setIsNetworkOverlayClosing(false);
      setIsNetworkOverlayDisplayed(true);
    } else if (isNetworkOverlayDisplayed) {
      setIsNetworkOverlayClosing(true);
      networkCloseTimerRef.current = setTimeout(() => {
        setIsNetworkOverlayDisplayed(false);
        setIsNetworkOverlayClosing(false);
      }, OVERLAY_EXIT_DURATION_MS);
    }

    return () => clearTimeout(networkCloseTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNetworkOverlayOpen]);

  const handleMarkerHover = useCallback((code) => setHoveredCode(code), []);
  const handleMarkerLeave = useCallback(() => setHoveredCode(null), []);

  // Row body click: pans/zooms the map and highlights the store, but never
  // opens the overlay — that's reserved for a direct marker click or the
  // row's own open button (handleOpenOverlay).
  const handleRowClick = useCallback((store) => {
    setHoveredCode(store.code);
    setFlyToRequest({ lat: store.lat, lon: store.lon, nonce: Date.now() });
  }, []);

  const handleOpenOverlay = useCallback(
    (code) => {
      setActiveStore(code);
    },
    [setActiveStore],
  );

  return (
    <div className="map-screen">
      <StoreListPanel
        hoveredCode={hoveredCode}
        onRowHover={handleMarkerHover}
        onRowLeave={handleMarkerLeave}
        onRowClick={handleRowClick}
        onOpenOverlay={handleOpenOverlay}
      />
      <div className="map-screen__map-area">
        <LeafletMap
          hoveredCode={hoveredCode}
          onMarkerHover={handleMarkerHover}
          onMarkerLeave={handleMarkerLeave}
          onMarkerClick={setActiveStore}
          flyToRequest={flyToRequest}
        />
        <MapSimulationOverlay />
      </div>
      <OverviewPanel />
      {isNetworkOverlayDisplayed && <NetworkIntelligenceOverlay isClosing={isNetworkOverlayClosing} />}
      {displayedStore && <StoreOverlay store={displayedStore} isClosing={isClosing} />}
    </div>
  );
}

export default MapScreen;
