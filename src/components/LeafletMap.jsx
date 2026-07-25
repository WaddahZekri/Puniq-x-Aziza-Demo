import { useEffect, useMemo } from 'react';
import { MapContainer, Pane, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useNetwork } from '../context/NetworkContext';
import { useStoreSeverityMap } from '../hooks/useStoreSeverityMap';
import { useHighlightOnConnect } from '../hooks/useHighlightOnConnect';
import { createClusterIcon, createConnectedClusterIcon } from '../utils/mapIcons';
import ConnectedStoreMarker from './ConnectedStoreMarker';
import DormantStoreMarker from './DormantStoreMarker';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import './LeafletMap.css';

const INITIAL_CENTER = [34.5, 9.5];
const INITIAL_ZOOM = 7;
const MIN_ZOOM = 6;
const MAX_ZOOM = 18;
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO';
const FLY_TO_ZOOM = 14;
// Leaflet.markercluster defaults to 80px, which merges dense regions
// (Tunis/Sousse/Sfax) into one dominant mega-cluster. A much tighter radius
// only groups markers that are nearly on top of each other, so most stores
// show as their own pin even in dense regions and at the initial zoom.
const MAX_CLUSTER_RADIUS = 22;
// Beyond this zoom (roughly governorate/city level), stop clustering
// altogether — every store renders as its own marker.
const DISABLE_CLUSTERING_AT_ZOOM = 12;
// Leaflet's default marker pane sits at z-index 600 — this dedicated pane
// keeps connected stores (individual markers AND cluster bubbles) painting
// above the dormant layer regardless of DOM re-render order.
const CONNECTED_PANE_NAME = 'connected-stores-pane';
const CONNECTED_PANE_Z_INDEX = 650;
// Urgent (red) stores are never clustered and must always sit above every
// cluster bubble/marker on the map, at any zoom — a dedicated top pane
// guarantees that regardless of paint order or proximity to other stores.
const URGENT_PANE_NAME = 'urgent-stores-pane';
const URGENT_PANE_Z_INDEX = 700;
const URGENT_Z_INDEX_OFFSET = 1000;

const ResetControl = L.Control.extend({
  options: { position: 'topleft' },
  onAdd(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar puniq-reset-control');
    const button = L.DomUtil.create('a', 'puniq-reset-control__button', container);
    button.href = '#';
    button.title = 'Réinitialiser la vue';
    button.setAttribute('aria-label', 'Réinitialiser la vue');
    button.innerHTML = '⟲';
    L.DomEvent.on(button, 'click', (event) => {
      L.DomEvent.stop(event);
      map.setView(INITIAL_CENTER, INITIAL_ZOOM);
    });
    return container;
  },
});

function MapControls() {
  const map = useMap();

  useEffect(() => {
    const control = new ResetControl();
    control.addTo(map);
    return () => control.remove();
  }, [map]);

  return null;
}

function FlyToController({ flyToRequest }) {
  const map = useMap();

  useEffect(() => {
    if (!flyToRequest) return;
    map.flyTo([flyToRequest.lat, flyToRequest.lon], FLY_TO_ZOOM, { duration: 1.2 });
    // Re-fires on every request (keyed by nonce), even to the same coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToRequest]);

  return null;
}

function LeafletMap({ hoveredCode, onMarkerHover, onMarkerLeave, onMarkerClick, flyToRequest }) {
  const { allStores, connectedCodes, visitedCodes } = useNetwork();
  const severityMap = useStoreSeverityMap();
  const highlightCode = useHighlightOnConnect(connectedCodes);

  const connectedSet = useMemo(() => new Set(connectedCodes), [connectedCodes]);
  const visitedSet = useMemo(() => new Set(visitedCodes), [visitedCodes]);

  const connectedStores = useMemo(
    () => allStores.filter((store) => connectedSet.has(store.code)),
    [allStores, connectedSet],
  );
  const dormantStores = useMemo(
    () => allStores.filter((store) => !connectedSet.has(store.code)),
    [allStores, connectedSet],
  );

  // Urgent (red) stores must never be merged into a cluster bubble's count,
  // at any zoom — they're rendered as standalone markers in their own pane
  // (below) instead of being handed to the connected MarkerClusterGroup.
  const urgentStores = useMemo(
    () => connectedStores.filter((store) => severityMap.get(store.code) === 'urgent'),
    [connectedStores, severityMap],
  );
  const clusterableConnectedStores = useMemo(
    () => connectedStores.filter((store) => severityMap.get(store.code) !== 'urgent'),
    [connectedStores, severityMap],
  );

  return (
    <div className="leaflet-map">
      <MapContainer
        center={INITIAL_CENTER}
        zoom={INITIAL_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        className="leaflet-map__container"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <MapControls />
        <FlyToController flyToRequest={flyToRequest} />

        <MarkerClusterGroup
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={MAX_CLUSTER_RADIUS}
          disableClusteringAtZoom={DISABLE_CLUSTERING_AT_ZOOM}
          zoomToBoundsOnClick
          spiderfyOnMaxZoom={false}
          showCoverageOnHover={false}
        >
          {dormantStores.map((store) => (
            <DormantStoreMarker
              key={store.code}
              store={store}
              isVisited={visitedSet.has(store.code)}
              isRowHighlighted={hoveredCode === store.code}
              onHover={onMarkerHover}
              onLeave={onMarkerLeave}
              onClick={onMarkerClick}
            />
          ))}
        </MarkerClusterGroup>

        <Pane name={CONNECTED_PANE_NAME} style={{ zIndex: CONNECTED_PANE_Z_INDEX }}>
          <MarkerClusterGroup
            iconCreateFunction={createConnectedClusterIcon}
            clusterPane={CONNECTED_PANE_NAME}
            maxClusterRadius={MAX_CLUSTER_RADIUS}
            disableClusteringAtZoom={DISABLE_CLUSTERING_AT_ZOOM}
            zoomToBoundsOnClick
            spiderfyOnMaxZoom={false}
            showCoverageOnHover={false}
          >
            {clusterableConnectedStores.map((store) => (
              <ConnectedStoreMarker
                key={store.code}
                store={store}
                isVisited={visitedSet.has(store.code)}
                isHighlighted={highlightCode === store.code}
                isRowHighlighted={hoveredCode === store.code}
                severity={severityMap.get(store.code) ?? 'none'}
                onHover={onMarkerHover}
                onLeave={onMarkerLeave}
                onClick={onMarkerClick}
              />
            ))}
          </MarkerClusterGroup>
        </Pane>

        {/* Urgent stores render outside any MarkerClusterGroup, in a pane
            above everything else, so they're always individually visible —
            never folded into a cluster's count regardless of zoom or how
            close they sit to other stores. */}
        <Pane name={URGENT_PANE_NAME} style={{ zIndex: URGENT_PANE_Z_INDEX }}>
          {urgentStores.map((store) => (
            <ConnectedStoreMarker
              key={store.code}
              store={store}
              isVisited={visitedSet.has(store.code)}
              isHighlighted={highlightCode === store.code}
              isRowHighlighted={hoveredCode === store.code}
              severity="urgent"
              zIndexOffset={URGENT_Z_INDEX_OFFSET}
              onHover={onMarkerHover}
              onLeave={onMarkerLeave}
              onClick={onMarkerClick}
            />
          ))}
        </Pane>
      </MapContainer>
    </div>
  );
}

export default LeafletMap;
