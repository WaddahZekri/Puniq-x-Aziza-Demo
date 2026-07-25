import { useMemo } from 'react';

// Dev-only visibility flag — never part of the client-facing view. Add
// ?internal=true to the URL to reveal internal-only reference indicators
// (e.g. lead qualification) while presenting live.
export function useInternalMode() {
  return useMemo(() => new URLSearchParams(window.location.search).get('internal') === 'true', []);
}
