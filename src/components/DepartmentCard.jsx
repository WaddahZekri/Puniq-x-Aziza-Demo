import DiscoveredDeviceRow from './DiscoveredDeviceRow';
import './DepartmentCard.css';

function DepartmentCard({
  department,
  benchmarkDeltaPct,
  activeFaults,
  onTriggerFault,
  activeTechnicalFaults = [],
  onTriggerTechnicalFault,
  extraDevices,
  isNewDevice,
}) {
  const isBetter = benchmarkDeltaPct >= 0;

  return (
    <div className="department-card">
      <div className="department-card__header">
        <h3 className="department-card__title">{department.label}</h3>
        <span
          className={`department-card__benchmark ${
            isBetter ? 'department-card__benchmark--good' : 'department-card__benchmark--warn'
          }`}
        >
          {isBetter ? '▲' : '▼'}
          {Math.abs(benchmarkDeltaPct)}% vs réseau
        </span>
      </div>

      {department.units.length > 0 && (
        <div className="department-card__units">
          {department.units.map((unit) => {
            const fault = activeFaults.find((f) => f.unitId === unit.unitId);
            const technicalFault = activeTechnicalFaults.find((f) => f.unitId === unit.unitId);
            return (
              <div className="department-card__unit-row" key={unit.unitId}>
                <span className="department-card__unit-name" title={unit.name}>
                  {unit.name.split(' — ')[0]}
                </span>
                <span
                  className={`department-card__unit-temp ${
                    fault ? 'department-card__unit-temp--warning' : ''
                  }`}
                >
                  {unit.liveTempC.toFixed(1)} °C
                </span>
                {fault ? (
                  <span className="department-card__fault-active" title="Panne simulée — risque de perte de stock">
                    ⚠
                  </span>
                ) : (
                  <button
                    type="button"
                    className="department-card__fault-btn"
                    title="Simuler une panne — risque de perte de stock"
                    aria-label={`Simuler une panne de réfrigération — ${unit.name}`}
                    onClick={() => onTriggerFault(unit)}
                  >
                    🔧
                  </button>
                )}
                {technicalFault ? (
                  <span
                    className="department-card__fault-active"
                    title="Signature vibratoire simulée — risque de visite technicien"
                  >
                    ⚙
                  </span>
                ) : (
                  <button
                    type="button"
                    className="department-card__fault-btn"
                    title="Simuler une signature vibratoire — risque de visite technicien"
                    aria-label={`Simuler une signature vibratoire — ${unit.name}`}
                    onClick={() => onTriggerTechnicalFault(unit)}
                  >
                    ⚙
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {department.climate && (
        <div className="department-card__row">
          <span className="department-card__row-label">Climatisation</span>
          <span className="department-card__row-value">
            {department.climate.setpointC.toFixed(1)}°C consigne · {department.climate.liveActualC.toFixed(1)}°C
            actuelle · {Math.round(department.climate.liveHumidityPct)}% humidité
          </span>
        </div>
      )}

      <div className="department-card__row">
        <span className="department-card__row-label">Éclairage</span>
        <span className="department-card__row-value">
          {Math.round(department.lighting.livePctLit)}% allumé · {department.lighting.liveConsumptionKw.toFixed(1)}{' '}
          kW
        </span>
      </div>

      {extraDevices.map((device) => (
        <DiscoveredDeviceRow key={device.id} device={device} isNew={isNewDevice(device.id)} />
      ))}
    </div>
  );
}

export default DepartmentCard;
