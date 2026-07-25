import { useEffect, useRef, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useFault } from '../context/FaultContext';
import { useTicketResolvers } from '../hooks/useTicketResolvers';
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

// Live-incident counterpart to the Dashboard's "Simuler une panne" buttons
// and the Auto-mode fault engine — reads FaultContext directly (not the
// merged Insights+Faults severity map that colors map markers/sidebar
// dots/the ticket panel, see useStoreSeverityMap), so this badge/list is
// scoped to actively-drifting live faults specifically, same as the store
// overview's hero alert card. Additive next to the existing Intelligence
// Réseau button — doesn't touch it.
function NotificationBell() {
  const { allStores, connectedCodes, setActiveStore } = useNetwork();
  const { activeFaults } = useFault();
  const { resolveFaultTicket } = useTicketResolvers();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const urgentTickets = connectedCodes.flatMap((code) => {
    const store = allStores.find((candidate) => candidate.code === code);
    if (!store) return [];
    return (activeFaults[code] || [])
      .filter((fault) => fault.severity === 'urgent')
      .map((fault) => ({ store, fault }));
  });

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

  const handleSelect = (code) => {
    setActiveStore(code, { tab: 'overview' });
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
              {urgentTickets.map(({ store, fault }) => (
                <div
                  key={fault.id}
                  className="notification-bell__item"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(store.code)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelect(store.code);
                    }
                  }}
                >
                  <FaultAlertCard
                    fault={fault}
                    storeLabel={getStoreLabel(store)}
                    onResolve={(event) => {
                      event.stopPropagation();
                      resolveFaultTicket(store, fault);
                    }}
                  />
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
