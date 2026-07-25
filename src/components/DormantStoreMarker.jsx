import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import { getDormantIcon } from '../utils/mapIcons';
import { useStoreMetrics } from '../hooks/useStoreMetrics';
import StoreTooltipContent from './StoreTooltipContent';

function DormantStoreMarker({ store, isVisited, isRowHighlighted, onHover, onLeave, onClick }) {
  const icon = useMemo(
    () => getDormantIcon(store.code, isVisited, isRowHighlighted),
    [store.code, isVisited, isRowHighlighted],
  );

  const metrics = useStoreMetrics(store);

  return (
    <Marker
      position={[store.lat, store.lon]}
      icon={icon}
      eventHandlers={{
        click: () => onClick(store.code),
        mouseover: () => onHover(store.code),
        mouseout: () => onLeave(),
      }}
    >
      <Tooltip direction="top" offset={[0, -12]} opacity={1} className="leaflet-store-tooltip">
        <StoreTooltipContent store={store} isConnected={false} metrics={metrics} />
      </Tooltip>
    </Marker>
  );
}

export default DormantStoreMarker;
