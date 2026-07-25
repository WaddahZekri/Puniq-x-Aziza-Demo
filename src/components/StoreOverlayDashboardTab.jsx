import { useMemo } from 'react';
import { useFault } from '../context/FaultContext';
import { useNetwork } from '../context/NetworkContext';
import { useDevices } from '../context/DevicesContext';
import { useInsights } from '../context/InsightsContext';
import { useDriftingValues } from '../hooks/useDriftingValues';
import { useSlowCounters } from '../hooks/useSlowCounter';
import { useStoreDepartments } from '../hooks/useStoreDepartments';
import { useLogisticsZones } from '../hooks/useLogisticsZones';
import { getZoneBenchmarkDelta, getTOUCostBreakdown } from '../utils/metricsEngine';
import { getStoreDevices } from '../utils/deviceModel';
import { getZoneBaselines } from '../utils/zoneSimulation';
import ZoneCard, { ZoneReading } from './ZoneCard';
import DepartmentCard from './DepartmentCard';
import LogisticsZoneCard from './LogisticsZoneCard';
import DiscoveredDeviceRow from './DiscoveredDeviceRow';
import LockedTabState from './LockedTabState';
import TOUCostChart from './TOUCostChart';
import './StoreOverlayDashboardTab.css';

const NEW_DEVICE_TAG_DURATION_MS = 8000;

function StoreOverlayDashboardTab({ store, isConnected, onConnect }) {
  const { activeFaults, triggerFault } = useFault();
  const { allStores } = useNetwork();
  const { getDeviceState } = useDevices();
  const { getStoreImpact } = useInsights();

  const baseDepartments = useStoreDepartments(store);
  const zones = useLogisticsZones(store);
  const baselines = useMemo(() => getZoneBaselines(store), [store]);
  const { undiscoveredPool } = useMemo(() => getStoreDevices(store), [store]);
  const touBreakdown = useMemo(() => getTOUCostBreakdown(store), [store]);

  const deviceState = getDeviceState(store);
  const discoveredIds = deviceState.discoveredIds;
  const discoveredPoolDevices = undiscoveredPool.filter((device) => discoveredIds.includes(device.id));
  const storeImpact = getStoreImpact(store, discoveredIds);

  // Layers any applied-and-measured insight adjustments (setpoint/lighting)
  // on top of the base baseline, so a card applied from the Intelligence tab
  // shows up here as a genuinely updated reading, not just a toast elsewhere.
  const departments = baseDepartments.map((dept) => {
    const adjustment = storeImpact.adjustmentsByDepartment[dept.id];
    if (!adjustment) return dept;
    return {
      ...dept,
      climate: dept.climate
        ? { ...dept.climate, setpointC: Number((dept.climate.setpointC + adjustment.setpointDeltaC).toFixed(1)) }
        : null,
      lighting: {
        ...dept.lighting,
        pctLit: Math.max(0, Math.min(100, Math.round(dept.lighting.pctLit + adjustment.lightingPctDelta))),
      },
    };
  });

  const isNewDevice = (deviceId) => {
    const at = deviceState.discoveredAt[deviceId];
    return typeof at === 'number' && Date.now() - at < NEW_DEVICE_TAG_DURATION_MS;
  };

  const storeFaults = activeFaults[store.code] || [];
  const refrigerationFaults = storeFaults.filter((fault) => fault.type === 'refrigeration_drift');
  const compressorFaults = storeFaults.filter((fault) => fault.type === 'compressor_vibration');

  const driftEntries = useMemo(() => {
    const entries = [];

    departments.forEach((dept) => {
      dept.units.forEach((unit) => {
        const fault = refrigerationFaults.find((f) => f.unitId === unit.unitId);
        const [rangeMin, rangeMax] = unit.tempRange;
        entries.push({
          key: `unit:${unit.unitId}`,
          initialValue: unit.tempC,
          min: fault ? rangeMax : rangeMin,
          max: fault ? rangeMax + 14 : rangeMax,
          step: fault ? 0.4 : 0.15,
          bias: fault ? 0.25 : 0,
        });
      });

      if (dept.climate) {
        entries.push({
          key: `climateActual:${dept.id}`,
          initialValue: dept.climate.actualC,
          min: dept.climate.setpointC - 2,
          max: dept.climate.setpointC + 3,
          step: 0.2,
        });
        entries.push({
          key: `climateHumidity:${dept.id}`,
          initialValue: dept.climate.humidityPct,
          min: 30,
          max: 70,
          step: 1,
        });
      }

      entries.push({
        key: `lightingPct:${dept.id}`,
        initialValue: dept.lighting.pctLit,
        min: 40,
        max: 100,
        step: 2,
      });
      entries.push({
        key: `lightingKw:${dept.id}`,
        initialValue: dept.lighting.consumptionKw,
        min: 0.5,
        max: 8,
        step: 0.3,
      });
    });

    zones.forEach((zone) => {
      entries.push({
        key: `zoneTemp:${zone.id}`,
        initialValue: zone.tempC,
        min: zone.tempRange[0] - 1,
        max: zone.tempRange[1] + 1,
        step: zone.id === 'reserve' ? 0.4 : 0.15,
      });
      entries.push({
        key: `zoneHumidity:${zone.id}`,
        initialValue: zone.humidityPct,
        min: 30,
        max: 80,
        step: 1,
      });
    });

    entries.push({
      key: 'solarKwh',
      initialValue: baselines.solaire.kwhGenerated,
      min: 0,
      max: 40,
      step: 1,
    });

    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments, zones, baselines, refrigerationFaults.length]);

  const liveValues = useDriftingValues(driftEntries, 3000);

  const counterEntries = useMemo(
    () =>
      zones
        .filter((zone) => zone.hasDoorTracking)
        .map((zone) => ({
          key: `doorCount:${zone.id}`,
          initialValue: zone.doorOpenCountToday,
          max: zone.doorOpenCountToday + 4,
        })),
    [zones],
  );
  const doorCounts = useSlowCounters(counterEntries, 25000);

  if (!isConnected) {
    return (
      <LockedTabState
        message="Ce magasin n'est pas encore connecté à PUNIQ. Aucune donnée de surveillance disponible."
        onConnect={onConnect}
      />
    );
  }

  const resolvedDepartments = departments.map((dept) => ({
    ...dept,
    units: dept.units
      .filter((unit) => discoveredIds.includes(unit.unitId))
      .map((unit) => ({
        ...unit,
        liveTempC: liveValues[`unit:${unit.unitId}`] ?? unit.tempC,
      })),
    climate: dept.climate
      ? {
          ...dept.climate,
          liveActualC: liveValues[`climateActual:${dept.id}`] ?? dept.climate.actualC,
          liveHumidityPct: liveValues[`climateHumidity:${dept.id}`] ?? dept.climate.humidityPct,
        }
      : null,
    lighting: {
      ...dept.lighting,
      livePctLit: liveValues[`lightingPct:${dept.id}`] ?? dept.lighting.pctLit,
      liveConsumptionKw: liveValues[`lightingKw:${dept.id}`] ?? dept.lighting.consumptionKw,
    },
  }));

  const resolvedZones = zones.map((zone) => ({
    ...zone,
    liveTempC: liveValues[`zoneTemp:${zone.id}`] ?? zone.tempC,
    liveHumidityPct: liveValues[`zoneHumidity:${zone.id}`] ?? zone.humidityPct,
    liveDoorOpenCountToday: zone.hasDoorTracking
      ? doorCounts[`doorCount:${zone.id}`] ?? zone.doorOpenCountToday
      : null,
  }));

  const kwhGenerated = liveValues.solarKwh ?? baselines.solaire.kwhGenerated;

  return (
    <div className="dashboard-tab">
      <section className="dashboard-tab__section">
        <h3 className="dashboard-tab__section-title">Coût par tranche horaire</h3>
        <TOUCostChart data={touBreakdown} />
      </section>

      <section className="dashboard-tab__section">
        <h3 className="dashboard-tab__section-title">Rayons de vente</h3>
        <div className="dashboard-tab__grid">
          {resolvedDepartments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              benchmarkDeltaPct={getZoneBenchmarkDelta(store, dept.id, allStores)}
              activeFaults={refrigerationFaults}
              activeTechnicalFaults={compressorFaults}
              extraDevices={discoveredPoolDevices.filter((device) => device.department === dept.id)}
              isNewDevice={isNewDevice}
              onTriggerFault={(unit) =>
                triggerFault(store.code, 'refrigeration_drift', {
                  departmentLabel: dept.label,
                  unitName: unit.name,
                  unitId: unit.unitId,
                  severity: 'urgent',
                })
              }
              onTriggerTechnicalFault={(unit) =>
                triggerFault(store.code, 'compressor_vibration', {
                  departmentLabel: dept.label,
                  unitName: unit.name,
                  unitId: unit.unitId,
                  severity: 'urgent',
                })
              }
            />
          ))}
        </div>
      </section>

      <section className="dashboard-tab__section">
        <h3 className="dashboard-tab__section-title">Zones logistiques</h3>
        <div className="dashboard-tab__grid">
          {resolvedZones.map((zone) => (
            <LogisticsZoneCard
              key={zone.id}
              zone={zone}
              extraDevices={discoveredPoolDevices.filter(
                (device) => device.department === null && device.zoneLabel === zone.label,
              )}
              isNewDevice={isNewDevice}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-tab__section">
        <h3 className="dashboard-tab__section-title">Infrastructure</h3>
        <div className="dashboard-tab__grid">
          <ZoneCard title="Caisses">
            <ZoneReading label="Actives" value={baselines.caisses.active} />
            <ZoneReading label="En veille" value={baselines.caisses.standby} />
            {discoveredPoolDevices
              .filter((device) => device.zoneLabel === 'Infrastructure')
              .map((device) => (
                <DiscoveredDeviceRow key={device.id} device={device} isNew={isNewDevice(device.id)} />
              ))}
          </ZoneCard>

          <ZoneCard title="Solaire" statusLabel={baselines.solaire.installed ? 'Actif' : 'Non installé'}>
            {baselines.solaire.installed ? (
              <ZoneReading label="Génération" value={`${kwhGenerated.toFixed(1)} kWh`} />
            ) : (
              <p className="zone-card__empty">Panneaux non installés sur ce site.</p>
            )}
          </ZoneCard>
        </div>
      </section>
    </div>
  );
}

export default StoreOverlayDashboardTab;
