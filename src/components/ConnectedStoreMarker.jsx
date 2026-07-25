import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import { getConnectedIcon } from '../utils/mapIcons';
import { useStoreMetrics } from '../hooks/useStoreMetrics';
import StoreTooltipContent from './StoreTooltipContent';

function ConnectedStoreMarker({
  store,
  isVisited,
  isHighlighted,
  isRowHighlighted,
  severity,
  zIndexOffset,
  onHover,
  onLeave,
  onClick,
}) {
  const icon = useMemo(
    () => getConnectedIcon(store.code, isVisited, isHighlighted, isRowHighlighted, severity),
    [store.code, isVisited, isHighlighted, isRowHighlighted, severity],
  );

  const metrics = useStoreMetrics(store);

  return (
    <Marker
      position={[store.lat, store.lon]}
      icon={icon}
      zIndexOffset={zIndexOffset}
      eventHandlers={{
        click: () => onClick(store.code),
        mouseover: () => onHover(store.code),
        mouseout: () => onLeave(),
      }}
    >
      <Tooltip direction="top" offset={[0, -16]} opacity={1} className="leaflet-store-tooltip">
        <StoreTooltipContent store={store} isConnected metrics={metrics} />
      </Tooltip>
    </Marker>
  );
}

export default ConnectedStoreMarker;
