import { formatRelativeTimeFR } from '../utils/format';
import { severityToPriorityClass, SEVERITY_LABELS, getFaultTicketCopy } from '../utils/severity';
import './FaultAlertCard.css';

// A live, actively-drifting fault triggered from the Dashboard's "Simuler
// une panne" buttons (or generated automatically in Auto mode) —
// mechanically distinct from the Intelligence tab's insight tickets (this
// ties into FaultContext's real-time drift and the avoided-event
// counters), so it keeps its own small, simple card rather than being
// shoehorned into the detailed ticket layout. Two fault types share this
// card, each feeding its own independent counter on resolve:
// 'refrigeration_drift' (stock-loss risk) and 'compressor_vibration'
// (technician-visit risk).

// `size="hero"` is used for the one place this card needs to visually
// dominate (the store overview's top-of-panel urgent alert) — same
// markup/data, just a CSS modifier for bigger padding/border/badge, so
// there's one card definition instead of two near-duplicates.
// `storeLabel`, when passed (the notification bell's cross-store list),
// renders a small store name above the title; omitted everywhere else.
function FaultAlertCard({ fault, onResolve, size = 'default', storeLabel }) {
  const { title, description } = getFaultTicketCopy(fault);
  const severity = fault.severity === 'routine' ? 'routine' : 'urgent';
  const priorityClass = severityToPriorityClass(severity);

  return (
    <div
      className={`fault-alert-card priority-border--${priorityClass} ${
        size === 'hero' ? 'fault-alert-card--hero' : ''
      }`}
    >
      {storeLabel && <p className="fault-alert-card__store">{storeLabel}</p>}
      <div className="fault-alert-card__header">
        <span className={`priority-badge priority-badge--${priorityClass}`}>{SEVERITY_LABELS[severity]}</span>
        <span className="fault-alert-card__timestamp">{formatRelativeTimeFR(fault.triggeredAt)}</span>
      </div>
      <h4 className="fault-alert-card__title">{title}</h4>
      <p className="fault-alert-card__description">{description}</p>
      <button type="button" className="fault-alert-card__resolve-btn" onClick={onResolve}>
        Marquer résolu
      </button>
    </div>
  );
}

export default FaultAlertCard;
