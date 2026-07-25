import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import allStores from '../data/azizaStores';
import { getIgnitionOrder } from '../utils/metricsEngine';

// Bellevue (Tunis), Sfax Route El Ain (Sfax) and Sousse Jawhara (Sousse) —
// one pre-connected pilot store per major hub, mirroring the geographic
// spread the original Monoprix pilot set (Tunis/Sfax/Bellevue) had.
const PILOT_STORE_CODES = ['1212', '1028', '1099'];

const NetworkContext = createContext(null);

export function NetworkProvider({ children }) {
  const [connectedCodes, setConnectedCodes] = useState(PILOT_STORE_CODES);
  const [connectedAt, setConnectedAt] = useState(() => {
    const now = Date.now();
    return PILOT_STORE_CODES.reduce((acc, code) => ({ ...acc, [code]: now }), {});
  });
  const [visitedCodes, setVisitedCodes] = useState([]);
  const [simulationMode, setSimulationMode] = useState('manual');
  const [activeStoreCode, setActiveStoreCode] = useState(null);
  const [activeStoreInitialTab, setActiveStoreInitialTab] = useState(null);
  const [activeStoreFocusInsightId, setActiveStoreFocusInsightId] = useState(null);
  const [isNetworkOverlayOpen, setIsNetworkOverlayOpen] = useState(false);

  const connectNextStore = useCallback(() => {
    setConnectedCodes((prev) => {
      const [next] = getIgnitionOrder(allStores, prev);
      return next ? [...prev, next] : prev;
    });
  }, []);

  // Connects up to `count` more stores at once, in the same ROI-ranked
  // order connectNextStore uses one at a time — MapSimulationOverlay calls
  // this once per simulated month (in both Manuel and Auto) so the network
  // onboards gradually across the whole simulated timeline instead of all
  // at once.
  const connectStoreBatch = useCallback((count) => {
    setConnectedCodes((prev) => {
      const order = getIgnitionOrder(allStores, prev);
      const toAdd = order.slice(0, count);
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
    });
  }, []);

  const connectSpecificStore = useCallback((code) => {
    setConnectedCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
  }, []);

  // `options.tab` and `options.focusInsightId` let cross-navigation (e.g.
  // from the Network Intelligence overlay's ranking/tickets tabs) open a
  // store directly on a specific tab, optionally scrolled to one card.
  const setActiveStore = useCallback((code, options = {}) => {
    setActiveStoreCode(code);
    setActiveStoreInitialTab(options.tab ?? null);
    setActiveStoreFocusInsightId(options.focusInsightId ?? null);
    if (code) {
      setVisitedCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
    }
  }, []);

  const closeStoreOverlay = useCallback(() => {
    setActiveStoreCode(null);
  }, []);

  const openNetworkOverlay = useCallback(() => {
    setIsNetworkOverlayOpen(true);
  }, []);

  const closeNetworkOverlay = useCallback(() => {
    setIsNetworkOverlayOpen(false);
  }, []);

  // The Network Intelligence overlay's ranking/ticket rows use this to jump
  // straight into a store's Intelligence tab without leaving two overlays
  // stacked on top of each other.
  const openStoreFromNetworkOverlay = useCallback(
    (code, options = {}) => {
      setIsNetworkOverlayOpen(false);
      setActiveStore(code, options);
    },
    [setActiveStore],
  );

  // Records the session-time moment each store first connects, so health
  // scores can ramp from a real "before" baseline instead of starting good.
  useEffect(() => {
    setConnectedAt((prev) => {
      const now = Date.now();
      let changed = false;
      const next = { ...prev };
      connectedCodes.forEach((code) => {
        if (!(code in next)) {
          next[code] = now;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [connectedCodes]);

  const value = {
    allStores,
    connectedCodes,
    connectedAt,
    visitedCodes,
    simulationMode,
    activeStoreCode,
    activeStoreInitialTab,
    activeStoreFocusInsightId,
    isNetworkOverlayOpen,
    connectNextStore,
    connectStoreBatch,
    connectSpecificStore,
    setSimulationMode,
    setActiveStore,
    closeStoreOverlay,
    openNetworkOverlay,
    closeNetworkOverlay,
    openStoreFromNetworkOverlay,
  };

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
