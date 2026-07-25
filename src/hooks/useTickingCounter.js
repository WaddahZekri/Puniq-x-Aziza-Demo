import { useEffect, useRef, useState } from 'react';

const TICK_INTERVAL_MS = 800;
const INCREMENT_MIN = 40;
const INCREMENT_MAX = 120;

export function useTickingCounter(startingValue, connectedCount) {
  const [value, setValue] = useState(startingValue);
  const connectedCountRef = useRef(connectedCount);

  useEffect(() => {
    connectedCountRef.current = connectedCount;
  }, [connectedCount]);

  useEffect(() => {
    const timer = setInterval(() => {
      const rate = 1 + connectedCountRef.current * 0.15;
      const base = INCREMENT_MIN + Math.random() * (INCREMENT_MAX - INCREMENT_MIN);
      setValue((prev) => prev + Math.round(base * rate));
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return value;
}
