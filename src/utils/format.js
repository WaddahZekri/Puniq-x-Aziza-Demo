export function formatNumberFR(value) {
  return Math.round(value).toLocaleString('fr-FR');
}

export function getStoreShortName(store) {
  return store.storename.split(' - ')[0].trim().replace(/-+$/, '').trim();
}

export function getStoreLabel(store) {
  return `${getStoreShortName(store)} — ${store.ville}`;
}

export function formatRelativeTimeFR(timestamp) {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "à l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `il y a ${diffHour} h`;
  const diffDay = Math.floor(diffHour / 24);
  return `il y a ${diffDay} j`;
}
