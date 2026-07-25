import { useMemo, useState } from 'react';
import { useDevices } from '../context/DevicesContext';
import { useTicker } from '../hooks/useTicker';
import {
  getStoreDevices,
  getProtocolColorVar,
  getRadarPosition,
  getDiscoveryScanResult,
  PROTOCOLS,
} from '../utils/deviceModel';
import LockedTabState from './LockedTabState';
import './StoreOverlayDiscoveryTab.css';

const SCAN_DURATION_MS = 2400;
const NEW_TAG_DURATION_MS = 8000;

function StoreOverlayDiscoveryTab({ store, isConnected, onConnect }) {
  const { getDeviceState, discoverNextDevices } = useDevices();
  const [isScanning, setIsScanning] = useState(false);

  // "Nouveau" tags and the radar/list ordering depend on elapsed time since
  // discovery, not just on state changes, so this needs to keep ticking.
  useTicker(1000);

  const { visibleDevices, undiscoveredPool } = useMemo(() => getStoreDevices(store), [store]);
  const deviceState = getDeviceState(store);

  const devicesById = useMemo(() => {
    const map = new Map();
    [...visibleDevices, ...undiscoveredPool].forEach((device) => map.set(device.id, device));
    return map;
  }, [visibleDevices, undiscoveredPool]);

  const discoveredDevices = deviceState.discoveredIds.map((id) => devicesById.get(id)).filter(Boolean);

  // Newest-discovered-first so a freshly found sensor slides in at the top.
  const sortedDevices = [...discoveredDevices].sort(
    (a, b) => (deviceState.discoveredAt[b.id] ?? 0) - (deviceState.discoveredAt[a.id] ?? 0),
  );

  const remainingCount = undiscoveredPool.filter((device) => !deviceState.discoveredIds.includes(device.id)).length;
  const isFullyDiscovered = remainingCount === 0;

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const count = getDiscoveryScanResult(store, remainingCount);
      discoverNextDevices(store, count);
      setIsScanning(false);
    }, SCAN_DURATION_MS);
  };

  if (!isConnected) {
    return (
      <LockedTabState
        message="La découverte de capteurs nécessite une connexion PUNIQ active sur ce magasin."
        onConnect={onConnect}
      />
    );
  }

  return (
    <div className="discovery-tab">
      <div className="discovery-tab__header">
        <h3 className="discovery-tab__count">{discoveredDevices.length} appareils détectés</h3>
        <span className="discovery-tab__live-badge">
          <span className="discovery-tab__live-dot" aria-hidden="true" />
          Live
        </span>
      </div>

      <div className="discovery-tab__main">
        <div className={`radar ${isScanning ? 'radar--scanning' : ''}`}>
          <div className="radar__ring radar__ring--1" />
          <div className="radar__ring radar__ring--2" />
          <div className="radar__ring radar__ring--3" />
          <div className="radar__sweep" />
          <div className="radar__center" />
          {discoveredDevices.map((device) => {
            const { xPct, yPct } = getRadarPosition(device.id);
            const colorVar = getProtocolColorVar(device.protocol);
            return (
              <span
                key={device.id}
                className="radar__dot"
                style={{ left: `${xPct}%`, top: `${yPct}%`, background: `var(${colorVar})` }}
                title={device.name}
              />
            );
          })}
        </div>

        <div className="discovery-tab__list-panel">
          {sortedDevices.length === 0 ? (
            <p className="discovery-tab__empty">Aucun appareil détecté pour l&rsquo;instant.</p>
          ) : (
            <div className="discovery-tab__list">
              {sortedDevices.map((device) => {
                const discoveredAt = deviceState.discoveredAt[device.id];
                const isNew = typeof discoveredAt === 'number' && Date.now() - discoveredAt < NEW_TAG_DURATION_MS;
                const colorVar = getProtocolColorVar(device.protocol);
                return (
                  <div className="discovery-tab__row" key={device.id}>
                    <div className="discovery-tab__row-main">
                      <span className="discovery-tab__row-name">
                        {device.name}
                        {isNew && <span className="discovery-tab__new-tag">Nouveau</span>}
                      </span>
                      <span className="discovery-tab__row-zone">{device.zoneLabel}</span>
                    </div>
                    <span
                      className="discovery-tab__row-protocol"
                      style={{ color: `var(${colorVar})`, borderColor: `var(${colorVar})` }}
                    >
                      {device.protocol}
                    </span>
                    <span className="discovery-tab__row-status">
                      <span className="discovery-tab__status-dot" aria-hidden="true" />
                      Streaming data
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className="discovery-tab__scan-btn"
        onClick={handleScan}
        disabled={isScanning || isFullyDiscovered}
      >
        {isFullyDiscovered
          ? 'Tous les capteurs disponibles ont été détectés'
          : isScanning
            ? 'Recherche en cours…'
            : 'Rechercher de nouveaux capteurs'}
      </button>

      <div className="discovery-tab__protocols">
        {PROTOCOLS.map((protocol) => {
          const colorVar = getProtocolColorVar(protocol);
          return (
            <span
              key={protocol}
              className="discovery-tab__protocol-badge"
              style={{ color: `var(${colorVar})`, borderColor: `var(${colorVar})` }}
            >
              {protocol}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default StoreOverlayDiscoveryTab;
