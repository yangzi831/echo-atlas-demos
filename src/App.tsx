import { useMemo, useState } from 'react';
import { ExplorationModePanel } from './components/ExplorationModePanel';
import { TopBar } from './components/TopBar';
import {
  ParticleEarth,
} from '../demos/global-earth-prototype/src/ParticleEarth';
import type {
  City as GlobalCity,
} from '../demos/global-earth-prototype/src/cities';
import { EchoAgentPanel } from './features/agent/EchoAgentPanel';
import { UploadSoundModal } from './features/echoes/UploadSoundModal';
import { ShanghaiMap } from './features/map/ShanghaiMap';
import { SoundDetailPanel } from './features/sound/SoundDetailPanel';
import { TimeRibbon } from './features/timeline/TimeRibbon';
import { cities, soundNodes } from './data/soundNodes';
import type { SoundNode, TimePeriod } from './types/sound';

const periodOrder: TimePeriod[] = ['1990s', '2010s', '2026', 'Future Archive'];
type ViewMode = 'global' | 'city';

const globalCities: GlobalCity[] = cities.map((city) => ({
  cityId: city.id,
  name: city.name,
  lat: city.center[1],
  lng: city.center[0],
  echoes: soundNodes.filter((node) => node.cityId === city.id).length,
}));

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [currentCityId, setCurrentCityId] = useState('shanghai');
  const [selectedGlobalCity, setSelectedGlobalCity] = useState<GlobalCity>();
  const [cityFocusRequest, setCityFocusRequest] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('2026');
  const [selectedNode, setSelectedNode] = useState<SoundNode | undefined>(
    soundNodes.find((node) => node.id === 'bus-stop-rain-night'),
  );
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);

  const currentCity = cities.find((city) => city.id === currentCityId) ?? cities[0];
  const currentCityNodes = useMemo(
    () => soundNodes.filter((node) => node.cityId === currentCityId),
    [currentCityId],
  );
  const availablePeriods = useMemo(
    () => periodOrder.filter((period) =>
      currentCityNodes.some((node) => node.timePeriod === period),
    ),
    [currentCityNodes],
  );
  const visibleNodes = useMemo(
    () => currentCityNodes.filter((node) => node.timePeriod === selectedPeriod),
    [currentCityNodes, selectedPeriod],
  );

  const handleSelectCity = (cityId: string) => {
    const nextCityNodes = soundNodes.filter((node) => node.cityId === cityId);
    const nextPeriod = nextCityNodes.some((node) => node.timePeriod === '2026')
      ? '2026'
      : nextCityNodes[0]?.timePeriod ?? '2026';

    setCurrentCityId(cityId);
    setSelectedPeriod(nextPeriod);
    setSelectedNode(undefined);
    setHighlightedNodeIds([]);
  };

  const handleSelectGlobalCity = (city: GlobalCity) => {
    if (!cities.some((item) => item.id === city.cityId)) {
      return;
    }

    setSelectedGlobalCity(city);
    handleSelectCity(city.cityId);
    setIsModeOpen(false);
    setViewMode('city');
    setCityFocusRequest((value) => value + 1);
  };

  const handleSelectNodeById = (nodeId: string) => {
    const node = soundNodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }
    setSelectedPeriod(node.timePeriod);
    setSelectedNode(node);
  };

  return (
    <main className="app-shell">
      <div
        className={`global-earth-view ${viewMode === 'global' ? 'is-visible' : 'is-hidden'}`}
        aria-hidden={viewMode === 'city'}
      >
        <ParticleEarth
          cities={globalCities}
          selectedCity={selectedGlobalCity}
          onSelectCity={handleSelectGlobalCity}
        />

        <header className="prototype-header">
          <p className="prototype-kicker">Echo Atlas / Earth 01</p>
          <h1>Global Listening Field</h1>
          <p className="prototype-subtitle">城市声音记忆的全球入口</p>
        </header>

        <footer className="prototype-footer">
          <div>
            <span>ACTIVE CITIES</span>
            <strong>{String(globalCities.length).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>MEMORY SIGNALS</span>
            <strong>{globalCities.reduce((sum, city) => sum + city.echoes, 0)}</strong>
          </div>
          <div className="selected-readout">
            <span>CURRENT SIGNAL</span>
            <strong>{selectedGlobalCity?.name ?? 'GLOBAL'}</strong>
          </div>
        </footer>
      </div>

      <div
        className={`city-view ${viewMode === 'city' ? 'is-visible' : 'is-hidden'}`}
        aria-hidden={viewMode === 'global'}
      >
        <TopBar
          city={currentCity}
          selectedPeriod={selectedPeriod}
          onToggleAgent={() => setIsAgentOpen((value) => !value)}
          onOpenUpload={() => setIsUploadOpen(true)}
          onToggleMode={() => setIsModeOpen((value) => !value)}
          isAgentOpen={isAgentOpen}
          isModeOpen={isModeOpen}
        />

        <ShanghaiMap
          city={currentCity}
          nodes={visibleNodes}
          selectedNodeId={selectedNode?.id}
          highlightedNodeIds={highlightedNodeIds}
          focusRequest={cityFocusRequest}
          onSelectNode={setSelectedNode}
        />

        <ExplorationModePanel
          isOpen={isModeOpen}
          cities={cities}
          currentCityId={currentCityId}
          onSelectCity={handleSelectCity}
        />

        <EchoAgentPanel
          isOpen={isAgentOpen}
          onRoute={setHighlightedNodeIds}
          onSelectNode={handleSelectNodeById}
        />

        <SoundDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(undefined)}
        />

        <TimeRibbon
          periods={availablePeriods}
          selected={selectedPeriod}
          onSelect={(period) => {
            setSelectedPeriod(period);
            const firstNode = currentCityNodes.find(
              (node) => node.timePeriod === period,
            );
            setSelectedNode(firstNode);
          }}
        />

        <UploadSoundModal
          isOpen={isUploadOpen}
          onClose={() => {
            setIsUploadOpen(false);
          }}
        />
      </div>
    </main>
  );
}

export default App;
