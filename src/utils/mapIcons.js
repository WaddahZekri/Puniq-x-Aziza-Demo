import L from 'leaflet';

const ICON_BOX = 30;

function buildClassName(parts) {
  return parts.filter(Boolean).join(' ');
}

// `severity` is 'none' | 'routine' | 'urgent' (see src/utils/severity.js) —
// drives the marker's color tier (blue/amber/red); defaults to 'none' so
// existing callers that don't pass it still render the healthy state.
export function getConnectedIcon(code, isVisited, isHighlighted, isRowHighlighted, severity = 'none') {
  // Urgent stores are always rendered as standalone markers (see
  // LeafletMap.jsx — they're excluded from the cluster group entirely), so
  // 'urgent' can double as the flag for the louder standalone glow/pulse
  // treatment without threading a separate prop through every caller.
  const isUrgentStandalone = severity === 'urgent';

  const className = buildClassName([
    'leaflet-store-marker',
    'leaflet-store-marker--connected',
    `leaflet-store-marker--severity-${severity}`,
    isUrgentStandalone ? 'leaflet-store-marker--urgent-standalone' : '',
    `store-code-${code}`,
    isVisited ? 'leaflet-store-marker--visited' : '',
    isHighlighted ? 'leaflet-store-marker--highlight' : '',
    isRowHighlighted ? 'leaflet-store-marker--row-hover' : '',
  ]);

  return L.divIcon({
    className,
    html: `
      <span class="leaflet-store-marker__glow"></span>
      ${isUrgentStandalone ? '<span class="leaflet-store-marker__glow--secondary"></span>' : ''}
      ${isVisited ? '<span class="leaflet-store-marker__ring"></span>' : ''}
      <span class="leaflet-store-marker__dot"></span>
    `,
    iconSize: [ICON_BOX, ICON_BOX],
    iconAnchor: [ICON_BOX / 2, ICON_BOX / 2],
  });
}

export function getDormantIcon(code, isVisited, isRowHighlighted) {
  const className = buildClassName([
    'leaflet-store-marker',
    'leaflet-store-marker--dormant',
    `store-code-${code}`,
    isVisited ? 'leaflet-store-marker--visited' : '',
    isRowHighlighted ? 'leaflet-store-marker--row-hover' : '',
  ]);

  return L.divIcon({
    className,
    html: `
      ${isVisited ? '<span class="leaflet-store-marker__ring leaflet-store-marker__ring--dormant"></span>' : ''}
      <span class="leaflet-store-marker__dot"></span>
    `,
    iconSize: [ICON_BOX, ICON_BOX],
    iconAnchor: [ICON_BOX / 2, ICON_BOX / 2],
  });
}

export function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 30 : count < 50 ? 38 : 46;

  return L.divIcon({
    html: `<div class="leaflet-cluster-icon">${count}</div>`,
    className: 'leaflet-cluster-icon-wrapper',
    iconSize: L.point(size, size),
  });
}

// Urgent (red) stores are pulled out of the cluster group entirely (see
// LeafletMap.jsx) before this ever runs, so a cluster's members are always
// blue and/or amber — we only need to check for the amber ('routine') tier
// to decide whether the bubble should read as "needs attention".
function clusterContainsRoutine(cluster) {
  return cluster
    .getAllChildMarkers()
    .some((marker) => marker.options.icon?.options?.className?.includes('leaflet-store-marker--severity-routine'));
}

export function createConnectedClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 34 : count < 50 ? 42 : 50;
  const isAmber = clusterContainsRoutine(cluster);

  return L.divIcon({
    html: `
      <span class="leaflet-cluster-icon__glow${isAmber ? ' leaflet-cluster-icon__glow--amber' : ''}"></span>
      <div class="leaflet-cluster-icon leaflet-cluster-icon--connected${isAmber ? ' leaflet-cluster-icon--connected-amber' : ''}">${count}</div>
    `,
    className: 'leaflet-cluster-icon-wrapper',
    iconSize: L.point(size, size),
  });
}
