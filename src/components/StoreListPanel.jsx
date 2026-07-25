import { useEffect, useMemo, useRef, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useStoreSeverityMap } from '../hooks/useStoreSeverityMap';
import { getStoreShortName } from '../utils/format';
import StoreListRow from './StoreListRow';
import './StoreListPanel.css';

function StoreListPanel({ hoveredCode, onRowHover, onRowLeave, onRowClick, onOpenOverlay }) {
  const { allStores, connectedCodes, activeStoreCode } = useNetwork();
  const severityMap = useStoreSeverityMap();
  const [query, setQuery] = useState('');
  const listRef = useRef(null);

  const connectedSet = useMemo(() => new Set(connectedCodes), [connectedCodes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allStores;
    return allStores.filter(
      (store) => getStoreShortName(store).toLowerCase().includes(q) || store.ville.toLowerCase().includes(q),
    );
  }, [allStores, query]);

  const connectedStores = useMemo(
    () => filtered.filter((store) => connectedSet.has(store.code)),
    [filtered, connectedSet],
  );
  const otherStores = useMemo(
    () => filtered.filter((store) => !connectedSet.has(store.code)),
    [filtered, connectedSet],
  );

  // Scrolls to and highlights whichever store is currently active (overlay
  // open) or hovered (from either the map or this list), map or list side.
  useEffect(() => {
    const codeToReveal = activeStoreCode || hoveredCode;
    if (!codeToReveal || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-store-code="${codeToReveal}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [hoveredCode, activeStoreCode]);

  return (
    <div className="store-list-panel">
      <input
        type="text"
        className="store-list-panel__search"
        placeholder="Rechercher un magasin ou une ville…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="store-list-panel__scroll" ref={listRef}>
        {connectedStores.length > 0 && (
          <>
            <p className="store-list-panel__group-label">Connectés</p>
            {connectedStores.map((store) => (
              <StoreListRow
                key={store.code}
                store={store}
                isConnected
                isActive={activeStoreCode === store.code}
                isHighlighted={hoveredCode === store.code}
                severity={severityMap.get(store.code) ?? 'none'}
                onRowClick={() => onRowClick(store)}
                onOpenOverlay={() => onOpenOverlay(store.code)}
                onMouseEnter={() => onRowHover(store.code)}
                onMouseLeave={onRowLeave}
              />
            ))}
          </>
        )}

        {otherStores.length > 0 && <p className="store-list-panel__group-label">Réseau</p>}
        {otherStores.map((store) => (
          <StoreListRow
            key={store.code}
            store={store}
            isConnected={false}
            isActive={activeStoreCode === store.code}
            isHighlighted={hoveredCode === store.code}
            onRowClick={() => onRowClick(store)}
            onOpenOverlay={() => onOpenOverlay(store.code)}
            onMouseEnter={() => onRowHover(store.code)}
            onMouseLeave={onRowLeave}
          />
        ))}

        {filtered.length === 0 && <p className="store-list-panel__empty">Aucun magasin ne correspond.</p>}
      </div>
    </div>
  );
}

export default StoreListPanel;
