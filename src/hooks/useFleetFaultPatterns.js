import { useMemo } from 'react';
import { useNetworkTickets } from './useNetworkTickets';
import { getFleetFaultPatterns } from '../utils/insightEngine';

// Thin wrapper around useNetworkTickets — keeps fleet-wide pattern
// detection reading from the exact same open-ticket list the Tickets
// Prioritaires tab already renders, so the two views can never drift.
export function useFleetFaultPatterns() {
  const networkTickets = useNetworkTickets();
  return useMemo(() => getFleetFaultPatterns(networkTickets), [networkTickets]);
}
