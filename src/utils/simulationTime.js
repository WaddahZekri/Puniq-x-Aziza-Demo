const MONTH_NAMES_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

// Simulation always starts at Mois 1 = this anchor — gives the trend
// sparklines a fixed, meaningful x-axis regardless of when the demo is run.
const SIMULATION_START_YEAR = 2026;

// A pure safety backstop against an unbounded setTimeout chain running
// literally forever (e.g. a session left open for days) — not a demo-facing
// ceiling. Deliberately far beyond anything a demo session would ever
// reach (thousands of months = centuries), so month progression is
// effectively indefinite in practice, in both Auto and Manuel.
export const AUTO_ADVANCE_MONTH_CEILING_INDEX = 9999;

export function getSimulatedPeriod(monthIndex) {
  const monthNumber = monthIndex + 1;
  const year = SIMULATION_START_YEAR + Math.floor(monthIndex / 12);
  const monthName = MONTH_NAMES_FR[monthIndex % 12];
  return { monthNumber, label: `${monthName} ${year}` };
}
