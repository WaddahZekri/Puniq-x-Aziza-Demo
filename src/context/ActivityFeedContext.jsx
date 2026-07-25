import { createContext, useCallback, useContext, useState } from 'react';

const ActivityFeedContext = createContext(null);

const MAX_ITEMS = 24;

// Shared "flux d'activité" feed — lifted out of useLiveEventFeed so both
// the decorative ambient ticker AND real events (auto-resolved tickets,
// see MapSimulationOverlay.jsx) can append to the same visible list,
// rather than each keeping its own local, invisible-to-the-other state.
export function ActivityFeedProvider({ children }) {
  const [items, setItems] = useState([]);

  const addFeedItem = useCallback((label, message) => {
    setItems((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, label, message }].slice(-MAX_ITEMS));
  }, []);

  const value = { items, addFeedItem };

  return <ActivityFeedContext.Provider value={value}>{children}</ActivityFeedContext.Provider>;
}

export function useActivityFeed() {
  const context = useContext(ActivityFeedContext);
  if (!context) {
    throw new Error('useActivityFeed must be used within an ActivityFeedProvider');
  }
  return context;
}
