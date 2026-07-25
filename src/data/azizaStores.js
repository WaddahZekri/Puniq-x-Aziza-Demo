import rawStores from './aziza_stores.json';
import { mulberry32, seedFromCode } from '../utils/metricsEngine';

// aziza_stores.json already ships `code` and `storename` directly (unlike
// the Monoprix dataset this app originally shipped with, which only had a
// `nom` field and needed a derived slug) — so no identifier remapping is
// needed here. It does not include `directeur` or `tel`, though, so those
// are generated deterministically below, seeded from each store's code like
// every other per-store figure in this app (see metricsEngine.js).

const LAST_NAMES = [
  'Kammoun', 'Bounab', 'Ben Zayed', 'Naily', 'Seddik', 'Rzem', 'Mahmoudi', 'Ben Chaabane',
  'Khairi', 'Missaoui', 'Trabelsi', 'Boubaker', 'Khalfaoui', 'Landolsi', 'Ayadhi', 'Ben Salah',
  'Gharbi', 'Jaziri', 'Kacem', 'Larbi', 'Mejri', 'Nasri', 'Ouali', 'Rekik',
  'Sassi', 'Tlili', 'Werfelli', 'Yahyaoui', 'Zouari', 'Abidi', 'Bouazizi', 'Chatti',
  'Dhaouadi', 'Elloumi', 'Fejjari', 'Guesmi', 'Hammami', 'Jendoubi', 'Kefi', 'Bayoudh',
];

const FIRST_NAMES = [
  'Mehrez', 'Hamdi', 'Ammar', 'Yaacoub', 'Ghazi', 'Samir', 'Najeh', 'Nizar',
  'Abdelhamid', 'Hmayed', 'Salem', 'Chaker', 'Mohamed', 'Mustapha', 'Karim', 'Walid',
  'Fadhel', 'Anis', 'Bilel', 'Chokri', 'Faycal', 'Hedi', 'Imed', 'Jalel',
  'Khalil', 'Lotfi', 'Mondher', 'Nabil', 'Omar', 'Radhouane', 'Sami', 'Tarek',
  'Yassine', 'Zied', 'Adel', 'Fares',
];

function directorFor(code) {
  const rng = mulberry32(seedFromCode(`directeur-${code}`));
  const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  return `${lastName} ${firstName}`;
}

// Sequential 8-digit numbers under the Tunisian "70" mobile prefix, mirroring
// the plain sequential block the Monoprix dataset used (e.g. 31342701,
// 31342702, ...) — just derived from each store's own code so it stays
// unique without a separate counter.
function telFor(code) {
  const digits = `70${String(code).padStart(6, '0')}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
}

const azizaStores = rawStores.map((store) => ({
  ...store,
  directeur: directorFor(store.code),
  tel: telFor(store.code),
}));

export default azizaStores;
