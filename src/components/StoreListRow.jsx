import { getStoreShortName } from '../utils/format';
import './StoreListRow.css';

function StoreListRow({
  store,
  isConnected,
  isActive,
  isHighlighted,
  severity = 'none',
  onRowClick,
  onOpenOverlay,
  onMouseEnter,
  onMouseLeave,
}) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick();
    }
  };

  const handleOpenOverlayClick = (event) => {
    event.stopPropagation();
    onOpenOverlay();
  };

  const label = getStoreShortName(store);

  return (
    <div
      className={`store-list-row ${isActive ? 'is-active' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
      data-store-code={store.code}
      role="button"
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span
        className={`store-list-row__dot ${isConnected ? `store-list-row__dot--${severity}` : ''}`}
        aria-label={isConnected ? `Statut : ${severity}` : undefined}
      />
      <span className="store-list-row__text">
        <span className="store-list-row__name">{label}</span>
        <span className="store-list-row__ville">{store.ville}</span>
      </span>
      <button
        type="button"
        className="store-list-row__open-btn"
        aria-label={`Ouvrir la fiche de ${label}`}
        onClick={handleOpenOverlayClick}
      >
        ↗
      </button>
    </div>
  );
}

export default StoreListRow;
