import { useEffect, useRef } from 'react';
import { useFault } from '../context/FaultContext';
import { useIncidents } from '../context/IncidentsContext';
import { useDevices } from '../context/DevicesContext';
import { useInsights } from '../context/InsightsContext';
import { useEnergyCostHistory } from '../hooks/useEnergyCostHistory';
import { useTicketResolvers } from '../hooks/useTicketResolvers';
import { formatNumberFR } from '../utils/format';
import EnergyCostChart from './EnergyCostChart';
import InsightCard from './InsightCard';
import FaultAlertCard from './FaultAlertCard';
import LockedTabState from './LockedTabState';
import VisionTeaser from './VisionTeaser';
import './StoreOverlayIntelligenceTab.css';

const VISION_TEASER_PROPS = {
  title: 'Phase suivante — Intelligence augmentée',
  body: (
    <>
      Croisez vos données d&rsquo;achat et de stock avec l&rsquo;intelligence PUNIQ pour anticiper vos besoins
      d&rsquo;approvisionnement selon la consommation énergétique réelle, la fréquentation et les tendances
      saisonnières par magasin.
    </>
  ),
  caption: 'Disponible après intégration de vos systèmes internes',
};

function StoreOverlayIntelligenceTab({ store, isConnected, onConnect, focusInsightId }) {
  const { activeFaults } = useFault();
  const { resolvedTicketLog } = useIncidents();
  const { getDeviceState } = useDevices();
  const { getInsightsForStore, applyInsight, getStoreImpact } = useInsights();
  const { resolveFaultTicket, resolveAdvisoryTicket } = useTicketResolvers();
  const focusedRef = useRef(null);

  const refrigerationFaults = (activeFaults[store.code] || []).filter(
    (fault) => fault.type === 'refrigeration_drift',
  );
  const compressorFaults = (activeFaults[store.code] || []).filter(
    (fault) => fault.type === 'compressor_vibration',
  );

  const storeResolvedTickets = resolvedTicketLog.filter((entry) => entry.storeCode === store.code);
  const storeCoutsEvitesTND = storeResolvedTickets.reduce((sum, entry) => sum + entry.valueTND, 0);

  // Cross-navigation from the Network Intelligence overlay lands here with
  // a specific card id to jump straight to, rather than making the user
  // hunt through the list themselves.
  useEffect(() => {
    if (focusInsightId && focusedRef.current) {
      focusedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusInsightId]);

  // Computed (and, for history, hook-backed) unconditionally, above the
  // !isConnected early return below — a hook can't be called only on some
  // renders, so this can't move any lower even though it's only rendered
  // for connected stores.
  const discoveredDeviceIds = getDeviceState(store).discoveredIds;
  const storeImpact = getStoreImpact(store, discoveredDeviceIds);
  const history = useEnergyCostHistory(store, isConnected, storeImpact.totalPctImpact);

  if (!isConnected) {
    return (
      <div className="intelligence-tab">
        <LockedTabState
          message="Aucune intelligence disponible — ce magasin n'est pas encore connecté."
          onConnect={onConnect}
        />

        <VisionTeaser {...VISION_TEASER_PROPS} />
      </div>
    );
  }

  // 'queued' tickets are real findings held back by the network-wide
  // flagged-store cap (see MapSimulationOverlay) — excluded here too so
  // this store's own detail view never contradicts what the map/bell/
  // Tickets Prioritaires panel show for it.
  const insights = getInsightsForStore(store, discoveredDeviceIds).filter(
    (insight) => insight.status !== 'queued',
  );

  return (
    <div className="intelligence-tab">
      <EnergyCostChart data={history} isConnected={isConnected} />

      <div className="intelligence-tab__insights">
        {refrigerationFaults.map((fault) => (
          <div
            key={fault.id}
            ref={`fault-${fault.id}` === focusInsightId ? focusedRef : null}
            className={`fault-${fault.id}` === focusInsightId ? 'intelligence-tab__insight--focused' : ''}
          >
            <FaultAlertCard fault={fault} onResolve={() => resolveFaultTicket(store, fault)} />
          </div>
        ))}

        {compressorFaults.map((fault) => (
          <div
            key={fault.id}
            ref={`fault-${fault.id}` === focusInsightId ? focusedRef : null}
            className={`fault-${fault.id}` === focusInsightId ? 'intelligence-tab__insight--focused' : ''}
          >
            <FaultAlertCard fault={fault} onResolve={() => resolveFaultTicket(store, fault)} />
          </div>
        ))}

        {insights.map((insight) => (
          <div
            key={insight.id}
            ref={insight.id === focusInsightId ? focusedRef : null}
            className={insight.id === focusInsightId ? 'intelligence-tab__insight--focused' : ''}
          >
            <InsightCard
              insight={insight}
              onApply={() => applyInsight(store, insight.id)}
              onDismiss={() => resolveAdvisoryTicket(store, insight)}
            />
          </div>
        ))}
      </div>

      <div className="roi-statement">
        <p className="roi-statement__text">
          {storeResolvedTickets.length > 0 ? (
            <>
              {storeResolvedTickets.length} panne{storeResolvedTickets.length > 1 ? 's' : ''} évitée
              {storeResolvedTickets.length > 1 ? 's' : ''} sur ce magasin, soit{' '}
              <span className="roi-statement__amount">{formatNumberFR(storeCoutsEvitesTND)} TND</span> de coûts
              évités.
            </>
          ) : (
            "Aucune panne évitée pour l'instant sur ce magasin — la surveillance est active."
          )}
        </p>
      </div>

      <VisionTeaser {...VISION_TEASER_PROPS} />
    </div>
  );
}

export default StoreOverlayIntelligenceTab;
