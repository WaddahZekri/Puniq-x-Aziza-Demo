import { useMemo } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { getPortfolioCapExForecast } from '../utils/metricsEngine';
import { formatNumberFR, getStoreLabel } from '../utils/format';
import './NetworkCapExTab.css';

function formatRemainingLife(months) {
  if (months <= 0) return "fin de vie atteinte";
  if (months === 1) return '1 mois';
  return `${months} mois`;
}

function NetworkCapExTab() {
  const { allStores, connectedCodes, openStoreFromNetworkOverlay } = useNetwork();

  const { items, totalExposureTND } = useMemo(
    () => getPortfolioCapExForecast(allStores, connectedCodes),
    [allStores, connectedCodes],
  );

  const handleRowClick = (item) => {
    const focusInsightId = `insight-${item.store.code}-capex_risk-${item.equipment.id}`;
    openStoreFromNetworkOverlay(item.store.code, { tab: 'intelligence', focusInsightId });
  };

  if (items.length === 0) {
    return (
      <p className="network-capex-tab__empty">
        Aucun équipement dans la fenêtre de prévision CapEx (12 mois) sur les magasins connectés pour l&rsquo;instant.
      </p>
    );
  }

  return (
    <div className="network-capex-tab">
      <div className="network-capex-tab__summary">
        <p className="network-capex-tab__summary-label">Exposition CapEx totale — prochains 12 mois</p>
        <p className="network-capex-tab__summary-value">{formatNumberFR(totalExposureTND)} TND</p>
        <p className="network-capex-tab__summary-caption">
          {items.length} équipement{items.length > 1 ? 's' : ''} à budgéter sur les magasins connectés, borne
          haute des fourchettes de remplacement estimées.
        </p>
      </div>

      <div className="network-capex-tab__table-wrapper">
        <table className="network-capex-tab__table">
          <thead>
            <tr>
              <th className="network-capex-tab__th">Magasin</th>
              <th className="network-capex-tab__th">Équipement</th>
              <th className="network-capex-tab__th">Durée de vie restante</th>
              <th className="network-capex-tab__th">Coût de remplacement estimé</th>
              <th className="network-capex-tab__th">Trimestre recommandé</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={`${item.store.code}-${item.equipment.id}`}
                className={`network-capex-tab__row ${item.equipment.isAtRisk ? 'is-urgent' : ''}`}
                onClick={() => handleRowClick(item)}
              >
                <td className="network-capex-tab__td">{getStoreLabel(item.store)}</td>
                <td className="network-capex-tab__td">{item.equipment.label}</td>
                <td className="network-capex-tab__td">
                  <span className={`network-capex-tab__life ${item.equipment.isAtRisk ? 'is-urgent' : ''}`}>
                    {formatRemainingLife(item.equipment.remainingLifeMonths)}
                  </span>
                </td>
                <td className="network-capex-tab__td">
                  {formatNumberFR(item.equipment.replacementCostRangeTND[0])}–
                  {formatNumberFR(item.equipment.replacementCostRangeTND[1])} TND
                </td>
                <td className="network-capex-tab__td">{item.equipment.recommendedQuarter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default NetworkCapExTab;
