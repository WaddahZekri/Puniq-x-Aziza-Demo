import { useEffect, useRef, useState } from 'react';

// Drives an arbitrary, dynamically-sized set of independent random walks off
// a single interval instead of one hook call per value — needed here because
// the number of refrigeration units/zones varies per store and can't be
// statically unrolled into individual useDriftingValue calls without
// violating the rules of hooks.
//
// `entries`: array of { key, initialValue, min, max, step, bias }.
// Returns an object keyed by `key` with each entry's current drifted value.
export function useDriftingValues(entries, intervalMs = 3000) {
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
        const step = entry.step ?? 0.1;
        const bias = entry.bias ?? 0;
        let updated = current + bias + (Math.random() * 2 - 1) * step;
        if (entry.min !== undefined) updated = Math.max(entry.min, updated);
        if (entry.max !== undefined) updated = Math.min(entry.max, updated);
        next[entry.key] = updated;
      });
      valuesRef.current = next;
      setValues(next);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return values;
}
