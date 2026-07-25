import './LockedTabState.css';

function LockedTabState({ message, onConnect }) {
  return (
    <div className="locked-tab-state">
      <span className="locked-tab-state__icon" aria-hidden="true">
        🔒
      </span>
      <p className="locked-tab-state__message">{message}</p>
      <button type="button" className="locked-tab-state__connect-btn" onClick={onConnect}>
        Ajouter ce magasin à la simulation
      </button>
    </div>
  );
}

export default LockedTabState;
