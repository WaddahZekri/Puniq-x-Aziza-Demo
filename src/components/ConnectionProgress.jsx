import { useNetwork } from '../context/NetworkContext';
import { useCountUp } from '../hooks/useCountUp';
import './ConnectionProgress.css';

// Deliberately separate from MapSimulationOverlay (the Manuel/Auto toggle
// and "Magasin suivant" button) — this line stays put in the fixed sidebar
// even though the simulation controls that drive it moved onto the map.
function ConnectionProgress() {
  const { allStores, connectedCodes } = useNetwork();
  const total = allStores.length;
  const connectedDisplay = Math.round(useCountUp(connectedCodes.length));

  return (
    <p className="connection-progress">
      {connectedDisplay} / {total} magasins connectés
    </p>
  );
}

export default ConnectionProgress;
