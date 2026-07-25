import './ZoneCard.css';

function ZoneCard({ title, statusLabel, isWarning, children, footer }) {
  return (
    <div className={`zone-card ${isWarning ? 'zone-card--warning' : ''}`}>
      <div className="zone-card__header">
        <h3 className="zone-card__title">{title}</h3>
        {statusLabel && (
          <span className={`zone-card__status ${isWarning ? 'zone-card__status--warning' : ''}`}>{statusLabel}</span>
        )}
      </div>
      <div className="zone-card__readings">{children}</div>
      {footer && <div className="zone-card__footer">{footer}</div>}
    </div>
  );
}

export function ZoneReading({ label, value, isWarning }) {
  return (
    <div className="zone-card__reading">
      <span className="zone-card__reading-label">{label}</span>
      <span className={`zone-card__reading-value ${isWarning ? 'zone-card__reading-value--warning' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export default ZoneCard;
