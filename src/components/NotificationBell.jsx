import { useEffect, useRef, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useNetworkTickets } from '../hooks/useNetworkTickets';
import { useTicketResolvers } from '../hooks/useTicketResolvers';
import { getPriorityClass } from '../utils/priority';
import { getStoreLabel } from '../utils/format';
import FaultAlertCard from './FaultAlertCard';
import './NotificationBell.css';

function BellIcon() {
  return (
    <svg className="notification-bell__icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2.5c-2.9 0-4.5 2.1-4.5 5v2.3c0 .6-.2 1.2-.6 1.7L4 12.9c-.6.8 0 1.9 1 1.9h10c1 0 1.6-1.1 1-1.9l-.9-1.4c-.4-.5-.6-1.1-.6-1.7V7.5c0-2.9-1.6-5-4.5-5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 16.3a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// Reads the exact same merged Insights+Faults ticket list every other
// network-wide surface does (see useNetworkTickets) — filtered to Urgent
// priority only, so this badge/list can never disagree with the number of
// red markers on the map or the "Urgents" count in Intelligence Réseau →
// Tickets prioritaires (see useStoreSeverityMap, itself built from this
// same list). Clicking a ticket navigates through the exact same
// openStoreFromNetworkOverlay(..., { tab: 'intelligence', focusInsightId })
// path the Tickets Prioritaires panel uses, landing on the identical card.
function NotificationBell() {
  const { openStoreFromNetworkOverlay } = useNetwork();
  const allTickets = useNetworkTickets();
  const { resolveFaultTicket } = useTicketResolvers();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const urgentTickets = allTickets.filter((ticket) => ticket.priority === 'Urgent');

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (ticket) => {
    openStoreFromNetworkOverlay(ticket.store.code, { tab: 'intelligence', focusInsightId: ticket.id });
    setIsOpen(false);
  };

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell__btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Tickets urgents (${urgentTickets.length})`}
        aria-expanded={isOpen}
      >
        <BellIcon />
        {urgentTickets.length > 0 && <span className="notification-bell__badge">{urgentTickets.length}</span>}
      </button>

      {isOpen && (
        <div className="notification-bell__panel">
          <p className="notification-bell__panel-title">Tickets urgents</p>
          {urgentTickets.length === 0 ? (
            <p className="notification-bell__empty">Aucun ticket urgent actif sur le réseau.</p>
          ) : (
            <div className="notification-bell__list">
              {urgentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="notification-bell__item"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(ticket)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelect(ticket);
                    }
                  }}
                >
                  {ticket.kind === 'fault' ? (
                    <FaultAlertCard
                      fault={ticket.fault}
                      storeLabel={getStoreLabel(ticket.store)}
                      onResolve={(event) => {
                        event.stopPropagation();
                        resolveFaultTicket(ticket.store, ticket.fault);
                      }}
                    />
                  ) : (
                    <div
                      className={`notification-bell__ticket priority-border--${getPriorityClass(ticket.priority)}`}
                    >
                      <div className="notification-bell__ticket-header">
                        <span className={`priority-badge priority-badge--${getPriorityClass(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                        <span className="notification-bell__ticket-store">{getStoreLabel(ticket.store)}</span>
                      </div>
                      <p className="notification-bell__ticket-title">{ticket.title}</p>
                      <p className="notification-bell__ticket-impact">{ticket.estimatedImpact}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
