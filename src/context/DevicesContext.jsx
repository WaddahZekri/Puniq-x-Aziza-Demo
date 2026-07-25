import { createContext, useCallback, useContext, useState } from 'react';
import { getStoreDevices } from '../utils/deviceModel';

const DevicesContext = createContext(null);

function initialStateFor(store) {
  const { visibleDevices } = getStoreDevices(store);
  return { discoveredIds: visibleDevices.map((device) => device.id), discoveredAt: {} };
}

export function DevicesProvider({ children }) {
  const [deviceStateByStore, setDeviceStateByStore] = useState({});

  // Falls back to "just the initially-visible devices" for any store whose
  // state hasn't been touched yet, so callers never need to explicitly
  // initialize a store before reading from it.
  const getDeviceState = useCallback(
    (store) => deviceStateByStore[store.code] ?? initialStateFor(store),
    [deviceStateByStore],
  );

  const discoverNextDevices = useCallback((store, count) => {
    setDeviceStateByStore((prev) => {
      const current = prev[store.code] ?? initialStateFor(store);
      const { undiscoveredPool } = getStoreDevices(store);
      const remaining = undiscoveredPool.filter((device) => !current.discoveredIds.includes(device.id));
      if (remaining.length === 0) return prev;

      const now = Date.now();
      const picked = remaining.slice(0, count);
      const discoveredAt = { ...current.discoveredAt };
      picked.forEach((device) => {
        discoveredAt[device.id] = now;
      });

      return {
        ...prev,
        [store.code]: {
          discoveredIds: [...current.discoveredIds, ...picked.map((device) => device.id)],
          discoveredAt,
        },
      };
    });
  }, []);

  const value = { getDeviceState, discoverNextDevices };

  return <DevicesContext.Provider value={value}>{children}</DevicesContext.Provider>;
}

export function useDevices() {
  const context = useContext(DevicesContext);
  if (!context) {
    throw new Error('useDevices must be used within a DevicesProvider');
  }
  return context;
}
