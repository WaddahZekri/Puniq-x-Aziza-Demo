import { useEffect, useRef, useState } from 'react';

// Small live-feeling random walk, not seeded — this is meant to visibly
// move over time, unlike the deterministic per-store metrics.
export function useDriftingValue(initialValue, { min, max, step = 0.1, bias = 0, intervalMs = 3000 } = {}) {
  const [value, setValue] = useState(initialValue);
  const valueRef = useRef(initialValue);

  useEffect(() => {
    const timer = setInterval(() => {
      const delta = bias + (Math.random() * 2 - 1) * step;
      let next = valueRef.current + delta;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      valueRef.current = next;
      setValue(next);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [min, max, step, bias, intervalMs]);

  return value;
}
