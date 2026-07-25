// Shared device inventory model — Discovery and Dashboard both read from
// this single source of truth instead of maintaining two independent mock
// UIs. `visibleDevices` are the sensors PUNIQ already streams from day one
// (one device per existing unit/climate zone/lighting circuit/logistics
// sensor); `undiscoveredPool` are additional, plausible sensors on those
// SAME departments/zones that the story frames as "not found yet" — the
// Discovery tab's job is to reveal them one at a time.
import {
  mulberry32,
  seedFromCode,
  shuffleDeterministic,
  getStoreDepartments,
  getLogisticsZones,
} from './metricsEngine';
import { getZoneBaselines } from './zoneSimulation';

export const PROTOCOLS = ['Modbus RTU', 'BACnet', 'KNX', 'MQTT'];

const PROTOCOL_COLOR_VAR = {
  'Modbus RTU': '--protocol-modbus',
  BACnet: '--protocol-bacnet',
  KNX: '--protocol-knx',
  MQTT: '--protocol-mqtt',
};

export function getProtocolColorVar(protocol) {
  return PROTOCOL_COLOR_VAR[protocol] ?? '--text-muted';
}

function pickProtocol(seedStr) {
  const rng = mulberry32(seedFromCode(seedStr));
  return PROTOCOLS[Math.floor(rng() * PROTOCOLS.length)];
}

function buildVisibleDevices(store) {
  const departments = getStoreDepartments(store);
  const zones = getLogisticsZones(store);
  const baselines = getZoneBaselines(store);
  const devices = [];

  departments.forEach((dept) => {
    dept.units.forEach((unit) => {
      devices.push({
        id: unit.unitId,
        name: unit.name,
        protocol: pickProtocol(`protocol-${store.code}-${unit.unitId}`),
        department: dept.id,
        zoneLabel: dept.label,
        status: 'streaming',
        discoveredAt: 'initial',
      });
    });

    if (dept.climate) {
      devices.push({
        id: `climate-${dept.id}`,
        name: `Sonde climatisation — ${dept.label}`,
        protocol: pickProtocol(`protocol-${store.code}-climate-${dept.id}`),
        department: dept.id,
        zoneLabel: dept.label,
        status: 'streaming',
        discoveredAt: 'initial',
      });
    }

    devices.push({
      id: `lighting-${dept.id}`,
      name: `Circuit éclairage — ${dept.label}`,
      protocol: pickProtocol(`protocol-${store.code}-lighting-${dept.id}`),
      department: dept.id,
      zoneLabel: dept.label,
      status: 'streaming',
      discoveredAt: 'initial',
    });
  });

  zones.forEach((zone) => {
    devices.push({
      id: `zonetemp-${zone.id}`,
      name: `Sonde température — ${zone.label}`,
      protocol: pickProtocol(`protocol-${store.code}-zonetemp-${zone.id}`),
      department: null,
      zoneLabel: zone.label,
      status: 'streaming',
      discoveredAt: 'initial',
    });

    if (zone.hasDoorTracking) {
      devices.push({
        id: `zonedoor-${zone.id}`,
        name: `Détecteur d'ouverture — ${zone.label}`,
        protocol: pickProtocol(`protocol-${store.code}-zonedoor-${zone.id}`),
        department: null,
        zoneLabel: zone.label,
        status: 'streaming',
        discoveredAt: 'initial',
      });
    }
  });

  devices.push({
    id: 'caisses',
    name: 'Automate caisses',
    protocol: pickProtocol(`protocol-${store.code}-caisses`),
    department: null,
    zoneLabel: 'Infrastructure',
    status: 'streaming',
    discoveredAt: 'initial',
  });

  if (baselines.solaire.installed) {
    devices.push({
      id: 'solaire',
      name: 'Onduleur solaire',
      protocol: pickProtocol(`protocol-${store.code}-solaire`),
      department: null,
      zoneLabel: 'Infrastructure',
      status: 'streaming',
      discoveredAt: 'initial',
    });
  }

  return devices;
}

const READING_RANGES = {
  temp: { min: 0, max: 6, unit: '°C', decimals: 1 },
  climate: { min: 19, max: 23, unit: '°C consigne', decimals: 1 },
  lighting: { min: 60, max: 100, unit: '% allumé', decimals: 0 },
  humidity: { min: 40, max: 65, unit: '% humidité', decimals: 0 },
  water: { min: 60, max: 200, unit: ' L/j', decimals: 0 },
  power: { min: 15, max: 60, unit: ' kWh/j', decimals: 0 },
  co2: { min: 420, max: 900, unit: ' ppm', decimals: 0 },
};

function buildReading(seedStr, kind) {
  const range = READING_RANGES[kind];
  const rng = mulberry32(seedFromCode(seedStr));
  const value = range.min + rng() * (range.max - range.min);
  return `${value.toFixed(range.decimals)}${range.unit}`;
}

// Every candidate is an additional, plausible sensor on a department/zone
// this store already has — never a brand-new department. Not every
// candidate applies to every store (e.g. a "secondary vitrine sensor" only
// makes sense for refrigerated departments), so the pool is built from
// whichever candidates are actually valid for this store, then a
// deterministic subset (4-8) is kept.
function buildPoolCandidates(store) {
  const departments = getStoreDepartments(store);
  const zones = getLogisticsZones(store);
  const candidates = [];

  departments.forEach((dept) => {
    if (dept.refrigerated) {
      candidates.push({
        id: `pool-extra-unit-${dept.id}`,
        name: `Sonde secondaire — Vitrine ${dept.label}`,
        department: dept.id,
        zoneLabel: dept.label,
        readingKind: 'temp',
      });
    }
    if (dept.climate) {
      candidates.push({
        id: `pool-thermostat-${dept.id}`,
        name: `Thermostat redondant — Climatisation ${dept.label}`,
        department: dept.id,
        zoneLabel: dept.label,
        readingKind: 'climate',
      });
    }
    candidates.push({
      id: `pool-lighting2-${dept.id}`,
      name: `Circuit éclairage secondaire — ${dept.label}`,
      department: dept.id,
      zoneLabel: dept.label,
      readingKind: 'lighting',
    });
  });

  zones.forEach((zone) => {
    candidates.push({
      id: `pool-humidity-${zone.id}`,
      name: `Sonde humidité additionnelle — ${zone.label}`,
      department: null,
      zoneLabel: zone.label,
      readingKind: 'humidity',
    });
    if (zone.id === 'reserve') {
      candidates.push({
        id: 'pool-water-meter',
        name: 'Compteur d’eau — Réserve',
        department: null,
        zoneLabel: zone.label,
        readingKind: 'water',
      });
    }
  });

  candidates.push({
    id: 'pool-power-meter-2',
    name: 'Compteur électrique secondaire',
    department: null,
    zoneLabel: 'Infrastructure',
    readingKind: 'power',
  });
  candidates.push({
    id: 'pool-co2-caisses',
    name: 'Capteur CO2 — Zone caisses',
    department: null,
    zoneLabel: 'Infrastructure',
    readingKind: 'co2',
  });

  return candidates;
}

function buildUndiscoveredPool(store) {
  const candidates = buildPoolCandidates(store);
  const rng = mulberry32(seedFromCode(`devicepool-${store.code}`));
  const shuffled = shuffleDeterministic(candidates, rng);
  const poolCount = Math.min(shuffled.length, 4 + Math.floor(rng() * 5));

  return shuffled.slice(0, poolCount).map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    protocol: pickProtocol(`protocol-${store.code}-${candidate.id}`),
    department: candidate.department,
    zoneLabel: candidate.zoneLabel,
    status: 'pending',
    discoveredAt: null,
    reading: buildReading(`reading-${store.code}-${candidate.id}`, candidate.readingKind),
  }));
}

export function getStoreDevices(store) {
  return {
    visibleDevices: buildVisibleDevices(store),
    undiscoveredPool: buildUndiscoveredPool(store),
  };
}

// Deterministic "how many devices did this scan find" — seeded off the
// store code AND the current remainingCount, so successive scans on the
// same store (which naturally shrink remainingCount as devices get found)
// produce a fresh, reproducible outcome each time rather than the same
// answer forever. Same 1-or-2-capped-at-remaining distribution the inline
// Math.random() version used.
export function getDiscoveryScanResult(store, remainingCount) {
  const rng = mulberry32(seedFromCode(`scan-${store.code}-${remainingCount}`));
  return Math.min(remainingCount, 1 + Math.round(rng()));
}

// Deterministic per-device radar position (angle/radius), stable across
// re-renders since it's seeded by the device id, not by render count.
export function getRadarPosition(deviceId) {
  const rng = mulberry32(seedFromCode(`radar-${deviceId}`));
  const angle = rng() * Math.PI * 2;
  const radius = 18 + rng() * 32; // percentage of the radar's half-width, stays inside the outer ring
  return {
    xPct: 50 + radius * Math.cos(angle),
    yPct: 50 + radius * Math.sin(angle),
  };
}
