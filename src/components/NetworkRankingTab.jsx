import { useMemo, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useDevices } from '../context/DevicesContext';
import { useInsights } from '../context/InsightsContext';
import { useTicker } from '../hooks/useTicker';
import { useStoreMetricsMap } from '../hooks/useStoreMetricsMap';
import { useBenchmarkPercentileMap } from '../hooks/useBenchmarkPercentileMap';
import {
  getClimateAdjustedCostPerVisitor,
  getCurrentHealthScore,
  getStoreClimateZone,
  getStoreTrendPct,
  CLIMATE_ZONES,
  MAJOR_VILLES,
} from '../utils/metricsEngine';
import { formatNumberFR, getStoreShortName } from '../utils/format';
import './NetworkRankingTab.css';

const MIN_STORES_FOR_BADGES = 6;
const BADGE_COUNT = 3;

const VILLE_FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'major', label: 'Grandes villes' },
  { id: 'other', label: 'Autres villes' },
];

const CLIMATE_MODE_OPTIONS = [
  { id: 'brut', label: 'Classement brut' },
  { id: 'adjusted', label: 'Classement ajusté au climat' },
];

const COLUMNS = [
  { key: 'health', label: 'Score de santé' },
  { key: 'savings', label: 'Économie mensuelle' },
  { key: 'trend', label: 'Tendance' },
  { key: 'costPerVisitor', label: 'Coût/visiteur' },
  { key: 'percentile', label: 'Rang régional' },
];

function NetworkRankingTab() {
  const { allStores, connectedCodes, connectedAt, openStoreFromNetworkOverlay } = useNetwork();
  const { getDeviceState } = useDevices();
  const { getStoreImpact } = useInsights();
  const [sortKey, setSortKey] = useState('health');
  const [sortDir, setSortDir] = useState('desc');
  const [villeFilter, setVilleFilter] = useState('all');
  const [climateMode, setClimateMode] = useState('brut');

  const tick = useTicker(800);

  const connectedStores = useMemo(
    () => allStores.filter((store) => connectedCodes.includes(store.code)),
    [allStores, connectedCodes],
  );
  const metricsByCode = useStoreMetricsMap(connectedStores);
  const percentileByCode = useBenchmarkPercentileMap(connectedStores, allStores);

  const rows = useMemo(() => {
    const built = connectedStores.map((store) => {
      const impact = getStoreImpact(store, getDeviceState(store).discoveredIds);
      const metrics = metricsByCode.get(store.code);
      return {
        code: store.code,
        store,
        isMajor: MAJOR_VILLES.includes(store.ville),
        healthScore: getCurrentHealthScore(store, connectedAt[store.code], impact.healthBonus),
        monthlySavings: metrics.monthlySavingsTND + impact.extraSavingsTND,
        costPerVisitor: metrics.costPerVisitorTND,
        adjustedCostPerVisitor: getClimateAdjustedCostPerVisitor(store),
        climateZone: getStoreClimateZone(store),
        percentile: percentileByCode.get(store.code).percentile,
        trendPct: getStoreTrendPct(store),
      };
    });

    const byHealthDesc = [...built].sort((a, b) => b.healthScore - a.healthScore);
    const healthRankByCode = new Map(byHealthDesc.map((row, index) => [row.code, index + 1]));
    return built.map((row) => ({ ...row, healthRank: healthRankByCode.get(row.code) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedStores, metricsByCode, percentileByCode, connectedAt, getStoreImpact, getDeviceState, tick]);

  const filteredRows = useMemo(() => {
    if (villeFilter === 'major') return rows.filter((row) => row.isMajor);
    if (villeFilter === 'other') return rows.filter((row) => !row.isMajor);
    return rows;
  }, [rows, villeFilter]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const dir = sortDir === 'asc' ? 1 : -1;
    const costKey = climateMode === 'adjusted' ? 'adjustedCostPerVisitor' : 'costPerVisitor';
    copy.sort((a, b) => {
      if (sortKey === 'health') return (a.healthScore - b.healthScore) * dir;
      if (sortKey === 'savings') return (a.monthlySavings - b.monthlySavings) * dir;
      if (sortKey === 'trend') return (a.trendPct - b.trendPct) * dir;
      if (sortKey === 'costPerVisitor') return (a[costKey] - b[costKey]) * dir;
      if (sortKey === 'percentile') return (a.percentile - b.percentile) * dir;
      return 0;
    });
    return copy;
  }, [filteredRows, sortKey, sortDir, climateMode]);

  const showBadges = rows.length >= MIN_STORES_FOR_BADGES;

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleRowClick = (code) => {
    openStoreFromNetworkOverlay(code, { tab: 'intelligence' });
  };

  if (rows.length === 0) {
    return <p className="network-ranking-tab__empty">Aucun magasin connecté.</p>;
  }

  return (
    <div className="network-ranking-tab">
      <div className="network-ranking-tab__climate-toggle" role="group" aria-label="Mode de classement">
        {CLIMATE_MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`network-ranking-tab__filter-btn ${climateMode === option.id ? 'is-active' : ''}`}
            onClick={() => setClimateMode(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {climateMode === 'adjusted' && (
        <p className="network-ranking-tab__climate-note">
          Le coût/visiteur est divisé par le facteur de la zone climatique du magasin, pour ne pas pénaliser un
          magasin uniquement parce qu&rsquo;il est dans une zone plus chaude.{' '}
          {CLIMATE_ZONES.map((zone, index) => (
            <span key={zone.id}>
              {index > 0 ? ' · ' : ''}
              <strong>{zone.label}</strong> ×{zone.factor.toFixed(2)}
            </span>
          ))}
        </p>
      )}

      <div className="network-ranking-tab__filters" role="group" aria-label="Filtrer par type de ville">
        {VILLE_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`network-ranking-tab__filter-btn ${villeFilter === filter.id ? 'is-active' : ''}`}
            onClick={() => setVilleFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="network-ranking-tab__table-wrapper">
      <table className="network-ranking-tab__table">
        <thead>
          <tr>
            <th className="network-ranking-tab__th">Rang</th>
            <th className="network-ranking-tab__th">Magasin</th>
            <th className="network-ranking-tab__th">Ville</th>
            <th className="network-ranking-tab__th">Zone climatique</th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="network-ranking-tab__th network-ranking-tab__th--sortable"
                onClick={() => handleSort(col.key)}
              >
                {col.key === 'costPerVisitor' && climateMode === 'adjusted' ? 'Coût/visiteur (ajusté climat)' : col.label}
                {sortKey === col.key && <span className="network-ranking-tab__sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const isTop3 = showBadges && row.healthRank <= BADGE_COUNT;
            const isBottom3 = showBadges && row.healthRank > rows.length - BADGE_COUNT;
            const displayedCostPerVisitor =
              climateMode === 'adjusted' ? row.adjustedCostPerVisitor : row.costPerVisitor;
            return (
              <tr
                key={row.code}
                className="network-ranking-tab__row"
                onClick={() => handleRowClick(row.code)}
              >
                <td className="network-ranking-tab__td">#{row.healthRank}</td>
                <td className="network-ranking-tab__td network-ranking-tab__td--name">
                  {getStoreShortName(row.store)}
                  {isTop3 && <span className="network-ranking-tab__badge network-ranking-tab__badge--good">★ Meilleure pratique</span>}
                  {isBottom3 && <span className="network-ranking-tab__badge network-ranking-tab__badge--warn">⚠ Attention requise</span>}
                </td>
                <td className="network-ranking-tab__td">{row.store.ville}</td>
                <td className="network-ranking-tab__td">
                  <span
                    className="network-ranking-tab__zone-tag"
                    title={`Facteur climatique appliqué en mode ajusté : ×${row.climateZone.factor.toFixed(2)}`}
                  >
                    {row.climateZone.label} ×{row.climateZone.factor.toFixed(2)}
                  </span>
                </td>
                <td className="network-ranking-tab__td">{Math.round(row.healthScore)}</td>
                <td className="network-ranking-tab__td">{formatNumberFR(row.monthlySavings)} TND</td>
                <td className="network-ranking-tab__td">
                  <span className={`network-ranking-tab__trend ${row.trendPct >= 0 ? 'is-up' : 'is-down'}`}>
                    {row.trendPct >= 0 ? '▲' : '▼'} {Math.abs(row.trendPct)}%
                  </span>
                </td>
                <td className="network-ranking-tab__td">{displayedCostPerVisitor.toFixed(2)} TND</td>
                <td className="network-ranking-tab__td">Top {row.percentile}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default NetworkRankingTab;
