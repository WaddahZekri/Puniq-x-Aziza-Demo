// Specific, plausible-sounding activity lines for the live feed — built from
// a pool of real department/zone/unit names combined with a randomized but
// realistic metric, so each line reads like actual telemetry rather than a
// generic rotating phrase. Not seeded on purpose — like the rest of the live
// feed, this is meant to feel spontaneous, unlike the deterministic per-store
// financial metrics used elsewhere.

const DEPARTMENTS = ['Boucherie', 'Épicerie', 'Fruits & Légumes', 'Surgelés', 'Crémerie'];
const REFRIGERATION_UNITS = [
  'Vitrine réfrigérée #1',
  'Vitrine réfrigérée #2',
  'Vitrine réfrigérée #3',
  'Chambre froide négative',
  'Chambre froide positive',
];
const COLD_ROOMS = ['Chambre froide négative', 'Chambre froide positive'];
const CLIMATE_ZONES = ['Zone Caisses', 'Zone Épicerie', "Zone d'entrée", 'Zone Réserve'];
const LIGHTING_ZONES = ['Allée centrale', 'Zone Caisses', 'Vitrine façade', 'Réserve'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

const EVENT_GENERATORS = [
  () => {
    const department = pick(DEPARTMENTS);
    const unit = pick(REFRIGERATION_UNITS);
    const tempDelta = randRange(0.2, 0.6).toFixed(1);
    const savings = roundToStep(randRange(90, 240), 10);
    return `${department}, ${unit} : écart stabilisé à ${tempDelta}°C, -${savings} TND/mois`;
  },
  () => {
    const unit = pick(COLD_ROOMS);
    const pct = Math.round(randRange(5, 12));
    return `${unit} : consommation nocturne réduite de ${pct}%`;
  },
  () => {
    const zone = pick(CLIMATE_ZONES);
    const savings = roundToStep(randRange(120, 320), 10);
    return `Climatisation ${zone} : ajustement planning, -${savings} TND/mois`;
  },
  () => {
    const zone = pick(LIGHTING_ZONES);
    const pct = Math.round(randRange(6, 18));
    return `Éclairage ${zone} : consommation réduite de ${pct}%`;
  },
  () => {
    const department = pick(DEPARTMENTS);
    const value = roundToStep(randRange(40, 150), 5);
    return `${department} : pic de consommation détecté, +${value} TND ce mois si non traité`;
  },
  () => {
    const count = Math.round(randRange(1, 3));
    return `Caisses : ${count} caisse${count > 1 ? 's' : ''} passée${count > 1 ? 's' : ''} en veille automatique`;
  },
];

export function generateActivityMessage() {
  return pick(EVENT_GENERATORS)();
}
