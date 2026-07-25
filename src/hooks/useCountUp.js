import { useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_MS = 500;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

// Animates toward whatever the latest target is, so rapid successive
// updates (e.g. auto-ignition connecting many stores in a row) redirect
// smoothly instead of jumping or fighting a stale animation.
export function useCountUp(targetValue, duration = DEFAULT_DURATION_MS) {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const currentRef = useRef(targetValue);
  const rafRef = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = currentRef.current;
    const to = targetValue;
    if (from === to) return undefined;

    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(progress);
      const value = from + (to - from) * eased;
      currentRef.current = value;
      setDisplayValue(value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetValue, duration]);

  return displayValue;
}
