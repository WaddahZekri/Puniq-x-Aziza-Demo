// Single source of truth for turning a ticket/alert's priority label into
// the CSS class suffix used for its badge color and left-border accent —
// previously duplicated separately across InsightCard, FaultAlertCard, and
// NetworkTicketsTab.
export const PRIORITY_CLASS = {
  Urgent: 'urgent',
  Recommandé: 'recommended',
  Informationnel: 'informational',
};

export function getPriorityClass(priority) {
  return PRIORITY_CLASS[priority] ?? 'informational';
}
