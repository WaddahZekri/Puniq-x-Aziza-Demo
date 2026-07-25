import { useEffect, useRef, useState } from 'react';

export function useFlashOnChange(value, duration = 700) {
  const [flashing, setFlashing] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return undefined;
    }

    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), duration);
    return () => clearTimeout(timer);
  }, [value, duration]);

  return flashing;
}
