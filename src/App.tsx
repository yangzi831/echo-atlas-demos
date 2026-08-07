import { useMemo, useState } from 'react';
import { ExplorationModePanel } from './components/ExplorationModePanel';
import { TopBar } from './components/TopBar';
import { EchoAgentPanel } from './features/agent/EchoAgentPanel';
import { UploadSoundModal } from './features/echoes/UploadSoundModal';
import { ShanghaiMap } from './features/map/ShanghaiMap';
import { SoundDetailPanel } from './features/sound/SoundDetailPanel';
import { TimeRibbon } from './features/timeline/TimeRibbon';
import { cities, soundNodes } from './data/soundNodes';
import type { SoundNode, TimePeriod } from './types/sound';

const periodOrder: TimePeriod[] = ['1990s', '2010s', '2026', 'Future Archive'];

function App() {
  const [currentCityId, setCurrentCityId] = useState('shanghai');
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
    </main>
  );
}

export default App;
