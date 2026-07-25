import { useEffect, useState } from 'react';
import { formatRelativeTimeFR } from '../utils/format';
import { getPriorityClass } from '../utils/priority';
import './InsightCard.css';

const RESULT_REVEAL_DELAY_MS = 2000;

function InsightCard({ insight, onApply, onDismiss }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (insight.status === 'measured' && insight.measuredAt) {
      const remaining = Math.max(0, RESULT_REVEAL_DELAY_MS - (Date.now() - insight.measuredAt));
      const timer = setTimeout(() => setShowResult(true), remaining);
      return () => clearTimeout(timer);
    }
    setShowResult(false);
    return undefined;
  }, [insight.status, insight.measuredAt]);

  const priorityClass = getPriorityClass(insight.priority);
  const isApplying = insight.status === 'applied';
  const isMeasured = insight.status === 'measured';
  const isDismissed = insight.status === 'dismissed';

  return (
    <div
      className={`insight-card priority-border--${priorityClass} ${
        isMeasured || isDismissed ? 'insight-card--resolved' : ''
      }`}
    >
      <div className="insight-card__header">
        <span className={`priority-badge priority-badge--${priorityClass}`}>{insight.priority}</span>
        <span className="insight-card__timestamp">{formatRelativeTimeFR(insight.timestamp)}</span>
      </div>

      <div className="insight-card__heading">
        <h4 className="insight-card__title">{insight.title}</h4>
        <p className="insight-card__subtitle">
          {insight.departmentLabel}
          {insight.deviceName ? ` — ${insight.deviceName.split(' — ')[0]}` : ''}
        </p>
      </div>

      <div className="insight-card__section">
        <p className="insight-card__section-label">Preuves</p>
        <ul className="insight-card__evidence">
          {insight.evidence.map((line) => (
            <li key={line} className="insight-card__evidence-line">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="insight-card__section">
        <p className="insight-card__section-label">Diagnostic</p>
        <p className="insight-card__text">{insight.diagnosis}</p>
      </div>

      <div className="insight-card__section">
        <p className="insight-card__section-label">Action recommandée</p>
        <p className="insight-card__text">{insight.recommendedAction}</p>
      </div>

      <div className="insight-card__section">
        <p className="insight-card__section-label">Impact estimé</p>
        <p className="insight-card__impact">{insight.estimatedImpact}</p>
      </div>

      {isMeasured && showResult && (
        <p className="insight-card__result">
          Résultat mesuré : -{insight.measuredPctImpact}% de consommation confirmé sur cette zone depuis
          l&rsquo;application.
        </p>
      )}

      <div className="insight-card__footer">
        {insight.controllable ? (
          <>
            {insight.status === 'open' && !isConfirming && (
              <button type="button" className="insight-card__apply-btn" onClick={() => setIsConfirming(true)}>
                Appliquer via PUNIQ
              </button>
            )}

            {isConfirming && (
              <div className="insight-card__confirm">
                <p className="insight-card__confirm-text">
                  Confirmer l&rsquo;application de cet ajustement ? Cette action sera exécutée localement via
                  l&rsquo;infrastructure P2/P3 de ce magasin.
                </p>
                <div className="insight-card__confirm-actions">
                  <button
                    type="button"
                    className="insight-card__confirm-btn"
                    onClick={() => {
                      setIsConfirming(false);
                      onApply();
                    }}
                  >
                    Confirmer
                  </button>
                  <button type="button" className="insight-card__cancel-btn" onClick={() => setIsConfirming(false)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {isApplying && <p className="insight-card__applying">Application en cours&hellip;</p>}

            {isMeasured && (
              <span className="insight-card__resolved-tag">
                <span className="insight-card__resolved-check">✓</span> Appliqué
              </span>
            )}
          </>
        ) : (
          <>
            <span className="insight-card__physical-tag">Intervention technique requise</span>
            {insight.status === 'open' ? (
              <button type="button" className="insight-card__dismiss-btn" onClick={onDismiss}>
                Marquer comme suivi
              </button>
            ) : (
              <span className="insight-card__resolved-tag insight-card__resolved-tag--muted">
                <span className="insight-card__resolved-check">✓</span> Suivi
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default InsightCard;
