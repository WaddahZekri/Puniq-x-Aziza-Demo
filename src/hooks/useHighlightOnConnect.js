import { useEffect, useRef, useState } from 'react';

const HIGHLIGHT_DURATION_MS = 1200;

export function useHighlightOnConnect(connectedCodes) {
  const [highlightCode, setHighlightCode] = useState(null);
  const prevLengthRef = useRef(connectedCodes.length);

  useEffect(() => {
    if (connectedCodes.length > prevLengthRef.current) {
      const newest = connectedCodes[connectedCodes.length - 1];
      setHighlightCode(newest);
      prevLengthRef.current = connectedCodes.length;

      const timer = setTimeout(() => setHighlightCode(null), HIGHLIGHT_DURATION_MS);
      return () => clearTimeout(timer);
    }

    prevLengthRef.current = connectedCodes.length;
    return undefined;
  }, [connectedCodes]);

  return highlightCode;
}
