import { useMemo } from 'react';
import { useNetworkTickets } from './useNetworkTickets';

// The one shared ticket-state store, keyed by store code — every connected
// store's flagged severity is derived from the exact same merged ticket
// list (Insights + Faults, see useNetworkTickets) that populates the
// Tickets Prioritaires panel, so map markers, the sidebar status dot, and
// the panel can never disagree about which stores are flagged or by how
// much.
//
// Any store with an open 'Urgent' ticket → 'urgent' (red marker).
// Any store with an open 'Recommandé' ticket, no urgent one → 'routine' (amber marker).
// 'Informationnel' tickets alone, or no open tickets at all → 'none' (blue marker).
export function useStoreSeverityMap() {
  const tickets = useNetworkTickets();

  return useMemo(() => {
    const map = new Map();
    tickets.forEach((ticket) => {
      const code = ticket.store.code;
      if (ticket.priority === 'Urgent') {
        map.set(code, 'urgent');
      } else if (ticket.priority === 'Recommandé' && map.get(code) !== 'urgent') {
        map.set(code, 'routine');
      } else if (!map.has(code)) {
        map.set(code, 'none');
      }
    });
    return map;
  }, [tickets]);
}
