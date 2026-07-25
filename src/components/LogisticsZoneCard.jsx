import DiscoveredDeviceRow from './DiscoveredDeviceRow';
import './LogisticsZoneCard.css';

function LogisticsZoneCard({ zone, extraDevices, isNewDevice }) {
  return (
    <div className="logistics-zone-card">
      <h3 className="logistics-zone-card__title">{zone.label}</h3>

      <div className="logistics-zone-card__row">
        <span className="logistics-zone-card__row-label">Température</span>
        <span className="logistics-zone-card__row-value">{zone.liveTempC.toFixed(1)} °C</span>
      </div>

      <div className="logistics-zone-card__row">
        <span className="logistics-zone-card__row-label">Humidité</span>
        <span className="logistics-zone-card__row-value">{Math.round(zone.liveHumidityPct)}%</span>
      </div>

      {zone.hasDoorTracking && (
        <div className="logistics-zone-card__row">
          <span className="logistics-zone-card__row-label">Porte</span>
          <span
            className={`logistics-zone-card__row-value ${
              zone.doorStatus === 'Ouverte' ? 'logistics-zone-card__row-value--warning' : ''
            }`}
          >
            {zone.doorStatus} · {zone.liveDoorOpenCountToday} ouverture
            {zone.liveDoorOpenCountToday > 1 ? 's' : ''} aujourd&rsquo;hui
          </span>
        </div>
      )}

      <div className="logistics-zone-card__capacity">
        <div className="logistics-zone-card__row">
          <span className="logistics-zone-card__row-label">Capacité</span>
          <span className="logistics-zone-card__row-value">{zone.capacityPct}%</span>
        </div>
        <div className="logistics-zone-card__capacity-bar">
          <div className="logistics-zone-card__capacity-fill" style={{ width: `${zone.capacityPct}%` }} />
        </div>
      </div>

      {extraDevices.map((device) => (
        <DiscoveredDeviceRow key={device.id} device={device} isNew={isNewDevice(device.id)} />
      ))}
    </div>
  );
}

export default LogisticsZoneCard;
