// Detailed, expert-level insight tickets for the Intelligence tab. Every
// card is deterministic (seeded by store code + template + target
// department/unit/zone), references an actual device this store has, and
// carries every field a real operations ticket would need: evidence,
// diagnosis, recommended action, and a quantified impact.
//
// Two distinct behaviors:
//  - CONTROLLABLE cards describe a remote configuration change (schedule,
//    setpoint, dimming) that PUNIQ's P2/P3 infrastructure can execute
//    directly — these carry an `adjustment` the apply flow uses to nudge
//    the store's actual metrics.
//  - ADVISORY cards describe a physical/mechanical issue that always
//    requires a human contractor — these never get an apply action, only
//    a "mark as followed up" dismissal with zero metric impact.
import {
  mulberry32,
  seedFromCode,
  shuffleDeterministic,
  getStoreDepartments,
  getLogisticsZones,
  getTOUCostBreakdown,
  getPeakShareInfo,
  getEquipmentLifecycle,
} from './metricsEngine';
import { getStoreShortName, formatNumberFR } from './format';

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function range(rng, min, max) {
  return min + rng() * (max - min);
}

// --- Controllable templates -------------------------------------------

function buildClimateScheduleShift(rng, dept) {
  const footfallLowPct = Math.round(range(rng, 12, 24));
  const gap = Math.abs(dept.climate.actualC - dept.climate.setpointC).toFixed(1);
  const pctImpact = Math.round(range(rng, 5, 9));
  const tndImpact = roundTo(range(rng, 150, 350), 10);
  const setpointDeltaC = Number(range(rng, 1, 1.5).toFixed(1));

  return {
    priority: 'Recommandé',
    title: `Optimisation planning climatisation — ${dept.label}`,
    evidence: [
      `Écart consigne/mesure actuel : ${gap}°C en heures creuses`,
      `Fréquentation moyenne durant ces heures : ${footfallLowPct}% de la capacité`,
    ],
    diagnosis: "Le planning de climatisation actuel ne s'ajuste pas à la fréquentation réelle du magasin.",
    recommendedAction:
      'Décaler le planning de climatisation pour réduire la puissance appliquée pendant les heures de faible affluence.',
    estimatedImpact: `Impact estimé : -${tndImpact} TND/mois, -${pctImpact}% de consommation sur cette zone`,
    tndImpact,
    pctImpact,
    measuredPctImpact: Number((pctImpact * range(rng, 0.75, 1.2)).toFixed(1)),
    healthBonus: 1 + Math.round(rng()),
    adjustment: { departmentId: dept.id, setpointDeltaC },
  };
}

function buildClimateSetpointOptim(rng, dept) {
  const extTemp = Math.round(range(rng, 27, 36));
  const pctImpact = Math.round(range(rng, 4, 8));
  const tndImpact = roundTo(range(rng, 120, 350), 10);
  const setpointDeltaC = Number(range(rng, 1, 2).toFixed(1));

  return {
    priority: 'Recommandé',
    title: `Optimisation du point de consigne — ${dept.label}`,
    evidence: [
      `Consigne actuelle : ${dept.climate.setpointC.toFixed(1)}°C, marge de confort autorisée : ±2°C`,
      `Température extérieure moyenne cette semaine : ${extTemp}°C`,
    ],
    diagnosis: "Le point de consigne n'exploite pas la marge de confort disponible pendant les heures creuses.",
    recommendedAction:
      'Ajuster le point de consigne de 1 à 2°C pendant les heures de faible affluence, dans la marge de confort.',
    estimatedImpact: `Impact estimé : -${tndImpact} TND/mois, -${pctImpact}% de consommation sur cette zone`,
    tndImpact,
    pctImpact,
    measuredPctImpact: Number((pctImpact * range(rng, 0.75, 1.2)).toFixed(1)),
    healthBonus: 1 + Math.round(rng()),
    adjustment: { departmentId: dept.id, setpointDeltaC },
  };
}

function buildLightingDimmingSchedule(rng, dept) {
  const pctImpact = Math.round(range(rng, 10, 18));
  const tndImpact = roundTo(range(rng, 80, 220), 10);
  const lightingPctDelta = -Math.round(range(rng, 15, 25));

  return {
    priority: 'Recommandé',
    title: `Réduction progressive de l'éclairage — ${dept.label}`,
    evidence: [
      `Taux d'allumage actuel : ${dept.lighting.pctLit}%, même hors pic de fréquentation`,
      `Consommation actuelle du circuit : ${dept.lighting.consumptionKw.toFixed(1)} kW`,
    ],
    diagnosis: "L'éclairage reste à pleine intensité même durant les heures creuses.",
    recommendedAction:
      "Programmer une réduction progressive de l'intensité lumineuse en dehors des heures de forte affluence.",
    estimatedImpact: `Impact estimé : -${tndImpact} TND/mois, -${pctImpact}% de consommation sur cette zone`,
    tndImpact,
    pctImpact,
    measuredPctImpact: Number((pctImpact * range(rng, 0.75, 1.2)).toFixed(1)),
    healthBonus: 1,
    adjustment: { departmentId: dept.id, lightingPctDelta },
  };
}

function buildLightingZoneShutdown(rng, dept) {
  const pctImpact = Math.round(range(rng, 15, 28));
  const tndImpact = roundTo(range(rng, 100, 280), 10);
  const lightingPctDelta = -Math.round(range(rng, 40, 60));

  return {
    priority: 'Recommandé',
    title: `Extinction automatique — ${dept.label} (hors horaires)`,
    evidence: [
      `Zones allumées actuellement : ${dept.lighting.pctLit}% en continu`,
      `Consommation hors horaires estimée : ${dept.lighting.consumptionKw.toFixed(1)} kW`,
    ],
    diagnosis: "Cette zone reste éclairée en dehors des horaires d'ouverture du magasin.",
    recommendedAction: "Activer l'extinction automatique complète de cette zone en dehors des horaires d'ouverture.",
    estimatedImpact: `Impact estimé : -${tndImpact} TND/mois, -${pctImpact}% de consommation sur cette zone`,
    tndImpact,
    pctImpact,
    measuredPctImpact: Number((pctImpact * range(rng, 0.75, 1.2)).toFixed(1)),
    healthBonus: 2,
    adjustment: { departmentId: dept.id, lightingPctDelta },
  };
}

// --- Advisory templates (never remotely executable) --------------------

function buildRefrigerationGasketWear(rng, dept, unit) {
  const cyclePct = Math.round(range(rng, 12, 28));
  const tndRisk = roundTo(range(rng, 250, 700), 10);

  return {
    priority: pick(rng, ['Urgent', 'Recommandé']),
    title: `Usure du joint de porte détectée — ${unit.name.split(' — ')[0]}, ${dept.label}`,
    evidence: [
      `Cycles de compresseur en hausse de ${cyclePct}% sur les 7 derniers jours`,
      `Température mesurée : ${unit.tempC.toFixed(1)}°C (plage normale : ${unit.tempRange[0]}–${unit.tempRange[1]}°C)`,
    ],
    diagnosis: "Le joint d'étanchéité de cette vitrine montre des signes d'usure, laissant entrer de l'air chaud.",
    recommendedAction: "Planifier une inspection et un remplacement du joint par un technicien agréé.",
    estimatedImpact: `Risque estimé si non traité : +${tndRisk} TND/mois de surconsommation, +${cyclePct}% de cycles compresseur`,
    tndRisk,
  };
}

function buildCompressorDriftWarning(rng, dept, unit) {
  const vibrationPct = Math.round(range(rng, 8, 22));
  const tndRisk = roundTo(range(rng, 800, 2200), 50);

  return {
    priority: 'Recommandé',
    title: `Signature vibratoire anormale — Compresseur, ${dept.label}`,
    evidence: [
      `Vibration moyenne en hausse de ${vibrationPct}% vs référence constructeur`,
      `Température de fonctionnement : ${unit.tempC.toFixed(1)}°C, stable mais proche de la limite haute`,
    ],
    diagnosis: "Le compresseur présente un profil d'usure mécanique nécessitant une inspection préventive.",
    recommendedAction: 'Faire intervenir un technicien pour une inspection préventive sous 30 jours.',
    estimatedImpact: `Risque estimé si non traité : panne complète possible, coût de remplacement ~${tndRisk} TND`,
    tndRisk,
  };
}

function buildFilterReplacementDue(rng, dept) {
  const pressurePct = Math.round(range(rng, 10, 25));
  const consumptionPct = Math.round(range(rng, 5, 14));
  const tndRisk = roundTo(range(rng, 100, 300), 10);

  return {
    priority: 'Recommandé',
    title: `Filtre à air encrassé détecté — Climatisation, ${dept.label}`,
    evidence: [
      `Écart de pression estimé : +${pressurePct}% vs seuil nominal`,
      `Consommation climatisation en hausse de ${consumptionPct}% sur 10 jours`,
    ],
    diagnosis: 'Le filtre à air restreint le flux, forçant le système à consommer davantage pour maintenir la consigne.',
    recommendedAction: 'Remplacer le filtre à air lors du prochain passage de maintenance.',
    estimatedImpact: `Risque estimé si non traité : +${tndRisk} TND/mois de surconsommation`,
    tndRisk,
  };
}

function buildDoorOpenFrequencyHigh(rng, zone) {
  const threshold = 4;
  const delta = (range(rng, 1.5, 4)).toFixed(1);
  const tndRisk = roundTo(range(rng, 80, 250), 10);

  return {
    priority: zone.doorOpenCountToday > threshold + 4 ? 'Urgent' : 'Informationnel',
    title: `Fréquence d'ouverture excessive — ${zone.label}`,
    evidence: [
      `${zone.doorOpenCountToday} ouvertures enregistrées aujourd'hui (seuil recommandé : ${threshold})`,
      `Température moyenne pendant les ouvertures : +${delta}°C au-dessus de la consigne`,
    ],
    diagnosis:
      "La porte de cette zone est ouverte plus fréquemment que recommandé, probablement un enjeu de process/formation des équipes.",
    recommendedAction:
      "Sensibiliser les équipes en zone logistique aux bonnes pratiques d'ouverture, ou installer une signalétique de rappel.",
    estimatedImpact: `Risque estimé si non traité : -${tndRisk} TND/mois en pertes énergétiques et risque produit accru`,
    tndRisk,
  };
}

// Not every peak-hour cost is shiftable (checkout lanes/lighting during
// business hours can't move), so only this fraction of the peak band's cost
// is treated as addressable — and only part of the saving from shifting it
// materializes, since STEG's peak tariff runs roughly 1.8-2x off-peak
// rather than a full swing to zero. Both are fixed, documented assumptions,
// same style as CO2_PER_TND_SPEND in NetworkSustainabilityTab.jsx.
const SHIFTABLE_PEAK_FRACTION = 0.2;
const PEAK_TO_OFFPEAK_SAVINGS_RATE = 0.45;

// Store-level (not department/unit-specific) — only generated as a
// candidate when getPeakShareInfo flags the store as disproportionately
// peak-exposed. Advisory rather than controllable: shifting load to
// off-peak hours is an operational/scheduling decision, not something
// PUNIQ's P2/P3 infrastructure can execute remotely on its own.
function buildPeakHourOptimization(rng, _target, _unit, store) {
  const peakBand = getTOUCostBreakdown(store).find((band) => band.id === 'pointe');
  const monthlyPeakCostTND = roundTo(peakBand.costTND * 30, 10);
  const tndRisk = roundTo(monthlyPeakCostTND * SHIFTABLE_PEAK_FRACTION * PEAK_TO_OFFPEAK_SAVINGS_RATE, 10);

  return {
    priority: 'Recommandé',
    title: `Optimisation heures de pointe — ${getStoreShortName(store)}`,
    departmentLabel: 'Ensemble du magasin',
    evidence: [
      `${peakBand.sharePct}% du coût énergétique quotidien tombe sur les heures de pointe (${peakBand.hours}), pour seulement 3h sur 24.`,
      `Coût mensuel estimé en heures de pointe : ${formatNumberFR(monthlyPeakCostTND)} TND.`,
    ],
    diagnosis:
      'Une part disproportionnée de la consommation de ce magasin se concentre sur la tranche tarifaire la plus chère.',
    recommendedAction:
      "Décaler les cycles non essentiels (dégivrage, pré-refroidissement, recharge d'équipements mobiles) vers les heures creuses ou pleines, là où c'est opérationnellement possible.",
    estimatedImpact: `Économie estimée : -${formatNumberFR(tndRisk)} TND/mois si la charge décalable est déplacée hors pointe`,
    tndRisk,
  };
}

// Store-level, one candidate per at-risk equipment item (see
// getEquipmentLifecycle's CAPEx_INSIGHT_THRESHOLD_MONTHS in metricsEngine.js
// — buildCandidates only generates this candidate for equipment already
// inside that 6-month window). Priority steps up from Informationnel to
// Recommandé as the remaining life gets tighter. No `equipmentModel` tag:
// this is about one aging unit's lifecycle, not a shared hardware defect
// propagating across the fleet, so it's deliberately excluded from fleet
// detection (see peak_hour_optimization's comment for the same reasoning
// applied to door_open_frequency_high).
function buildCapExRisk(rng, _target, _unit, store, equipmentItem) {
  const [minCost, maxCost] = equipmentItem.replacementCostRangeTND;
  const tndRisk = roundTo((minCost + maxCost) / 2, 100);
  const priority = equipmentItem.remainingLifeMonths <= 2 ? 'Recommandé' : 'Informationnel';

  return {
    priority,
    title: `Risque CapEx — ${equipmentItem.label}`,
    departmentLabel: equipmentItem.departmentLabel,
    evidence: [
      `Âge estimé : ${equipmentItem.ageYears} ans (durée de vie type : ${equipmentItem.lifecycleYears} ans).`,
      `Durée de vie restante estimée : ${equipmentItem.remainingLifeMonths} mois.`,
    ],
    diagnosis:
      'Cet équipement approche de la fin de sa durée de vie type et présente un risque de panne non planifiée.',
    recommendedAction: `Prévoir le remplacement — budget recommandé ${equipmentItem.recommendedQuarter}.`,
    estimatedImpact: `Coût de remplacement estimé : ${formatNumberFR(minCost)}–${formatNumberFR(maxCost)} TND.`,
    tndRisk,
  };
}

// `equipmentModel` is only set on templates that represent a physical piece
// of hardware shared across the portfolio (same make/model installed store
// to store) — it's what makes fleet-wide pattern detection meaningful. The
// brand names reuse the exact ones already listed in DATA_MAP_ROWS below,
// rather than inventing new ones. `door_open_frequency_high` is a
// process/training issue, not a hardware fault, so it's deliberately left
// untagged and excluded from fleet detection.
//
// `category` groups each template into the "Coûts évités" cost taxonomy
// (see getTicketCostAvoidedTND in metricsEngine.js for the TND range each
// one draws from):
//  - 'stock_loss' — product/inventory exposure risk (a fridge door left
//    open, a door seal failing — stock actually at risk of spoiling)
//  - 'technician_callout' — equipment wear that would need a technician
//    dispatch if unaddressed (compressor vibration — see FaultContext's
//    'compressor_vibration' fault type, wired independently of these cards)
//  - 'downtime' — failure risk that would eventually stop the store
//    operating a piece of equipment (CapEx-risk equipment past due)
//  - 'energy_waste' — routine consumption waste, whether from a dirty
//    filter, an unshifted peak-hour load, or a controllable schedule/
//    setpoint card — already reflected in the "Économies mensuelles"
//    modeled percentage for controllable cards specifically
const TEMPLATES = {
  climate_schedule_shift: {
    controllable: true,
    build: buildClimateScheduleShift,
    category: 'energy_waste',
  },
  climate_setpoint_optim: {
    controllable: true,
    build: buildClimateSetpointOptim,
    category: 'energy_waste',
  },
  lighting_dimming_schedule: {
    controllable: true,
    build: buildLightingDimmingSchedule,
    category: 'energy_waste',
  },
  lighting_zone_shutdown: {
    controllable: true,
    build: buildLightingZoneShutdown,
    category: 'energy_waste',
  },
  refrigeration_gasket_wear: {
    controllable: false,
    build: buildRefrigerationGasketWear,
    equipmentModel: 'Joint de porte — Vitrines réfrigérées Eliwell IWP',
    category: 'stock_loss',
  },
  compressor_drift_warning: {
    controllable: false,
    build: buildCompressorDriftWarning,
    equipmentModel: 'Compresseur — Danfoss AK2-CC',
    category: 'technician_callout',
  },
  filter_replacement_due: {
    controllable: false,
    build: buildFilterReplacementDue,
    equipmentModel: 'Filtre à air — Carrier ComfortLink',
    category: 'energy_waste',
  },
  door_open_frequency_high: {
    controllable: false,
    build: buildDoorOpenFrequencyHigh,
    category: 'stock_loss',
  },
  peak_hour_optimization: {
    controllable: false,
    build: buildPeakHourOptimization,
    category: 'energy_waste',
  },
  capex_risk: { controllable: false, build: buildCapExRisk, category: 'downtime' },
};

function buildCandidates(store) {
  const departments = getStoreDepartments(store);
  const zones = getLogisticsZones(store);
  const candidates = [];

  departments.forEach((dept) => {
    if (dept.climate) {
      candidates.push({ templateKey: 'climate_schedule_shift', dept, requiredDeviceId: `climate-${dept.id}` });
      candidates.push({ templateKey: 'climate_setpoint_optim', dept, requiredDeviceId: `climate-${dept.id}` });
      candidates.push({ templateKey: 'filter_replacement_due', dept, requiredDeviceId: `climate-${dept.id}` });
    }
    candidates.push({ templateKey: 'lighting_dimming_schedule', dept, requiredDeviceId: `lighting-${dept.id}` });
    candidates.push({ templateKey: 'lighting_zone_shutdown', dept, requiredDeviceId: `lighting-${dept.id}` });

    if (dept.refrigerated) {
      dept.units.forEach((unit) => {
        candidates.push({
          templateKey: 'refrigeration_gasket_wear',
          dept,
          unit,
          requiredDeviceId: unit.unitId,
        });
        candidates.push({
          templateKey: 'compressor_drift_warning',
          dept,
          unit,
          requiredDeviceId: unit.unitId,
        });
      });
    }
  });

  zones.forEach((zone) => {
    if (zone.hasDoorTracking) {
      candidates.push({
        templateKey: 'door_open_frequency_high',
        zone,
        requiredDeviceId: `zonedoor-${zone.id}`,
      });
    }
  });

  // Store-level, not department/unit-specific — only a candidate at all
  // when this store's peak-hour cost share is disproportionate (see
  // getPeakShareInfo). Tied to `caisses` (present and discovered from day
  // one on every store) rather than a specific sensor, since it reflects
  // the store's overall consumption pattern, not one device's reading.
  if (getPeakShareInfo(store).isDisproportionate) {
    candidates.push({ templateKey: 'peak_hour_optimization', requiredDeviceId: 'caisses' });
  }

  // One candidate per piece of equipment already inside the 6-month CapEx
  // risk window (getEquipmentLifecycle's isAtRisk) — most stores have none,
  // consistent with the "most equipment fine" distribution; requiredDeviceId
  // reuses whatever device the equipment maps to (a refrigeration unit, a
  // department's climate sensor, or `caisses` for the shared central
  // chiller), so eligibility follows the same discovery rules as every
  // other template.
  getEquipmentLifecycle(store)
    .filter((equipment) => equipment.isAtRisk)
    .forEach((equipment) => {
      candidates.push({
        templateKey: 'capex_risk',
        equipmentItem: equipment,
        requiredDeviceId: equipment.requiredDeviceId,
      });
    });

  return candidates;
}

function candidateId(store, candidate) {
  const target =
    candidate.unit?.unitId ?? candidate.zone?.id ?? candidate.dept?.id ?? candidate.equipmentItem?.id ?? 'store';
  return `insight-${store.code}-${candidate.templateKey}-${target}`;
}

// Deterministic (store code + template + target), returns 2-4 cards mixing
// controllable and advisory when both are available (occasionally more for
// a store eligible for peak-hour and/or CapEx-risk cards — see below). The
// SELECTION itself only depends on the store's department/zone structure
// (stable for the store's lifetime) — discoveredDeviceIds is applied as a
// final filter, so re-generating this list later (e.g. to look up an
// already-applied card's impact) always reproduces the identical set as
// long as nothing that was already discovered becomes un-discovered.
export function generateInsightsForStore(store, discoveredDeviceIds = []) {
  const candidates = buildCandidates(store);
  const selectRng = mulberry32(seedFromCode(`insights-select-${store.code}`));
  const shuffled = shuffleDeterministic(candidates, selectRng);
  const totalCount = 2 + Math.floor(selectRng() * 3);

  const controllableFirst = shuffled.find((c) => TEMPLATES[c.templateKey].controllable);
  const advisoryFirst = shuffled.find((c) => !TEMPLATES[c.templateKey].controllable);
  // Forced in like controllable/advisoryFirst above rather than left to
  // compete with the (much larger) generic candidate pool — a major store's
  // 30+ department-level candidates would otherwise bury these ~11% of the
  // time, which isn't acceptable odds for flagship demo features meant to
  // be reliably showable whenever a store actually qualifies. CapEx risk
  // stays genuinely rare at the ELIGIBILITY level (see
  // getEquipmentLifecycle's skewed age distribution) — forcing only
  // guarantees it's visible once a store IS eligible, it doesn't make
  // eligibility itself more common.
  const peakHourCandidate = shuffled.find((c) => c.templateKey === 'peak_hour_optimization');
  const capexRiskCandidates = shuffled.filter((c) => c.templateKey === 'capex_risk');

  const picked = [];
  if (controllableFirst) picked.push(controllableFirst);
  if (advisoryFirst) picked.push(advisoryFirst);
  if (peakHourCandidate && !picked.includes(peakHourCandidate)) picked.push(peakHourCandidate);
  capexRiskCandidates.forEach((candidate) => {
    if (!picked.includes(candidate)) picked.push(candidate);
  });
  shuffled.forEach((candidate) => {
    if (picked.length < totalCount && !picked.includes(candidate)) {
      picked.push(candidate);
    }
  });

  return picked
    .filter((candidate) => discoveredDeviceIds.includes(candidate.requiredDeviceId))
    .map((candidate) => {
      const id = candidateId(store, candidate);
      const template = TEMPLATES[candidate.templateKey];
      const rng = mulberry32(seedFromCode(id));
      const built = template.build(rng, candidate.dept ?? candidate.zone, candidate.unit, store, candidate.equipmentItem);
      const hoursAgo = 1 + Math.round(rng() * 47);

      return {
        id,
        templateKey: candidate.templateKey,
        category: template.category,
        equipmentModel: template.equipmentModel ?? null,
        controllable: template.controllable,
        departmentLabel: candidate.dept?.label ?? candidate.zone?.label,
        deviceName: candidate.unit?.name ?? null,
        status: 'open',
        timestamp: Date.now() - hoursAgo * 3600000,
        impactMagnitudeTND: built.tndImpact ?? built.tndRisk ?? 0,
        ...built,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Lower number = higher priority — used by the network-wide ticket triage
// to sort Urgent first regardless of which store/template produced it.
export const PRIORITY_RANK = { Urgent: 0, Recommandé: 1, Informationnel: 2 };

// A fleet-wide pattern only makes sense across a real portfolio — below
// this many distinct stores it's just "a few tickets", not a shared
// equipment failure worth a group intervention.
const FLEET_MIN_STORES = 3;

// Fleet-wide fault propagation: groups the network's already-open,
// equipment-tagged tickets (the `networkTickets` list produced by
// useNetworkTickets — themselves deterministic, seeded by store code) by
// their shared `equipmentModel`, and surfaces any pattern currently open
// in 3+ distinct connected stores as a single rolled-up issue. This is
// intentionally a pure function of the existing ticket list rather than
// its own random layer: which stores are connected, and which tickets
// each one currently has open, are already stable/deterministic, so this
// naturally stays stable across re-renders without needing a fresh seed —
// and every TND figure here is a direct sum of tndRisk/tndImpact values
// already shown on each affected store's own Intelligence tab, not a
// parallel estimate.
export function getFleetFaultPatterns(networkTickets) {
  const groups = new Map();

  networkTickets.forEach((ticket) => {
    if (!ticket.equipmentModel) return;
    const group = groups.get(ticket.templateKey) ?? {
      templateKey: ticket.templateKey,
      equipmentModel: ticket.equipmentModel,
      tickets: [],
      storeCodesSeen: new Set(),
    };
    group.tickets.push(ticket);
    group.storeCodesSeen.add(ticket.store.code);
    groups.set(ticket.templateKey, group);
  });

  return [...groups.values()]
    .filter((group) => group.storeCodesSeen.size >= FLEET_MIN_STORES)
    .map((group) => {
      const storesAffected = [...group.storeCodesSeen].map((code) => {
        const storeTickets = group.tickets.filter((ticket) => ticket.store.code === code);
        return { store: storeTickets[0].store, focusInsightId: storeTickets[0].id };
      });
      const combinedImpactTND = group.tickets.reduce((sum, ticket) => sum + ticket.impactMagnitudeTND, 0);

      return {
        id: `fleet-${group.templateKey}`,
        equipmentModel: group.equipmentModel,
        storesAffected,
        combinedImpactTND,
        recommendedAction: 'Programmer une intervention groupée',
      };
    })
    .sort((a, b) => b.combinedImpactTND - a.combinedImpactTND);
}
