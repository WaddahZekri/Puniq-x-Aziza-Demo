import { useEffect, useState } from 'react';

// Forces a periodic re-render so time-dependent values (like the health
// score ramp, which depends on elapsed Date.now() rather than props/state)
// stay visibly live without needing their own bespoke interval per caller.
// Returns the tick count so it can be dropped into a useMemo dependency
// array wherever a derived value needs to recompute on each tick too.
export function useTicker(intervalMs = 800) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
