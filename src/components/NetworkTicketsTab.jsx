import { useMemo, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useNetworkTickets } from '../hooks/useNetworkTickets';
import { useFleetFaultPatterns } from '../hooks/useFleetFaultPatterns';
import { getPriorityClass } from '../utils/priority';
import { formatNumberFR, getStoreLabel } from '../utils/format';
import './NetworkTicketsTab.css';

const MAX_TICKETS_SHOWN = 10;
const PRIORITIES = ['Urgent', 'Recommandé', 'Informationnel'];

// Small fleet/network glyph — deliberately distinct from the priority dot
// badges (Urgent/Recommandé/Informationnel) so a "Panne de flotte" card
// reads as its own tier at a glance, not just another ticket.
function FleetIcon() {
  return (
    <svg
      className="network-tickets-tab__fleet-icon"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="3" r="1.6" fill="currentColor" />
      <circle cx="3" cy="13" r="1.6" fill="currentColor" />
      <circle cx="13" cy="13" r="1.6" fill="currentColor" />
      <path d="M8 5L3 11M8 5L13 11" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function NetworkTicketsTab() {
  const { openStoreFromNetworkOverlay } = useNetwork();
  const allOpenTickets = useNetworkTickets();
  const fleetPatterns = useFleetFaultPatterns();
  const [priorityFilter, setPriorityFilter] = useState(null);

  const handleViewStore = (code, focusInsightId) => {
    openStoreFromNetworkOverlay(code, { tab: 'intelligence', focusInsightId });
  };

  const countsByPriority = useMemo(() => {
    const counts = { Urgent: 0, Recommandé: 0, Informationnel: 0 };
    allOpenTickets.forEach((ticket) => {
      counts[ticket.priority] = (counts[ticket.priority] ?? 0) + 1;
    });
    return counts;
  }, [allOpenTickets]);

  const filteredTickets = priorityFilter
    ? allOpenTickets.filter((ticket) => ticket.priority === priorityFilter)
    : allOpenTickets;
  const shownTickets = filteredTickets.slice(0, MAX_TICKETS_SHOWN);
  const totalImpact = shownTickets.reduce((sum, ticket) => sum + ticket.impactMagnitudeTND, 0);

  const handleToggleFilter = (priority) => {
    setPriorityFilter((prev) => (prev === priority ? null : priority));
  };

  // Fault-originated tickets don't live on the Intelligence tab (they're
  // shown on the store overview's alert card instead) — no focusInsightId
  // to jump to, so route those to Overview rather than Intelligence.
  const handleViewDetail = (ticket) => {
    if (ticket.kind === 'fault') {
      openStoreFromNetworkOverlay(ticket.store.code, { tab: 'overview' });
      return;
    }
    handleViewStore(ticket.store.code, ticket.id);
  };

  if (allOpenTickets.length === 0) {
    return <p className="network-tickets-tab__empty">Aucun ticket actif sur le réseau pour l&rsquo;instant.</p>;
  }

  return (
    <div className="network-tickets-tab">
      {fleetPatterns.length > 0 && (
        <div className="network-tickets-tab__fleet-section">
          <p className="network-tickets-tab__section-label">
            <FleetIcon /> Pannes de flotte
          </p>
          <div className="network-tickets-tab__fleet-list">
            {fleetPatterns.map((pattern) => (
              <div key={pattern.id} className="network-tickets-tab__fleet-card">
                <div className="network-tickets-tab__fleet-card-header">
                  <span className="network-tickets-tab__fleet-badge">
                    <FleetIcon /> Panne de flotte
                  </span>
                  <span className="network-tickets-tab__fleet-count">
                    {pattern.storesAffected.length} magasins affectés
                  </span>
                </div>
                <p className="network-tickets-tab__fleet-title">{pattern.equipmentModel}</p>
                <div className="network-tickets-tab__fleet-stores">
                  {pattern.storesAffected.map(({ store, focusInsightId }) => (
                    <button
                      key={store.code}
                      type="button"
                      className="network-tickets-tab__fleet-store-chip"
                      onClick={() => handleViewStore(store.code, focusInsightId)}
                    >
                      {getStoreLabel(store)}
                      <span className="network-tickets-tab__fleet-store-code">Code {store.code}</span>
                    </button>
                  ))}
                </div>
                <p className="network-tickets-tab__fleet-impact">
                  Impact combiné estimé :{' '}
                  <span className="network-tickets-tab__fleet-impact-amount">
                    {formatNumberFR(pattern.combinedImpactTND)} TND/mois
                  </span>
                </p>
                <p className="network-tickets-tab__fleet-action">→ {pattern.recommendedAction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="network-tickets-tab__chips" role="group" aria-label="Filtrer par priorité">
        {PRIORITIES.map((priority) => (
          <button
            key={priority}
            type="button"
            className={`network-tickets-tab__chip priority-border--${getPriorityClass(priority)} ${
              priorityFilter === priority ? 'is-active' : ''
            }`}
            onClick={() => handleToggleFilter(priority)}
          >
            <span className={`priority-badge priority-badge--${getPriorityClass(priority)}`}>
              {countsByPriority[priority] ?? 0}
            </span>{' '}
            {priority}s
          </button>
        ))}
      </div>

      <p className="network-tickets-tab__header-stat">
        {filteredTickets.length} ticket{filteredTickets.length > 1 ? 's' : ''} actif
        {filteredTickets.length > 1 ? 's' : ''} sur le réseau — impact total estimé :{' '}
        <span className="network-tickets-tab__header-amount">{formatNumberFR(totalImpact)} TND/mois</span>
      </p>

      <div className="network-tickets-tab__list">
        {shownTickets.map((ticket) => (
          <div key={ticket.id} className={`network-tickets-tab__row priority-border--${getPriorityClass(ticket.priority)}`}>
            <div className="network-tickets-tab__row-main">
              <div className="network-tickets-tab__row-header">
                <span className={`priority-badge priority-badge--${getPriorityClass(ticket.priority)}`}>
                  {ticket.priority}
                </span>
                <span className="network-tickets-tab__store">{getStoreLabel(ticket.store)}</span>
              </div>
              <p className="network-tickets-tab__title">{ticket.title}</p>
              <p className="network-tickets-tab__impact">{ticket.estimatedImpact}</p>
            </div>
            <button type="button" className="network-tickets-tab__detail-btn" onClick={() => handleViewDetail(ticket)}>
              Voir le détail →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NetworkTicketsTab;
