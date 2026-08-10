import { useEffect, useMemo, useState } from 'react';
import { ExplorationModePanel } from './components/ExplorationModePanel';
import { TopBar } from './components/TopBar';
import { ParticleEarth } from '../demos/global-earth-prototype/src/ParticleEarth';
import type { City as GlobalCity } from '../demos/global-earth-prototype/src/cities';
import { EchoAgentPanel } from './features/agent/EchoAgentPanel';
import { UploadSoundModal } from './features/echoes/UploadSoundModal';
import { CityEntryOverlay } from './features/map/CityEntryOverlay';
import { EmptyPlaceState } from './features/map/EmptyPlaceState';
import { ShanghaiMap } from './features/map/ShanghaiMap';
import { MyLibraryPanel } from './features/sound/MyLibraryPanel';
import { SoundDetailPanel } from './features/sound/SoundDetailPanel';
import { StoryModePanel } from './features/sound/StoryModePanel';
import { StorySuggestionCard } from './features/sound/StorySuggestionCard';
import { TimeRibbon } from './features/timeline/TimeRibbon';
import { getCityStory } from './data/listeningStories';
import { cities, soundNodes } from './data/soundNodes';
import type { GeocodingResult } from './services/maptiler';
import { describeTimeFilter, filterMemoriesByTime } from './services/time';
import type { City, ListeningStory, SoundNode, TimeFilter } from './types/sound';

type ViewMode = 'global' | 'city';
type MapScope = 'all' | 'mine';
type ExploredPlace = City & { context: string; matchedCityId?: string };
type ArrivalTransition = { key: number; title: string; meta?: string };

function distanceInKilometers(a: [number, number], b: [number, number]) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(b[1] - a[1]);
  const longitudeDelta = toRadians(b[0] - a[0]);
  const latitudeA = toRadians(a[1]);
  const latitudeB = toRadians(b[1]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function placeId(result: GeocodingResult) {
  return `place-${result.id.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
}

function App() {
  const [soundMemories, setSoundMemories] = useState<SoundNode[]>(soundNodes);
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [currentCityId, setCurrentCityId] = useState('shanghai');
  const [selectedGlobalCity, setSelectedGlobalCity] = useState<GlobalCity>();
  const [exploredPlace, setExploredPlace] = useState<ExploredPlace>();
  const [arrivalTransition, setArrivalTransition] = useState<ArrivalTransition>();
  const [showStorySuggestion, setShowStorySuggestion] = useState(false);
  const [activeStory, setActiveStory] = useState<ListeningStory>();
  const [storyStepIndex, setStoryStepIndex] = useState(0);
  const [playingNodeId, setPlayingNodeId] = useState<string>();
  const [mapFocusNodeId, setMapFocusNodeId] = useState<string>();
  const [cityFocusRequest, setCityFocusRequest] = useState(0);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>({ mode: 'all' });
  const [mapScope, setMapScope] = useState<MapScope>('all');
  const [selectedNode, setSelectedNode] = useState<SoundNode>();
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);

  const globalCities = useMemo<GlobalCity[]>(
    () => cities.map((city) => ({
      cityId: city.id,
      name: city.name,
      lat: city.center[1],
      lng: city.center[0],
      echoes: soundMemories.filter((node) => node.cityId === city.id).length,
    })),
    [soundMemories],
  );
  const recommendedCity = cities.find((city) => city.id === currentCityId) ?? cities[0];
  const currentCity = exploredPlace ?? recommendedCity;
  const currentCityNodes = useMemo(
    () => soundMemories.filter((node) => node.cityId === currentCity.id),
    [currentCity.id, soundMemories],
  );
  const scopedNodes = useMemo(
    () => mapScope === 'mine' ? currentCityNodes.filter((node) => node.isMine) : currentCityNodes,
    [currentCityNodes, mapScope],
  );
  const visibleNodes = useMemo(
    () => filterMemoriesByTime(currentCityNodes, timeFilter),
    [currentCityNodes, timeFilter],
  );
  const currentCityStory = getCityStory(currentCity.id);
  const storyNode = activeStory
    ? soundMemories.find((node) => node.id === activeStory.nodeIds[storyStepIndex])
    : undefined;
  const mapFocusNode = storyNode
    ?? soundMemories.find((node) => node.id === mapFocusNodeId);

  useEffect(() => {
    if (selectedNode && !visibleNodes.some((node) => node.id === selectedNode.id)) {
      setSelectedNode(undefined);
    }
  }, [selectedNode, visibleNodes]);

  const handleSelectCity = (cityId: string) => {
    const city = cities.find((item) => item.id === cityId);
    if (!city) {
      return;
    }

    setCurrentCityId(cityId);
    setExploredPlace(undefined);
    setTimeFilter({ mode: 'all' });
    setMapScope('all');
    setSelectedNode(undefined);
    setHighlightedNodeIds([]);
    setActiveStory(undefined);
    setStoryStepIndex(0);
    setPlayingNodeId(undefined);
    setMapFocusNodeId(undefined);
    setArrivalTransition({
      key: Date.now(),
      title: city.name,
      meta: `${city.localName} · ${soundMemories.filter((node) => node.cityId === city.id).length}段公开声音`,
    });
    setShowStorySuggestion(false);
    setIsModeOpen(false);
    setCityFocusRequest((value) => value + 1);
  };

  const handleSelectGlobalCity = (city: GlobalCity) => {
    if (!cities.some((item) => item.id === city.cityId)) {
      return;
    }
    setSelectedGlobalCity(city);
    handleSelectCity(city.cityId);
    setIsModeOpen(false);
    setViewMode('city');
  };

  const handleExplorePlace = (result: GeocodingResult) => {
    const nearestCity = cities
      .map((city) => ({ city, distance: distanceInKilometers(city.center, result.center) }))
      .sort((a, b) => a.distance - b.distance)[0];
    const matchedCity = nearestCity && nearestCity.distance < 70 ? nearestCity.city : undefined;
    const cityId = matchedCity?.id ?? placeId(result);
    const nextPlace: ExploredPlace = {
      id: cityId,
      name: result.name,
      localName: result.name,
      country: matchedCity?.country ?? result.context,
      center: result.center,
      zoom: result.placeType === 'place' ? 12.4 : 16.2,
      timeZone: matchedCity?.timeZone ?? 'UTC',
      context: result.context,
      matchedCityId: matchedCity?.id,
    };

    setCurrentCityId(cityId);
    setExploredPlace(nextPlace);
    setViewMode('city');
    setTimeFilter({ mode: 'all' });
    setMapScope('all');
    setSelectedNode(undefined);
    setHighlightedNodeIds([]);
    setActiveStory(undefined);
    setStoryStepIndex(0);
    setPlayingNodeId(undefined);
    setMapFocusNodeId(undefined);
    setIsAgentOpen(false);
    setIsLibraryOpen(false);
    setIsModeOpen(false);
    setShowStorySuggestion(false);
    setArrivalTransition({
      key: Date.now(),
      title: result.name,
      meta: result.context,
    });
    setCityFocusRequest((value) => value + 1);
  };

  const handleStartStory = (story: ListeningStory) => {
    if (story.cityId !== currentCityId) {
      setCurrentCityId(story.cityId);
      setCityFocusRequest((value) => value + 1);
    }
    setExploredPlace(undefined);
    setViewMode('city');
    setTimeFilter({ mode: 'all' });
    setMapScope('all');
    setSelectedNode(undefined);
    setActiveStory(story);
    setStoryStepIndex(0);
    setHighlightedNodeIds(story.nodeIds);
    setPlayingNodeId(undefined);
    setMapFocusNodeId(undefined);
    setArrivalTransition(undefined);
    setShowStorySuggestion(false);
    setIsAgentOpen(false);
    setIsLibraryOpen(false);
    setIsModeOpen(false);
  };

  const handleExitStory = () => {
    setActiveStory(undefined);
    setStoryStepIndex(0);
    setPlayingNodeId(undefined);
    setHighlightedNodeIds([]);
    setShowStorySuggestion(false);
  };

  const revealNode = (node: SoundNode) => {
    setExploredPlace(undefined);
    if (node.cityId !== currentCityId) {
      setCurrentCityId(node.cityId);
      setCityFocusRequest((value) => value + 1);
    }
    setTimeFilter({ mode: 'all' });
    if (!node.isMine && mapScope === 'mine') {
      setMapScope('all');
    }
    setActiveStory(undefined);
    setShowStorySuggestion(false);
    setPlayingNodeId(undefined);
    setMapFocusNodeId(node.id);
    setSelectedNode(node);
  };

  const handleSelectNodeById = (nodeId: string) => {
    const node = soundMemories.find((item) => item.id === nodeId);
    if (node) {
      revealNode(node);
    }
  };

  const handleAgentRoute = (nodeIds: string[]) => {
    const firstNode = soundMemories.find((node) => node.id === nodeIds[0]);
    if (firstNode) {
      setExploredPlace(undefined);
    }
    if (firstNode && firstNode.cityId !== currentCityId) {
      setCurrentCityId(firstNode.cityId);
      setCityFocusRequest((value) => value + 1);
    }
    setTimeFilter({ mode: 'all' });
    setMapScope('all');
    setHighlightedNodeIds(nodeIds);
    setActiveStory(undefined);
    setPlayingNodeId(undefined);
    setArrivalTransition(undefined);
    setShowStorySuggestion(false);
    setMapFocusNodeId(firstNode?.id);
  };

  const handleCreateMemory = (node: SoundNode) => {
    setSoundMemories((current) => [node, ...current]);
    setTimeFilter({ mode: 'all' });
    setMapScope('mine');
    setHighlightedNodeIds([node.id]);
    setMapFocusNodeId(node.id);
    setSelectedNode(node);
  };

  const handleToggleLibrary = () => {
    const nextOpen = !isLibraryOpen;
    setIsLibraryOpen(nextOpen);
    if (nextOpen) {
      setSelectedNode(undefined);
      setIsAgentOpen(false);
      setIsModeOpen(false);
      setActiveStory(undefined);
      setPlayingNodeId(undefined);
      setShowStorySuggestion(false);
    }
  };

  const handleOpenUpload = () => {
    setIsUploadOpen(true);
    setIsLibraryOpen(false);
    setIsAgentOpen(false);
    setIsModeOpen(false);
    setSelectedNode(undefined);
    setActiveStory(undefined);
    setPlayingNodeId(undefined);
    setShowStorySuggestion(false);
  };

  return (
    <main className="app-shell">
      <div className={`global-earth-view ${viewMode === 'global' ? 'is-visible' : 'is-hidden'}`} aria-hidden={viewMode === 'city'}>
        <ParticleEarth cities={globalCities} selectedCity={selectedGlobalCity} onSelectCity={handleSelectGlobalCity} />
        <nav className="global-city-accessibility" aria-label="选择城市">
          {globalCities.map((city) => (
            <button type="button" key={city.cityId} onClick={() => handleSelectGlobalCity(city)}>
              {city.name}
            </button>
          ))}
        </nav>
        <header className="prototype-header">
          <p className="prototype-kicker">Echo Atlas / Earth 01</p>
          <h1>Global Listening Field</h1>
          <p className="prototype-subtitle">城市声音记忆的全球入口</p>
        </header>
        <footer className="prototype-footer">
          <div><span>ACTIVE CITIES</span><strong>{String(globalCities.length).padStart(2, '0')}</strong></div>
          <div><span>MEMORY SIGNALS</span><strong>{soundMemories.length}</strong></div>
          <div className="selected-readout"><span>CURRENT SIGNAL</span><strong>{selectedGlobalCity?.name ?? 'GLOBAL'}</strong></div>
        </footer>
      </div>

      <div
        className={`city-view ${viewMode === 'city' ? 'is-visible' : 'is-hidden'} ${activeStory ? 'is-story-active' : ''}`}
        aria-hidden={viewMode === 'global'}
      >
        <TopBar
          city={currentCity}
          timeLabel={describeTimeFilter(timeFilter)}
          onToggleAgent={() => {
            setIsAgentOpen((value) => !value);
            setIsLibraryOpen(false);
            setIsModeOpen(false);
          }}
          onOpenUpload={handleOpenUpload}
          onToggleLibrary={handleToggleLibrary}
          onToggleMode={() => {
            setIsModeOpen((value) => !value);
            setIsLibraryOpen(false);
            setIsAgentOpen(false);
          }}
          isAgentOpen={isAgentOpen}
          isModeOpen={isModeOpen}
          isLibraryOpen={isLibraryOpen}
        />

        <ShanghaiMap
          city={currentCity}
          nodes={visibleNodes}
          allNodes={currentCityNodes}
          searchNodes={soundMemories}
          suggestedCities={cities}
          selectedNodeId={selectedNode?.id}
          playingNodeId={playingNodeId}
          highlightedNodeIds={highlightedNodeIds}
          dimUnowned={mapScope === 'mine'}
          focusNode={mapFocusNode}
          focusRequest={cityFocusRequest}
          onExplorePlace={handleExplorePlace}
          onSelectNode={(node) => {
            setActiveStory(undefined);
            setShowStorySuggestion(false);
            setPlayingNodeId(undefined);
            setMapFocusNodeId(node.id);
            setSelectedNode(node);
          }}
        />

        {arrivalTransition && (
          <CityEntryOverlay
            title={arrivalTransition.title}
            meta={arrivalTransition.meta}
            transitionKey={arrivalTransition.key}
            onComplete={() => {
              setArrivalTransition(undefined);
              setShowStorySuggestion(Boolean(currentCityStory));
            }}
          />
        )}

        {!arrivalTransition && currentCityNodes.length === 0 && !isUploadOpen && (
          <EmptyPlaceState placeName={currentCity.name} onRecord={handleOpenUpload} />
        )}

        {showStorySuggestion
          && currentCityStory
          && !activeStory
          && !selectedNode
          && !isAgentOpen
          && !isLibraryOpen
          && !isModeOpen
          && !isUploadOpen && (
            <StorySuggestionCard
              story={currentCityStory}
              onStart={() => handleStartStory(currentCityStory)}
              onDismiss={() => setShowStorySuggestion(false)}
            />
          )}

        <ExplorationModePanel isOpen={isModeOpen} cities={cities} currentCityId={currentCityId} onSelectCity={handleSelectCity} />
        <EchoAgentPanel
          isOpen={isAgentOpen}
          nodes={soundMemories}
          onRoute={handleAgentRoute}
          onSelectNode={handleSelectNodeById}
          onStartStory={handleStartStory}
        />
        <SoundDetailPanel
          node={selectedNode}
          onClose={() => {
            setSelectedNode(undefined);
            setPlayingNodeId(undefined);
          }}
          onPlayingChange={(isPlaying) => setPlayingNodeId(isPlaying ? selectedNode?.id : undefined)}
        />
        <StoryModePanel
          story={activeStory}
          node={storyNode}
          stepIndex={storyStepIndex}
          isPlaying={playingNodeId === storyNode?.id}
          onTogglePlay={() => setPlayingNodeId((current) => current === storyNode?.id ? undefined : storyNode?.id)}
          onPrevious={() => {
            setPlayingNodeId(undefined);
            setStoryStepIndex((current) => Math.max(0, current - 1));
          }}
          onNext={() => {
            setPlayingNodeId(undefined);
            setStoryStepIndex((current) => activeStory && current === activeStory.nodeIds.length - 1 ? 0 : current + 1);
          }}
          onExit={handleExitStory}
        />
        <MyLibraryPanel
          isOpen={isLibraryOpen}
          nodes={soundMemories}
          mapScope={mapScope}
          onChangeMapScope={(scope) => {
            setMapScope(scope);
            setTimeFilter({ mode: 'all' });
            setSelectedNode(undefined);
            setActiveStory(undefined);
            setPlayingNodeId(undefined);
            setHighlightedNodeIds(
              scope === 'mine'
                ? currentCityNodes.filter((node) => node.isMine).map((node) => node.id)
                : [],
            );
            if (scope === 'mine') {
              setCityFocusRequest((value) => value + 1);
            }
          }}
          onClose={() => setIsLibraryOpen(false)}
          onSelectNode={(node) => {
            revealNode(node);
            setIsLibraryOpen(false);
          }}
        />
        {currentCityNodes.length > 0 && (
          <TimeRibbon nodes={scopedNodes} filter={timeFilter} onChange={(filter) => {
            setTimeFilter(filter);
            setSelectedNode(undefined);
          }} />
        )}
        <UploadSoundModal
          isOpen={isUploadOpen}
          city={currentCity}
          onCreate={handleCreateMemory}
          onClose={() => setIsUploadOpen(false)}
        />
      </div>
    </main>
  );
}

export default App;
