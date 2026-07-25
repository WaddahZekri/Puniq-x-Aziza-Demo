import { formatNumberFR, getStoreLabel } from '../utils/format';
import './StoreTooltipContent.css';

function StoreTooltipContent({ store, isConnected, metrics }) {
  return (
    <div className="store-tooltip-content">
      <p className="store-tooltip-content__title">{getStoreLabel(store)}</p>
      {isConnected ? (
        <>
          <p className="store-tooltip-content__status store-tooltip-content__status--connected">
            🔴 Connecté PUNIQ
          </p>
          <p className="store-tooltip-content__metric">
            Économie ce mois :{' '}
            <span className="store-tooltip-content__amount">{formatNumberFR(metrics.monthlySavingsTND)} TND</span>
          </p>
        </>
      ) : (
        <>
          <p className="store-tooltip-content__status">⚪ Non connecté</p>
          <p className="store-tooltip-content__metric">
            Potentiel estimé :{' '}
            <span className="store-tooltip-content__amount">
              ~{formatNumberFR(metrics.monthlySavingsTND)} TND/mois
            </span>
          </p>
        </>
      )}
    </div>
  );
}

export default StoreTooltipContent;
