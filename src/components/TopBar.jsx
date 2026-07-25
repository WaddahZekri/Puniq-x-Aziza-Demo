import { useNetwork } from '../context/NetworkContext';
import { useCountUp } from '../hooks/useCountUp';
import { useFlashOnChange } from '../hooks/useFlashOnChange';
import NotificationBell from './NotificationBell';
import './TopBar.css';

function NetworkIcon() {
  return (
    <svg
      className="top-bar__network-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="3" r="2" fill="currentColor" />
      <circle cx="3" cy="13" r="2" fill="currentColor" />
      <circle cx="13" cy="13" r="2" fill="currentColor" />
      <path d="M8 5L3 11M8 5L13 11" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function TopBar() {
  const { connectedCodes, openNetworkOverlay } = useNetwork();
  const isEnabled = connectedCodes.length >= 2;
  const countDisplay = Math.round(useCountUp(connectedCodes.length));
  const isFlashing = useFlashOnChange(connectedCodes.length);

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <div className="top-bar__lockup">
          <span className="top-bar__brand">PUNIQ</span>
          <span className="top-bar__mark" aria-hidden="true" />
          <span className="top-bar__brand">AZIZA.</span>
        </div>

        <button
          type="button"
          className="top-bar__network-btn"
          onClick={openNetworkOverlay}
          disabled={!isEnabled}
          title={isEnabled ? undefined : 'Connectez au moins 2 magasins'}
        >
          <NetworkIcon />
          Intelligence Réseau
          <span className={`top-bar__network-badge ${isFlashing ? 'is-flashing' : ''}`}>{countDisplay}</span>
        </button>

        <NotificationBell />
      </div>

      <span className="top-bar__tagline">Démo interactive — Confidentiel</span>
    </header>
  );
}

export default TopBar;
