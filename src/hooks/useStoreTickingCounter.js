import { useEffect, useState } from 'react';
import { getStoreDataPointsBaseline } from '../utils/metricsEngine';

const TICK_INTERVAL_MS = 1400;
const INCREMENT_MIN = 15;
const INCREMENT_MAX = 45;

// `enabled` should be false for a non-connected store — with no PUNIQ
// sensors installed, there is nothing accumulating data points, so the
// counter must not run (or display) at all in that case.
export function useStoreTickingCounter(store, enabled = true) {
  const [value, setValue] = useState(() => getStoreDataPointsBaseline(store));

  useEffect(() => {
    if (!enabled) return undefined;

    const timer = setInterval(() => {
      const increment = INCREMENT_MIN + Math.random() * (INCREMENT_MAX - INCREMENT_MIN);
      setValue((prev) => prev + Math.round(increment));
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [enabled]);

  return value;
}
