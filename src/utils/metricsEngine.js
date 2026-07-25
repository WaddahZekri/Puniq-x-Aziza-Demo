// Deterministic per-store simulated metrics. Every number is derived from a
// PRNG seeded by the store code, so the same store always shows the same
// figures across renders and across the session — the demo never contradicts
// itself if the presenter revisits a store.
import { PRICING_CONFIG } from '../config/pricingConfig';

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromCode(code) {
  let h = 0;
  for (let i = 0; i < code.length; i += 1) h = (h * 31 + code.charCodeAt(i)) | 0;
  return h;
}

export const MAJOR_VILLES = ['Tunis', 'Ariana', 'Sousse', 'Sfax', 'Monastir', 'Nabeul', 'Ben Arous', 'Manouba', 'Bizerte'];

// Mini M is a convenience-format store, genuinely smaller than a full
// Monoprix — this scales absolute footfall/cost figures down, layered on
// top of (not instead of) the existing city-tier scaling above. Percentage
// figures (savingsPct) and health score baselines deliberately don't scale:
// a small store run well should reach the same relative savings % and
// health score as a well-run flagship.
const FORMAT_MULTIPLIERS = {
  Monoprix: 1.0,
  'Mini M': 0.4,
};

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

export function getStoreMetrics(store) {
  const rng = mulberry32(seedFromCode(store.code));
  const isMajor = MAJOR_VILLES.includes(store.ville);
  const formatMultiplier = FORMAT_MULTIPLIERS[store.format] ?? 1.0;

  const footfallPerDay = (isMajor ? 1200 + rng() * 1000 : 400 + rng() * 800) * formatMultiplier;
  const monthlyEnergyCostTND = (isMajor ? 6000 + rng() * 3500 : 2800 + rng() * 2600) * formatMultiplier;
  const savingsPct = 0.1 + rng() * 0.1;
  const monthlySavingsTND = monthlyEnergyCostTND * savingsPct;
  const costPerVisitorTND = monthlyEnergyCostTND / (footfallPerDay * 30);
  // Ranking signal only (getBenchmarkPercentile, getRegionalBreakdown) — used
  // to be monthlySavingsTND + a static emergencyCalloutValueTND, but that
  // figure was replaced by the live technicalVisitLog mechanism (event-driven,
  // starts at 0, not a stable per-store comparison value), so this is now
  // just the deterministic savings figure.
  const roiScore = monthlySavingsTND;

  return {
    footfallPerDay: roundTo(footfallPerDay, 10),
    monthlyEnergyCostTND: roundTo(monthlyEnergyCostTND, 10),
    savingsPct,
    monthlySavingsTND: roundTo(monthlySavingsTND, 10),
    costPerVisitorTND,
    roiScore,
  };
}

// Decides whether a store's savings are a strong enough lead-with story to
// headline with the TND figure, or whether the percentage (directly
// checkable against a utility bill, and a stronger claim when the TND
// value alone is small) is the more defensible framing. Reuses
// getStoreMetrics's existing monthlySavingsTND/savingsPct — no second
// savings calculation. `monthlyCostTND` here is PUNIQ's own recurring fee
// (what the margin is measured against), not the store's energy bill.
export function getStoreLeadQualification(store) {
  const metrics = getStoreMetrics(store);
  const monthlyCostTND = PRICING_CONFIG.recurringMonthlyFeeTND;
  const marginRatio = monthlyCostTND > 0 ? metrics.monthlySavingsTND / monthlyCostTND : 0;
  const isTempting = metrics.monthlySavingsTND >= monthlyCostTND * PRICING_CONFIG.temptingThresholdMultiplier;

  return {
    isTempting,
    monthlySavingsTND: metrics.monthlySavingsTND,
    savingsPct: metrics.savingsPct,
    monthlyCostTND,
    marginRatio,
  };
}

// "Économies générées" is a genuine aggregate of each connected store's own
// individual savings %, not a flat network-wide number — this is the
// ceiling that % can grow to as tickets get resolved (see
// getEffectiveSavingsPct), so it climbs plausibly instead of running away.
export const SAVINGS_PCT_CEILING = 0.28;

// Resolving any ticket (P1 advisory card actioned, P1 controllable card
// applied, or a P2/P3 fault marked resolved) nudges that store's own
// savings % up by a small, realistic increment — seeded by the ticket's own
// stable id, so the same ticket always contributes the same bump rather
// than a fresh random draw every render.
const TICKET_SAVINGS_BUMP_MIN = 0.005;
const TICKET_SAVINGS_BUMP_SPREAD = 0.015;

export function getTicketSavingsPctBump(seed) {
  const rng = mulberry32(seedFromCode(String(seed)));
  return TICKET_SAVINGS_BUMP_MIN + rng() * TICKET_SAVINGS_BUMP_SPREAD;
}

// Combines a store's deterministic base savingsPct with whatever
// ticket-resolution boost it's accumulated this session (from
// InsightsContext/IncidentsContext), capped at SAVINGS_PCT_CEILING so it
// stays believable rather than climbing indefinitely.
export function getEffectiveSavingsPct(store, boostPct) {
  return Math.min(SAVINGS_PCT_CEILING, getStoreMetrics(store).savingsPct + boostPct);
}

// Per-ticket-category TND ranges feeding "Coûts évités" — each category is
// its own realistic cost bucket, not one flat range: stock/inventory loss
// prevented, a technician callout avoided, downtime/stockout avoided, and
// energy waste avoided all carry genuinely different typical price tags.
const TICKET_TND_RANGES = {
  stock_loss: [100, 400],
  technician_callout: [300, 800],
  downtime: [500, 1500],
  energy_waste: [50, 250],
};

// Deterministic (seeded by the ticket's own stable id), so re-deriving this
// on every render — or from two different call sites for the same ticket —
// always produces the same figure.
export function getTicketCostAvoidedTND(category, seed) {
  const [min, max] = TICKET_TND_RANGES[category] ?? TICKET_TND_RANGES.energy_waste;
  const rng = mulberry32(seedFromCode(String(seed)));
  return Math.round(min + rng() * (max - min));
}

const DATAPOINTS_BASELINE_MIN = 180000;
const DATAPOINTS_BASELINE_SPREAD = 40000;

// Deterministic per-store "data points collected" baseline — the count a
// store's counter starts ticking up from. Seeded like every other per-store
// figure, so it's stable across renders/re-opens rather than reset each time.
export function getStoreDataPointsBaseline(store) {
  const rng = mulberry32(seedFromCode(`datapoints-${store.code}`));
  return Math.round(DATAPOINTS_BASELINE_MIN + rng() * DATAPOINTS_BASELINE_SPREAD);
}

// Network-wide counterpart — a genuine sum of each connected store's own
// baseline, rather than an independent hardcoded figure. Callers pass the
// already-filtered connected-store list (same convention as
// getRegionalBreakdown/getRadarPosition-style per-item helpers) since this
// operates on stores directly rather than (allStores, connectedCodes).
export function getNetworkDataPointsBaseline(connectedStores) {
  return connectedStores.reduce((sum, store) => sum + getStoreDataPointsBaseline(store), 0);
}

// Time-of-use (TOU) cost bands, matching STEG's real off-peak/normal/peak
// tariff windows. A grocery store's traffic curve determines what SHARE of
// its existing daily energy cost lands in each band — a small Mini M's
// flatter, grazing traffic spreads cost evenly, while a large flagship's
// sharp evening rush concentrates cost into the expensive peak window.
// Shapes are fixed per tier (not randomized) and simply redistribute the
// store's EXISTING daily cost (monthlyEnergyCostTND / 30), so the three
// bands always sum back to the same daily total already shown elsewhere —
// no new financial figure is introduced, only a breakdown of the existing
// one.
export const TOU_BANDS = [
  { id: 'creuses', label: 'Heures creuses', hours: '21h–7h' },
  { id: 'pleines', label: 'Heures pleines', hours: '7h–17h, 20h–21h' },
  { id: 'pointe', label: 'Heures de pointe', hours: '17h–20h' },
];

const TOU_SHAPE_SMALL = { creuses: 0.32, pleines: 0.5, pointe: 0.18 };
const TOU_SHAPE_MEDIUM = { creuses: 0.26, pleines: 0.49, pointe: 0.25 };
const TOU_SHAPE_LARGE = { creuses: 0.2, pleines: 0.45, pointe: 0.35 };

// Reuses the store's existing format + city-tier dimensions (no new field)
// as a stand-in for small/medium/large: a Mini M is always "small"; a
// full-format Monoprix is "large" in a major city and "medium" elsewhere.
function getTOUShape(store) {
  if (store.format === 'Mini M') return TOU_SHAPE_SMALL;
  return MAJOR_VILLES.includes(store.ville) ? TOU_SHAPE_LARGE : TOU_SHAPE_MEDIUM;
}

// A 3-hour peak window is 12.5% of the day — a store whose peak band
// captures noticeably more than that share of daily cost is disproportion-
// ately exposed to the priciest tariff, which is what makes it worth an
// insight card.
const PEAK_SHARE_ALERT_THRESHOLD = 0.3;

export function getTOUCostBreakdown(store) {
  const metrics = getStoreMetrics(store);
  const dailyCostTND = metrics.monthlyEnergyCostTND / 30;
  const shape = getTOUShape(store);

  return TOU_BANDS.map((band) => ({
    ...band,
    costTND: Math.round(dailyCostTND * shape[band.id]),
    sharePct: Math.round(shape[band.id] * 100),
  }));
}

export function getPeakShareInfo(store) {
  const shape = getTOUShape(store);
  return {
    peakSharePct: Math.round(shape.pointe * 100),
    isDisproportionate: shape.pointe >= PEAK_SHARE_ALERT_THRESHOLD,
  };
}

// Portfolio-wide rollup for the Vue d'ensemble tab — total monthly spend
// (across connected stores only, same scope as getNetworkAggregate) that
// lands specifically in the peak-tariff window.
export function getPortfolioPeakExposure(allStores, connectedCodes) {
  const connectedSet = new Set(connectedCodes);
  const connectedStores = allStores.filter((store) => connectedSet.has(store.code));

  const totalMonthlyPeakTND = connectedStores.reduce((sum, store) => {
    const peakBand = getTOUCostBreakdown(store).find((band) => band.id === 'pointe');
    return sum + peakBand.costTND * 30;
  }, 0);

  return { value: Math.round(totalMonthlyPeakTND) };
}

// Before/after health score model: a non-connected store shows its real,
// unmonitored baseline (deliberately mediocre — there is no visibility yet).
// A connected store ramps from that same baseline up toward a ceiling over
// session time, so the pitch shows improvement happening, not a store that
// was already fine the instant it connects.
const RAMP_MIN_MS = 45000;
const RAMP_SPREAD_MS = 15000;
const CEILING_MIN_GAIN = 25;
const CEILING_SPREAD_GAIN = 10;
const CEILING_CAP = 96;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function getBaselineHealthScore(store) {
  const rng = mulberry32(seedFromCode(`baseline-${store.code}`));
  return Math.round(38 + rng() * 24);
}

// `healthBonus` layers on top of the ramp — applied controllable insights
// nudge the score up a little further, capped so it can never exceed 100.
export function getCurrentHealthScore(store, connectedSince, healthBonus = 0) {
  const baseline = getBaselineHealthScore(store);
  if (!connectedSince) return baseline;

  const rng = mulberry32(seedFromCode(`ramp-${store.code}`));
  const ceiling = Math.min(CEILING_CAP, baseline + CEILING_MIN_GAIN + rng() * CEILING_SPREAD_GAIN);
  const rampDurationMs = RAMP_MIN_MS + rng() * RAMP_SPREAD_MS;

  const elapsedMs = Math.max(0, Date.now() - connectedSince);
  const progress = Math.min(1, elapsedMs / rampDurationMs);
  const eased = easeOutCubic(progress);

  return Math.min(100, Math.round(baseline + (ceiling - baseline) * eased) + healthBonus);
}

export function getIgnitionOrder(allStores, connectedCodes) {
  const connectedSet = new Set(connectedCodes);
  return allStores
    .filter((store) => !connectedSet.has(store.code))
    .map((store) => ({ code: store.code, roiScore: getStoreMetrics(store).roiScore }))
    .sort((a, b) => b.roiScore - a.roiScore)
    .map((entry) => entry.code);
}

const HISTORY_DAYS = 14;
const ACTIVATION_DAY_INDEX = 6;
const DAYS_TO_FULL_EFFECT = 4;

// `appliedAdjustmentPct` (0-100) reflects controllable insight cards applied
// THIS session — it nudges only the final 1-2 points downward (small but
// visible), rather than rewriting history, and flags the last day so the
// chart can render a second "Ajustement appliqué" marker distinct from the
// original "PUNIQ activé" activation line.
export function getEnergyCostHistory(store, isConnected, appliedAdjustmentPct = 0) {
  const rng = mulberry32(seedFromCode(`history-${store.code}`));
  const metrics = getStoreMetrics(store);
  const dailyBaseline = metrics.monthlyEnergyCostTND / 30;

  const days = [];
  for (let i = 0; i < HISTORY_DAYS; i += 1) {
    const noise = (rng() - 0.5) * 0.1;
    let cost = dailyBaseline * (1 + noise);

    const isActivation = isConnected && i === ACTIVATION_DAY_INDEX;
    if (isConnected && i >= ACTIVATION_DAY_INDEX) {
      const progress = Math.min(1, (i - ACTIVATION_DAY_INDEX) / DAYS_TO_FULL_EFFECT);
      cost *= 1 - metrics.savingsPct * progress;
    }

    const daysAgo = HISTORY_DAYS - 1 - i;
    days.push({
      label: daysAgo === 0 ? "Aujourd'hui" : `J-${daysAgo}`,
      cost: Math.round(cost),
      isActivation,
    });
  }

  if (appliedAdjustmentPct > 0) {
    const adjustmentFraction = Math.min(0.25, appliedAdjustmentPct / 100);
    const lastIdx = days.length - 1;
    const secondLastIdx = days.length - 2;
    days[secondLastIdx].cost = Math.round(days[secondLastIdx].cost * (1 - adjustmentFraction * 0.5));
    days[lastIdx].cost = Math.round(days[lastIdx].cost * (1 - adjustmentFraction));
    days[lastIdx].isAdjustment = true;
  }

  return days;
}

export function getStandingInsights(store) {
  const rng = mulberry32(seedFromCode(`insights-${store.code}`));
  const pctReduction = 8 + Math.round(rng() * 10);
  const hoursAgo1 = 3 + Math.round(rng() * 20);
  const hoursAgo2 = 3 + Math.round(rng() * 40);

  return [
    {
      id: 'climatisation-optimisation',
      priority: 'recommended',
      title: 'Optimisation détectée — Climatisation',
      description: `Ajustement du planning selon la fréquentation réelle pourrait réduire la consommation de ${pctReduction}% durant les heures creuses.`,
      hoursAgo: hoursAgo1,
    },
    {
      id: 'eclairage-suivi',
      priority: 'informational',
      title: 'Suivi normal — Éclairage',
      description: "Consommation d'éclairage stable, alignée avec les habitudes de fréquentation observées cette semaine.",
      hoursAgo: hoursAgo2,
    },
  ];
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function getConnectionDate(store) {
  const rng = mulberry32(seedFromCode(`connected-${store.code}`));
  const daysAgo = 5 + Math.floor(rng() * 85);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

export function formatDateFR(date) {
  return `${date.getDate()} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

export function getNetworkAggregate(allStores, connectedCodes, connectedAt = {}, impactByStoreCode = {}) {
  const connectedSet = new Set(connectedCodes);
  const connectedStores = allStores.filter((store) => connectedSet.has(store.code));

  const totals = connectedStores.reduce(
    (acc, store) => {
      const impact = impactByStoreCode[store.code];
      const metrics = getStoreMetrics(store);
      acc.monthlySavingsTND += metrics.monthlySavingsTND + (impact?.extraSavingsTND ?? 0);
      acc.healthScoreSum += getCurrentHealthScore(store, connectedAt[store.code], impact?.healthBonus ?? 0);
      acc.baselineHealthScoreSum += getBaselineHealthScore(store);
      return acc;
    },
    {
      monthlySavingsTND: 0,
      healthScoreSum: 0,
      baselineHealthScoreSum: 0,
    },
  );

  return {
    totalMonthlySavingsTND: totals.monthlySavingsTND,
    averageHealthScore: connectedStores.length > 0 ? totals.healthScoreSum / connectedStores.length : 0,
    averageBaselineHealthScore:
      connectedStores.length > 0 ? totals.baselineHealthScoreSum / connectedStores.length : 0,
  };
}

export function getRegionalBreakdown(allStores, connectedCodes, connectedAt = {}) {
  const connectedSet = new Set(connectedCodes);
  const connectedStores = allStores.filter((store) => connectedSet.has(store.code));

  const byVille = new Map();
  connectedStores.forEach((store) => {
    const currentScore = getCurrentHealthScore(store, connectedAt[store.code]);
    const roiScore = getStoreMetrics(store).roiScore;
    const entry = byVille.get(store.ville) || { ville: store.ville, healthScoreSum: 0, roiScoreSum: 0, storeCount: 0 };
    entry.healthScoreSum += currentScore;
    entry.roiScoreSum += roiScore;
    entry.storeCount += 1;
    byVille.set(store.ville, entry);
  });

  return [...byVille.values()]
    .map((entry) => ({
      ville: entry.ville,
      storeCount: entry.storeCount,
      avgHealthScore: entry.healthScoreSum / entry.storeCount,
      avgRoiScore: entry.roiScoreSum / entry.storeCount,
    }))
    .sort((a, b) => b.avgHealthScore - a.avgHealthScore);
}

// Small, purely decorative "vs last period" movement for the Classement
// table's trend arrow — deterministic per store, biased slightly positive
// (PUNIQ stores trend up more often than down) but not tied to the health
// ramp itself, so it doesn't just mechanically mirror "every connected
// store is improving".
export function getStoreTrendPct(store) {
  const rng = mulberry32(seedFromCode(`trend-${store.code}`));
  return Math.round((rng() - 0.35) * 20);
}

// Single-site solar self-consumption/PPA potential — a consumption-based
// proxy only, reusing the store's existing monthlyEnergyCostTND (no
// second cost model). Real feasibility depends on roof area, orientation,
// shading, and structural load capacity — none of which this demo has
// data for. This is a starting point for a site conversation, not a site
// survey.
export function getStoreSolarPotential(store) {
  return getStoreMetrics(store).monthlyEnergyCostTND * 12;
}

const SOLAR_PHASE_TOP_RATIO = 0.2;
const SOLAR_PHASE_NEXT_RATIO = 0.3;

// A solar/PPA project is structured site-by-site, not as one portfolio-wide
// contract — this ranks every store (connected or not; solar potential is
// a property of the site's consumption, not of PUNIQ's connection status)
// by getStoreSolarPotential and buckets them into a simple phased-rollout
// grouping so the portfolio total always breaks down into its parts.
export function getPortfolioSolarPotential(allStores) {
  const items = allStores
    .map((store) => ({ store, annualPotentialTND: getStoreSolarPotential(store) }))
    .sort((a, b) => b.annualPotentialTND - a.annualPotentialTND);

  const topCount = Math.max(1, Math.round(items.length * SOLAR_PHASE_TOP_RATIO));
  const nextCount = Math.round(items.length * SOLAR_PHASE_NEXT_RATIO);

  const withPhase = items.map((item, index) => {
    let phase;
    if (index < topCount) phase = 'priority';
    else if (index < topCount + nextCount) phase = 'phase2';
    else phase = 'evaluate';
    return { ...item, phase };
  });

  return {
    items: withPhase,
    totalAnnualPotentialTND: items.reduce((sum, item) => sum + item.annualPotentialTND, 0),
    storeCount: items.length,
  };
}

// The mirror of getNetworkAggregate() — computed over stores NOT yet
// connected, so the pitch can show "missed value" as a concrete number
// instead of only celebrating what's already captured.
export function getNetworkPotential(allStores, connectedCodes) {
  const connectedSet = new Set(connectedCodes);
  const connectedStores = allStores.filter((store) => connectedSet.has(store.code));
  const nonConnectedStores = allStores.filter((store) => !connectedSet.has(store.code));

  const connectedSavingsTND = connectedStores.reduce(
    (sum, store) => sum + getStoreMetrics(store).monthlySavingsTND,
    0,
  );
  const potentialSavingsTND = nonConnectedStores.reduce(
    (sum, store) => sum + getStoreMetrics(store).monthlySavingsTND,
    0,
  );

  const totalPotentialTND = connectedSavingsTND + potentialSavingsTND;
  const capturedPct = totalPotentialTND > 0 ? (connectedSavingsTND / totalPotentialTND) * 100 : 0;

  return {
    potentialSavingsTND,
    nonConnectedCount: nonConnectedStores.length,
    connectedSavingsTND,
    capturedPct,
  };
}

// Highest and lowest live healthScore among CONNECTED stores only — the
// "Meilleur magasin" / "Magasin à risque" spotlight cards. `connectedAt` is
// optional so this can still be called with just (allStores, connectedCodes)
// — without it, scores fall back to each store's baseline.
export function getNetworkBestWorst(allStores, connectedCodes, connectedAt = {}) {
  const connectedStores = allStores.filter((store) => connectedCodes.includes(store.code));
  if (connectedStores.length === 0) return { best: null, worst: null };

  const scored = connectedStores.map((store) => ({
    store,
    healthScore: getCurrentHealthScore(store, connectedAt[store.code]),
  }));

  const best = scored.reduce((a, b) => (b.healthScore > a.healthScore ? b : a));
  const worst = scored.reduce((a, b) => (b.healthScore < a.healthScore ? b : a));

  return { best, worst };
}

// This store's roiScore ranking among "comparable" stores — same ville
// tier (major-city vs non-major, via MAJOR_VILLES) AND same format — for
// the per-store Overview tab's "Classement du magasin" hero card. A Mini M
// is only ever benchmarked against other Mini M stores, never against full
// Monoprix stores, since comparing a convenience format to a flagship on
// raw efficiency would be misleading. Lower percentile is better ("Top 18%"
// means outperforming 82% of comparable stores).
export function getBenchmarkPercentile(store, allStores) {
  const isMajor = MAJOR_VILLES.includes(store.ville);
  const comparables = allStores.filter(
    (candidate) =>
      candidate.code !== store.code &&
      MAJOR_VILLES.includes(candidate.ville) === isMajor &&
      candidate.format === store.format,
  );
  if (comparables.length === 0) return { percentile: 1, comparableCount: 0 };

  const thisScore = getStoreMetrics(store).roiScore;
  const betterCount = comparables.filter((candidate) => getStoreMetrics(candidate).roiScore > thisScore).length;
  const percentile = Math.max(1, Math.round((betterCount / comparables.length) * 100));

  return { percentile, comparableCount: comparables.length };
}

// Small, deterministic "vs mois dernier" delta for a specific Overview-tab
// hero metric — same spirit as getStoreTrendPct, but keyed per metric so
// "Économie" and "Coût/visiteur" don't move in lockstep. The sign is the
// metric's own literal direction of change; callers decide whether that
// direction is favorable (e.g. cost going down is good, savings going up
// is good) since that differs per metric.
export function getStoreMetricTrendPct(store, metricKey) {
  const rng = mulberry32(seedFromCode(`metric-trend-${metricKey}-${store.code}`));
  return Math.round((rng() - 0.4) * 20);
}

// PUNIQ's documented data map is the concrete, unglamorous deliverable that
// makes the pitch credible — this is a fixed 6-row SAMPLE of a much larger
// per-store map (see getDataMapTotalCount), not an exhaustive listing.
const DATA_MAP_ROWS = [
  {
    système: 'Réfrigération',
    typeDonnée: 'Température',
    nomNormalisePuniq: 'REFRIG.VITRINE1.TEMP',
    appareils: ['Danfoss AK2-CC', 'Carel IR33', 'Eliwell IWP'],
  },
  {
    système: 'Climatisation',
    typeDonnée: 'Consigne',
    nomNormalisePuniq: 'HVAC.ZONE1.SETPOINT',
    appareils: ['Carrier ComfortLink', 'Daikin iTM', 'Trane Tracer SC'],
  },
  {
    système: 'Éclairage',
    typeDonnée: 'Consommation',
    nomNormalisePuniq: 'LIGHT.CIRCUIT1.KWH',
    appareils: ['Schneider PowerLogic', 'Legrand EMDX3'],
  },
  {
    système: 'Caisses',
    typeDonnée: 'État',
    nomNormalisePuniq: 'POS.TERMINAL1.STATUS',
    appareils: ['Wincor Nixdorf BEETLE', 'NCR RealPOS'],
  },
  {
    système: 'Solaire',
    typeDonnée: 'Production',
    nomNormalisePuniq: 'SOLAR.INV1.KWH',
    appareils: ['SMA Sunny Boy', 'Huawei SUN2000'],
  },
  {
    système: 'Sécurité',
    typeDonnée: "Ouverture porte",
    nomNormalisePuniq: 'DOOR.COLDROOM1.STATE',
    appareils: ['Honeywell Vista', 'Bosch ISN-CI'],
  },
];

export function getDataMapSample(store) {
  return DATA_MAP_ROWS.map((row, index) => {
    const rng = mulberry32(seedFromCode(`datamap-${store.code}-${index}`));
    const appareil = row.appareils[Math.floor(rng() * row.appareils.length)];
    const qualité = Math.round(85 + rng() * 14);

    return {
      système: row.système,
      appareil,
      nomNormalisePuniq: row.nomNormalisePuniq,
      typeDonnée: row.typeDonnée,
      qualité,
    };
  });
}

// The sample above is deliberately fixed-length (6 rows) — this implies the
// real, much larger documented map every store actually has.
export function getDataMapTotalCount(store) {
  const rng = mulberry32(seedFromCode(`datamap-total-${store.code}`));
  return 35 + Math.round(rng() * 25);
}

// The single source of "vs 7 jours" trend badges for the network-wide hero
// stats (sidebar OverviewPanel.jsx and the full NetworkOverviewTab.jsx
// overlay both call this — neither computes its own trend). Keyed per
// metric so each stat card gets its own independent movement rather than
// all four moving in lockstep, and seeded off network state (not
// Math.random()) so both panels always agree for the same metric.
// SIMULATION: replace this function's internals with a real query
// against stored historical snapshots once live data exists — signature
// and return shape must stay the same.
export function getMetricTrend(metricKey, currentValue, seed) {
  const rng = mulberry32(seedFromCode(`metric-trend-${metricKey}-${seed}`));
  const deltaPct = Math.round((rng() - 0.3) * 24);
  const previousValue = currentValue / (1 + deltaPct / 100);
  return {
    previousValue,
    deltaPct,
    direction: deltaPct >= 0 ? 'up' : 'down',
  };
}

const KG_CO2_PER_TREE_YEAR = 21;
const KG_CO2_PER_VEHICLE_YEAR = 4600;

// Deterministic, illustrative conversion of a monthly CO2e figure into a
// tangible comparison — trees and vehicles are easier to reason about in a
// pitch than a raw kg figure.
export function getEmissionsEquivalence(kgCO2eMonth) {
  const kgCO2eYear = kgCO2eMonth * 12;
  return {
    treesEquivalent: Math.round(kgCO2eYear / KG_CO2_PER_TREE_YEAR),
    vehiclesEquivalent: Math.round(kgCO2eYear / KG_CO2_PER_VEHICLE_YEAR),
  };
}

// Same illustrative kgCO2e-per-TND-of-energy-spend factor used throughout
// the sustainability tab — exported (rather than left as a local constant
// in NetworkSustainabilityTab.jsx) so the compliance export modal can reuse
// the identical figure instead of a second, potentially-drifting copy.
export const CO2_PER_TND_SPEND = 0.55;

// Portfolio-wide sustainability rollup — same connected-only scope as
// getPortfolioPeakExposure/getPortfolioCapExForecast. Every figure here is
// a direct aggregation of getStoreMetrics fields already shown elsewhere
// (monthlyEnergyCostTND, monthlySavingsTND, footfallPerDay) run through the
// same CO2_PER_TND_SPEND conversion NetworkSustainabilityTab already uses —
// nothing new is invented, this just gives the compliance export a single
// place to read the same numbers from.
export function getPortfolioSustainabilitySummary(allStores, connectedCodes) {
  const connectedSet = new Set(connectedCodes);
  const connectedStores = allStores.filter((store) => connectedSet.has(store.code));

  const totals = connectedStores.reduce(
    (acc, store) => {
      const metrics = getStoreMetrics(store);
      acc.monthlyEnergyCostTND += metrics.monthlyEnergyCostTND;
      acc.monthlySavingsTND += metrics.monthlySavingsTND;
      acc.monthlyFootfall += metrics.footfallPerDay * 30;
      return acc;
    },
    { monthlyEnergyCostTND: 0, monthlySavingsTND: 0, monthlyFootfall: 0 },
  );

  const kgCO2ePerMonth = Math.round(totals.monthlyEnergyCostTND * CO2_PER_TND_SPEND);
  const kgCO2eAvoidedPerMonth = Math.round(totals.monthlySavingsTND * CO2_PER_TND_SPEND);
  const energyIntensityTNDPerVisit =
    totals.monthlyFootfall > 0 ? totals.monthlyEnergyCostTND / totals.monthlyFootfall : 0;

  return {
    storeCount: connectedStores.length,
    totalStoreCount: allStores.length,
    monthlyEnergyCostTND: Math.round(totals.monthlyEnergyCostTND),
    monthlySavingsTND: Math.round(totals.monthlySavingsTND),
    monthlyFootfall: Math.round(totals.monthlyFootfall),
    kgCO2ePerMonth,
    kgCO2eAvoidedPerMonth,
    energyIntensityTNDPerVisit,
    emissionsEquivalence: getEmissionsEquivalence(kgCO2ePerMonth),
    avoidedEquivalence: getEmissionsEquivalence(kgCO2eAvoidedPerMonth),
  };
}

// --- ANME mandatory energy audit compliance (Tunisia, Loi 2005-82) ------

// Physically accurate international conversion factor — not a placeholder.
export const KWH_PER_TOE = 11630;

// TODO: replace with the real STEG average tariff rate (TND/kWh) for this
// customer class once available — this is a rough placeholder used only
// to convert the store's EXISTING monthlyEnergyCostTND into an estimated
// annual kWh/toe figure, not a new billing rate or cost calculation.
const PLACEHOLDER_STEG_TARIFF_TND_PER_KWH = 0.25;

// Loi 2005-82's mandatory-audit threshold for tertiary/service-sector
// establishments, in tonnes équivalent pétrole per year.
export const ANME_TOE_THRESHOLD = 500;
// Within 20% below the threshold counts as "proche du seuil" rather than
// comfortably "en dessous".
const ANME_NEAR_THRESHOLD_RATIO = 0.8;

// Estimates a store's annual toe consumption from its EXISTING
// monthlyEnergyCostTND (getStoreMetrics) — a unit conversion of a figure
// already computed elsewhere, not a new cost calculation.
export function estimateAnnualToe(store) {
  const { monthlyEnergyCostTND } = getStoreMetrics(store);
  const annualCostTND = monthlyEnergyCostTND * 12;
  const estimatedAnnualKwh = annualCostTND / PLACEHOLDER_STEG_TARIFF_TND_PER_KWH;
  return estimatedAnnualKwh / KWH_PER_TOE;
}

// 'above' | 'near' | 'below' — drives both the per-store badge and the
// portfolio-level "how many stores are at/above threshold" rollup below.
export function getAnmeThresholdStatus(annualToe) {
  if (annualToe >= ANME_TOE_THRESHOLD) return 'above';
  if (annualToe >= ANME_TOE_THRESHOLD * ANME_NEAR_THRESHOLD_RATIO) return 'near';
  return 'below';
}

// Portfolio-wide rollup — same connected-only scope as
// getPortfolioPeakExposure/getPortfolioCapExForecast. Purely illustrative:
// this estimates exposure to the LAW'S threshold from PUNIQ's own
// simulated cost data, it does not know a store's actual, current ANME
// compliance status.
export function getPortfolioAnmeCompliance(allStores, connectedCodes) {
  const connectedSet = new Set(connectedCodes);
  const connectedStores = allStores.filter((store) => connectedSet.has(store.code));

  const items = connectedStores
    .map((store) => {
      const annualToe = estimateAnnualToe(store);
      return { store, annualToe, status: getAnmeThresholdStatus(annualToe) };
    })
    .sort((a, b) => b.annualToe - a.annualToe);

  return {
    items,
    storeCount: connectedStores.length,
    atOrAboveCount: items.filter((item) => item.status === 'above').length,
    totalAnnualToe: items.reduce((sum, item) => sum + item.annualToe, 0),
  };
}

// Department model: a real supermarket is organized into distinct
// departments, each with its own refrigeration units / HVAC zone / lighting
// circuit — not one flat "réfrigération" card for the whole store.
export const DEPARTMENT_POOL = {
  BOUCHERIE: { id: 'BOUCHERIE', label: 'Boucherie', refrigerated: true, minUnits: 1, maxUnits: 2, tempRange: [0, 4] },
  POISSONNERIE: {
    id: 'POISSONNERIE',
    label: 'Poissonnerie',
    refrigerated: true,
    minUnits: 1,
    maxUnits: 1,
    tempRange: [0, 3],
  },
  CREMERIE: {
    id: 'CREMERIE',
    label: 'Crèmerie & Produits Laitiers',
    refrigerated: true,
    minUnits: 1,
    maxUnits: 2,
    tempRange: [2, 6],
  },
  SURGELES: {
    id: 'SURGELES',
    label: 'Surgelés',
    refrigerated: true,
    minUnits: 1,
    maxUnits: 2,
    tempRange: [-22, -18],
  },
  BOISSONS: { id: 'BOISSONS', label: 'Boissons', refrigerated: true, minUnits: 1, maxUnits: 1, tempRange: [4, 8] },
  FRUITS_LEGUMES: {
    id: 'FRUITS_LEGUMES',
    label: 'Fruits & Légumes',
    refrigerated: false,
    hasClimateZone: true,
  },
  EPICERIE: { id: 'EPICERIE', label: 'Épicerie', refrigerated: false, hasClimateZone: false },
};

const CORE_DEPARTMENT_IDS = ['BOUCHERIE', 'FRUITS_LEGUMES', 'EPICERIE'];
const OPTIONAL_DEPARTMENT_IDS = ['POISSONNERIE', 'CREMERIE', 'SURGELES', 'BOISSONS'];

export function shuffleDeterministic(arr, rng) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Lightweight — just which departments a store has, without building the
// full unit/climate/lighting readings. Used both by getStoreDepartments and
// by the cross-store benchmark comparison, which needs to check hundreds of
// stores for "does this store also have department X" cheaply.
export function getStoreDepartmentIds(store) {
  const rng = mulberry32(seedFromCode(`departments-${store.code}`));
  const isMajor = MAJOR_VILLES.includes(store.ville);
  const shuffledOptional = shuffleDeterministic(OPTIONAL_DEPARTMENT_IDS, rng);
  const extraCount = isMajor ? 3 + Math.floor(rng() * 2) : Math.floor(rng() * 2);
  return [...CORE_DEPARTMENT_IDS, ...shuffledOptional.slice(0, extraCount)];
}

function buildRefrigerationUnits(def, rng) {
  const [min, max] = def.tempRange;
  const unitCount = def.minUnits + Math.floor(rng() * (def.maxUnits - def.minUnits + 1));
  const units = [];
  for (let i = 0; i < unitCount; i += 1) {
    units.push({
      unitId: `${def.id}-${i + 1}`,
      name: `Vitrine réfrigérée #${i + 1} — ${def.label}`,
      tempC: Number((min + rng() * (max - min)).toFixed(1)),
      tempRange: def.tempRange,
      status: 'Normal',
    });
  }
  return units;
}

function buildDepartment(store, id) {
  const def = DEPARTMENT_POOL[id];
  const rng = mulberry32(seedFromCode(`dept-${store.code}-${id}`));

  const units = def.refrigerated ? buildRefrigerationUnits(def, rng) : [];
  const hasClimate = def.hasClimateZone || def.refrigerated;
  const climate = hasClimate
    ? {
        setpointC: Number((19 + rng() * 3).toFixed(1)),
        actualC: Number((19 + rng() * 3).toFixed(1)),
        humidityPct: Math.round(40 + rng() * 20),
      }
    : null;

  const lighting = {
    pctLit: Math.round(70 + rng() * 25),
    consumptionKw: Number((1 + rng() * 5).toFixed(1)),
  };

  return {
    id,
    label: def.label,
    refrigerated: def.refrigerated,
    units,
    climate,
    lighting,
  };
}

export function getStoreDepartments(store) {
  return getStoreDepartmentIds(store).map((id) => buildDepartment(store, id));
}

// Synthetic 0-100 efficiency score per store+department, used only to derive
// a relative "vs réseau" benchmark — not shown directly.
function getDepartmentEfficiencyIndex(store, departmentId) {
  const rng = mulberry32(seedFromCode(`dept-efficiency-${store.code}-${departmentId}`));
  return 70 + rng() * 30;
}

// This department's efficiency vs the same department type averaged across
// all other stores that also have it — powers the "▲/▼ X% vs réseau" badge.
export function getZoneBenchmarkDelta(store, departmentId, allStores) {
  const thisIndex = getDepartmentEfficiencyIndex(store, departmentId);
  const peers = allStores.filter(
    (candidate) => candidate.code !== store.code && getStoreDepartmentIds(candidate).includes(departmentId),
  );
  if (peers.length === 0) return 0;

  const peerAvg = peers.reduce((sum, peer) => sum + getDepartmentEfficiencyIndex(peer, departmentId), 0) / peers.length;
  return Math.round(((thisIndex - peerAvg) / peerAvg) * 100);
}

// Logistics zones exist independently of sales departments — every store has
// a positive cold room and a dry reserve; a negative (freezer) cold room only
// exists if the store actually carries a Surgelés department.
export function getLogisticsZones(store) {
  const rng = mulberry32(seedFromCode(`logistics-${store.code}`));
  const hasSurgeles = getStoreDepartmentIds(store).includes('SURGELES');

  const zones = [
    {
      id: 'chambre-froide-positive',
      label: 'Chambre froide positive',
      tempC: Number((2 + rng() * 2).toFixed(1)),
      tempRange: [2, 4],
      humidityPct: Math.round(50 + rng() * 20),
      doorStatus: rng() > 0.85 ? 'Ouverte' : 'Fermée',
      doorOpenCountToday: 2 + Math.floor(rng() * 6),
      capacityPct: Math.round(40 + rng() * 50),
      hasDoorTracking: true,
    },
  ];

  if (hasSurgeles) {
    zones.push({
      id: 'chambre-froide-negative',
      label: 'Chambre froide négative',
      tempC: Number((-22 + rng() * 4).toFixed(1)),
      tempRange: [-22, -18],
      humidityPct: Math.round(45 + rng() * 15),
      doorStatus: rng() > 0.9 ? 'Ouverte' : 'Fermée',
      doorOpenCountToday: 1 + Math.floor(rng() * 5),
      capacityPct: Math.round(40 + rng() * 50),
      hasDoorTracking: true,
    });
  }

  zones.push({
    id: 'reserve',
    label: 'Réserve',
    tempC: Number((18 + rng() * 8).toFixed(1)),
    tempRange: [18, 26],
    humidityPct: Math.round(40 + rng() * 20),
    capacityPct: Math.round(30 + rng() * 60),
    hasDoorTracking: false,
  });

  return zones;
}

// --- CapEx risk / equipment lifecycle -----------------------------------

// Typical service life for major refrigeration/HVAC hardware — illustrative
// but in a realistic range for supermarket equipment.
const EQUIPMENT_LIFECYCLE_YEARS = {
  compressor: 10,
  chiller: 15,
  hvac: 12,
};

const EQUIPMENT_COST_RANGE_TND = {
  compressor: [8000, 15000],
  chiller: [25000, 45000],
  hvac: [12000, 20000],
};

// Two separate thresholds, deliberately different widths: INSIGHT is the
// tight "this needs an ops ticket now" window that triggers a Risque CapEx
// card; FORECAST_HORIZON is the wider budget-planning window shown in the
// portfolio-wide "Prévision CapEx" panel (equipment that isn't urgent yet
// but should be on next year's radar).
const CAPEX_INSIGHT_THRESHOLD_MONTHS = 6;
const CAPEX_FORECAST_HORIZON_MONTHS = 12;

// Candidate pool of "major equipment" this store actually has, built from
// its real department/refrigeration structure — one compressor per
// refrigeration unit, one HVAC group per climate-controlled department,
// plus one shared central chiller every store has regardless of format.
// requiredDeviceId ties each candidate to the same device the rest of the
// app already associates with that unit/department, so it's naturally
// "discovered" consistent with existing device semantics.
function getEquipmentPool(store) {
  const departments = getStoreDepartments(store);
  const pool = [];

  departments.forEach((dept) => {
    dept.units.forEach((unit) => {
      pool.push({
        id: `compressor-${unit.unitId}`,
        type: 'compressor',
        label: `Compresseur — ${dept.label}`,
        departmentLabel: dept.label,
        lifecycleYears: EQUIPMENT_LIFECYCLE_YEARS.compressor,
        requiredDeviceId: unit.unitId,
      });
    });
    if (dept.climate) {
      pool.push({
        id: `hvac-${dept.id}`,
        type: 'hvac',
        label: `Groupe HVAC — ${dept.label}`,
        departmentLabel: dept.label,
        lifecycleYears: EQUIPMENT_LIFECYCLE_YEARS.hvac,
        requiredDeviceId: `climate-${dept.id}`,
      });
    }
  });

  pool.push({
    id: 'chiller-central',
    type: 'chiller',
    label: 'Groupe froid central',
    departmentLabel: 'Ensemble du magasin',
    lifecycleYears: EQUIPMENT_LIFECYCLE_YEARS.chiller,
    requiredDeviceId: 'caisses',
  });

  return pool;
}

const QUARTER_LABELS = ['T1', 'T2', 'T3', 'T4'];

function getRecommendedBudgetQuarter(remainingLifeMonths) {
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + Math.max(0, remainingLifeMonths));
  return `${QUARTER_LABELS[Math.floor(targetDate.getMonth() / 3)]} ${targetDate.getFullYear()}`;
}

// Deterministically assigns 1-3 pieces of major equipment an age (skewed
// young via rng()**2 — most draws land well inside the equipment's
// lifecycle, and only occasionally does one land close enough to the end
// to enter the risk window, giving the "most equipment fine, a handful at
// risk" distribution) and derives remaining life / replacement cost /
// recommended budget quarter from it. Cost is scaled by the store's
// existing FORMAT_MULTIPLIERS — same dimension already used for
// footfall/energy cost, not a new scaling axis.
export function getEquipmentLifecycle(store) {
  const pool = getEquipmentPool(store);
  const pickRng = mulberry32(seedFromCode(`capex-pick-${store.code}`));
  const shuffled = shuffleDeterministic(pool, pickRng);
  const count = Math.min(shuffled.length, 1 + Math.floor(pickRng() * 3));
  const formatMultiplier = FORMAT_MULTIPLIERS[store.format] ?? 1.0;

  return shuffled.slice(0, count).map((equipment) => {
    const rng = mulberry32(seedFromCode(`capex-item-${store.code}-${equipment.id}`));
    const ageYears = Math.round(equipment.lifecycleYears * rng() ** 2 * 10) / 10;
    const remainingLifeMonths = Math.max(0, Math.round((equipment.lifecycleYears - ageYears) * 12));
    const [minCost, maxCost] = EQUIPMENT_COST_RANGE_TND[equipment.type];

    return {
      ...equipment,
      ageYears,
      remainingLifeMonths,
      isAtRisk: remainingLifeMonths <= CAPEX_INSIGHT_THRESHOLD_MONTHS,
      isInForecastWindow: remainingLifeMonths <= CAPEX_FORECAST_HORIZON_MONTHS,
      replacementCostRangeTND: [
        Math.round((minCost * formatMultiplier) / 100) * 100,
        Math.round((maxCost * formatMultiplier) / 100) * 100,
      ],
      recommendedQuarter: getRecommendedBudgetQuarter(remainingLifeMonths),
    };
  });
}

// Portfolio-wide rollup for the Network Intelligence overlay's "Prévision
// CapEx" panel — every equipment item within the 12-month forecast window
// across connected stores (same connected-only scope as
// getPortfolioPeakExposure), sorted most urgent first, plus a total
// estimated 12-month exposure figure. Independent of the insight-ticket
// system (no dismiss/apply runtime state to thread through) since this is
// a straight read of the underlying equipment data — the per-store Risque
// CapEx insight card (narrower 6-month threshold) is a separate, additive
// surfacing of the same getEquipmentLifecycle data, not the source of it.
export function getPortfolioCapExForecast(allStores, connectedCodes) {
  const connectedSet = new Set(connectedCodes);
  const connectedStores = allStores.filter((store) => connectedSet.has(store.code));

  const items = [];
  connectedStores.forEach((store) => {
    getEquipmentLifecycle(store)
      .filter((equipment) => equipment.isInForecastWindow)
      .forEach((equipment) => items.push({ store, equipment }));
  });

  items.sort((a, b) => a.equipment.remainingLifeMonths - b.equipment.remainingLifeMonths);

  const totalExposureTND = items.reduce((sum, item) => sum + item.equipment.replacementCostRangeTND[1], 0);

  return { items, totalExposureTND };
}

// --- Climate zone / weather-normalized comparison ------------------------

// Simple, deterministic lat/lon banding — not a real weather model, just
// enough to separate "coastal north" (Greater Tunis / Cap Bon, where most
// of the network sits), "coastal south" (Sousse/Monastir/Sfax down to
// Djerba/Gabès), and "inland" (Kef/Jendouba/Siliana/Tabarka) delegations.
// Thresholds are drawn from Tunisia's actual geography: the coast runs
// roughly east of 9.8°E, and Greater Tunis/Cap Bon sit north of ~36.3°N
// while Sousse/Sfax/the south sit below it.
export const CLIMATE_ZONES = [
  { id: 'COASTAL_NORD', label: 'Côtier Nord', factor: 1.0 },
  { id: 'COASTAL_SUD', label: 'Côtier Sud', factor: 1.1 },
  { id: 'INTERIEUR', label: 'Intérieur', factor: 1.15 },
];

// Factor >1 means that zone's climate is more energy-intensive (hotter
// summers and/or wider seasonal swings) than the coastal-north baseline —
// dividing a store's raw cost/visitor by its zone's factor is what makes
// the "adjusted" ranking not penalize it purely for being in a harsher
// climate. Fixed and visible (shown in the Classement tab's legend),
// deliberately not a black-box model.
export function getStoreClimateZone(store) {
  if (store.lon < 9.8) return CLIMATE_ZONES.find((zone) => zone.id === 'INTERIEUR');
  return store.lat >= 36.3
    ? CLIMATE_ZONES.find((zone) => zone.id === 'COASTAL_NORD')
    : CLIMATE_ZONES.find((zone) => zone.id === 'COASTAL_SUD');
}

// Purely a presentational transform of the existing costPerVisitorTND
// figure for the Classement tab's "ajusté au climat" toggle — getStoreMetrics
// itself, and every other figure derived from it, is untouched.
export function getClimateAdjustedCostPerVisitor(store) {
  const zone = getStoreClimateZone(store);
  return getStoreMetrics(store).costPerVisitorTND / zone.factor;
}
