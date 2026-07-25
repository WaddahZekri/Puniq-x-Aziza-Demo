import { Route, Routes } from 'react-router-dom';
import { NetworkProvider } from './context/NetworkContext';
import { FaultProvider } from './context/FaultContext';
import { IncidentsProvider } from './context/IncidentsContext';
import { DevicesProvider } from './context/DevicesContext';
import { InsightsProvider } from './context/InsightsContext';
import { ActivityFeedProvider } from './context/ActivityFeedContext';
import { SimulationTimeProvider } from './context/SimulationTimeContext';
import TopBar from './components/TopBar';
import MapScreen from './pages/MapScreen';
import './App.css';

function App() {
  return (
    <NetworkProvider>
      <IncidentsProvider>
        <DevicesProvider>
          <InsightsProvider>
            <FaultProvider>
              <ActivityFeedProvider>
                <SimulationTimeProvider>
                  <div className="app-shell">
                    <TopBar />
                    <main className="app-canvas">
                      <Routes>
                        <Route path="/" element={<MapScreen />} />
                      </Routes>
                    </main>
                  </div>
                </SimulationTimeProvider>
              </ActivityFeedProvider>
            </FaultProvider>
          </InsightsProvider>
        </DevicesProvider>
      </IncidentsProvider>
    </NetworkProvider>
  );
}

export default App;
