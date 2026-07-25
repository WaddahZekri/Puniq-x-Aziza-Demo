import { useEffect, useRef, useState } from 'react';

// Occasionally bumps a dynamically-sized set of counters by 1 while mounted,
// each capped at its own `max` — used for things like "door opened N times
// today" that should visibly creep up over a long demo session without
// ticking on every render. Driven off a single interval (like
// useDriftingValues) since the number of counters varies per store.
//
// `entries`: array of { key, initialValue, max, chance }.
export function useSlowCounters(entries, intervalMs = 25000) {
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const [values, setValues] = useState(() => {
    const initial = {};
    entries.forEach((entry) => {
      initial[entry.key] = entry.initialValue;
    });
    return initial;
  });
  const valuesRef = useRef(values);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = { ...valuesRef.current };
      entriesRef.current.forEach((entry) => {
        const current = next[entry.key] ?? entry.initialValue;
        const max = entry.max;
        const chance = entry.chance ?? 0.4;
        if (max !== undefined && current >= max) return;
        next[entry.key] = Math.random() < chance ? current + 1 : current;
      });
      valuesRef.current = next;
      setValues(next);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return values;
}
