import { useEffect, useRef } from 'react';
import { getStoreLabel } from '../utils/format';
import { generateActivityMessage } from '../utils/activityEvents';
import { useActivityFeed } from '../context/ActivityFeedContext';

const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 4000;

// Purely decorative "flux d'activité" flavor text — no counter/state impact.
// Incidents évités / pannes évitées only increment on an explicit user or
// auto-resolution action (see MapSimulationOverlay.jsx), never ambiently
// here, so this stays a cosmetic feed of plausible-sounding telemetry
// lines rather than a second source of truth for any total. Appends
// through the shared ActivityFeedContext so its lines interleave with
// real auto-resolution entries in one visible list.
export function useLiveEventFeed(connectedCodes, allStores) {
  const { addFeedItem } = useActivityFeed();
  const connectedRef = useRef(connectedCodes);
  const storesByCodeRef = useRef(new Map(allStores.map((store) => [store.code, store])));

  useEffect(() => {
    connectedRef.current = connectedCodes;
  }, [connectedCodes]);

  useEffect(() => {
    let timer;

    const scheduleNext = () => {
      const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
      timer = setTimeout(() => {
        const pool = connectedRef.current;
        if (pool.length > 0) {
          const code = pool[Math.floor(Math.random() * pool.length)];
          const store = storesByCodeRef.current.get(code);
          addFeedItem(store ? getStoreLabel(store) : code, generateActivityMessage());
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
