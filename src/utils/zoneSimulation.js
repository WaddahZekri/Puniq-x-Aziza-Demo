import { mulberry32, seedFromCode } from './metricsEngine';

// Deterministic starting point for each store's retail-zone readings —
// the live dashboard then drifts these client-side (see useDriftingValue).
export function getZoneBaselines(store) {
  const rng = mulberry32(seedFromCode(`zones-${store.code}`));
  const hasSolar = rng() > 0.6;

  return {
    refrigeration: {
      tempC: 2 + rng() * 3,
    },
    climatisation: {
      setpointC: 22 + rng() * 2,
      actualC: 22 + rng() * 2,
      humidityPct: 45 + rng() * 15,
    },
    eclairage: {
      pctLit: 70 + rng() * 25,
      consumptionKw: 3 + rng() * 4,
    },
    caisses: {
      active: 2 + Math.floor(rng() * 4),
      standby: 1 + Math.floor(rng() * 3),
    },
    solaire: {
      installed: hasSolar,
      kwhGenerated: hasSolar ? 8 + rng() * 20 : 0,
    },
  };
}
