// Single source of truth for turning a store's active faults into one of
// the 3 severity tiers — every surface that colors a store (map markers,
// sidebar dot, store overview alert, notification bell) derives it from
// this same function so they can never disagree.
export function getSeverityFromFaults(faults) {
  if (!faults || faults.length === 0) return 'none';
  return faults.some((fault) => fault.severity === 'urgent') ? 'urgent' : 'routine';
}

// Reuses the app's existing priority color language (priority.css) instead
// of inventing a parallel one — 'routine' maps to the same amber already
// used for "Recommandé" insight cards, 'urgent' to the same red already
// used for "Urgent" ones.
export function severityToPriorityClass(severity) {
  if (severity === 'urgent') return 'urgent';
  if (severity === 'routine') return 'recommended';
  return 'informational';
}

export const SEVERITY_LABELS = {
  urgent: 'Urgent',
  routine: 'Routine',
};

// Fault type → ticket copy (title + description) — shared by FaultAlertCard
// (the live incident card) and useNetworkTickets (the network-wide ticket
// panel), so a fault reads identically wherever it's surfaced instead of
// each call site inventing its own text for the same fault.
const FAULT_TICKET_COPY = {
  refrigeration_drift: (fault) => ({
    title: `Dérive de température détectée — ${fault.departmentLabel}, ${fault.unitName.split(' — ')[0]}`,
    description: 'Écart de 3.2°C sur les 6 dernières heures. Risque de perte de stock si non traité dans 48h.',
  }),
  compressor_vibration: (fault) => ({
    title: `Signature vibratoire anormale — ${fault.departmentLabel}, ${fault.unitName.split(' — ')[0]}`,
    description:
      'Vibration en hausse de 18% vs référence constructeur. Risque de panne nécessitant une visite technicien si non traité.',
  }),
};

export function getFaultTicketCopy(fault) {
  return FAULT_TICKET_COPY[fault.type](fault);
}

// Fault type → "Coûts évités" category + TND seed prefix — shared by
// useTicketResolvers (what actually gets recorded on resolve) and
// useNetworkTickets (the same figure previewed before resolution), so a
// fault-ticket's estimated impact never changes value the moment it's
// resolved.
export const FAULT_RESOLUTION_CONFIG = {
  refrigeration_drift: { category: 'stock_loss', seedPrefix: '' },
  compressor_vibration: { category: 'technician_callout', seedPrefix: 'technical-' },
};
