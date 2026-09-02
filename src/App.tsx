import { useEffect, useMemo, useState } from 'react';
import { ExplorationModePanel } from './components/ExplorationModePanel';
import { TopBar } from './components/TopBar';
import { ParticleEarth } from '../demos/global-earth-prototype/src/ParticleEarth';
import { browseCities, type City as GlobalCity } from '../demos/global-earth-prototype/src/cities';
import { EchoAgentPanel } from './features/agent/EchoAgentPanel';
import { UploadSoundModal } from './features/echoes/UploadSoundModal';
import { CityEntryOverlay } from './features/map/CityEntryOverlay';
import { EmptyPlaceState } from './features/map/EmptyPlaceState';
import { ShanghaiMap } from './features/map/ShanghaiMap';
import { MyLibraryPanel } from './features/sound/MyLibraryPanel';
import { SoundDetailPanel } from './features/sound/SoundDetailPanel';
import { StoryModePanel } from './features/sound/StoryModePanel';
import { StorySuggestionCard } from './features/sound/StorySuggestionCard';
import { ListeningDock } from './features/sound/ListeningDock';
import { VisualListeningPlaceholder } from './features/sound/VisualListeningPlaceholder';
import { FollowingFeed } from './features/following/FollowingFeed';
import { TimeRibbon } from './features/timeline/TimeRibbon';
import { getCityStory } from './data/listeningStories';
import { cities, soundMemories as initialSoundMemories } from './data/soundNodes';
import { CURRENT_USER_ID } from './data/users';
import { getFollowingMemories, getMyMemories, getPublicMemories, getRecallMemories } from './services/memories';
import { loadCapturedMemories, saveCapturedMemory, type CapturedMemoryAssets } from './services/captureStorage';
import type { GeocodingResult } from './services/maptiler';
import { describeTimeFilter, filterMemoriesByTime } from './services/time';
import type { AtlasMode, City, ListeningStory, RecallScope, SoundMemory, SoundNode, TimeFilter, VisualSession } from './types/sound';

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
  const [soundMemories, setSoundMemories] = useState<SoundNode[]>(initialSoundMemories);
  const [atlasMode, setAtlasMode] = useState<AtlasMode>('explore');
  const [recallScope, setRecallScope] = useState<RecallScope>('mine');
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
  const [savedMemoryIds, setSavedMemoryIds] = useState<string[]>([]);
  const [listeningSession, setListeningSession] = useState<VisualSession>({ memories: [] });
  const [isVisualListeningOpen, setIsVisualListeningOpen] = useState(false);

  const myMemories = useMemo(() => getMyMemories(soundMemories), [soundMemories]);
  const publicMemories = useMemo(() => getPublicMemories(soundMemories), [soundMemories]);
  const followingMemories = useMemo(() => getFollowingMemories(soundMemories), [soundMemories]);
  const recallMemories = useMemo(() => getRecallMemories(soundMemories, recallScope), [recallScope, soundMemories]);
  const atlasMapMemories = atlasMode === 'my-atlas' ? myMemories : publicMemories;

  const globalCities = useMemo<GlobalCity[]>(
    () => {
      const groupedCities = new Map<string, GlobalCity & { latTotal: number; lngTotal: number }>();

      publicMemories.forEach((memory) => {
        const knownCity = cities.find((city) => city.id === memory.cityId
          || city.name.toLowerCase() === memory.location.city.toLowerCase()
          || city.localName.toLowerCase() === memory.location.city.toLowerCase());
        const key = `${memory.location.city.trim().toLowerCase()}::${memory.location.country.trim().toLowerCase()}`;
        const existing = groupedCities.get(key);

        if (existing) {
          existing.echoes += 1;
          existing.latTotal += memory.location.lat;
          existing.lngTotal += memory.location.lng;
          existing.lat = existing.latTotal / existing.echoes;
          existing.lng = existing.lngTotal / existing.echoes;
          return;
        }

        groupedCities.set(key, {
          cityId: knownCity?.id ?? memory.cityId,
          name: knownCity?.name ?? memory.location.city,
          country: memory.location.country,
          lat: memory.location.lat,
          lng: memory.location.lng,
          echoes: 1,
          hasPublicMemories: true,
          latTotal: memory.location.lat,
          lngTotal: memory.location.lng,
        });
      });

      const publicCities = [...groupedCities.values()]
        .map(({ latTotal: _latTotal, lngTotal: _lngTotal, ...city }) => ({
          ...city,
          hasPublicMemories: true,
        }));
      const publicIds = new Set(publicCities.map((city) => city.cityId));

      return [...publicCities, ...browseCities.filter((city) => !publicIds.has(city.cityId))]
        .sort((a, b) => b.echoes - a.echoes || a.name.localeCompare(b.name));
    },
    [publicMemories],
  );
  const recommendedCity = cities.find((city) => city.id === currentCityId) ?? cities[0];
  const currentCity = exploredPlace ?? recommendedCity;
  const currentCityNodes = useMemo(
    () => atlasMapMemories.filter((node) => node.cityId === currentCity.id),
    [atlasMapMemories, currentCity.id],
  );
  const scopedNodes = useMemo(
    () => mapScope === 'mine' ? currentCityNodes.filter((node) => node.ownerId === CURRENT_USER_ID) : currentCityNodes,
    [currentCityNodes, mapScope],
  );
  const visibleNodes = useMemo(
    () => filterMemoriesByTime(scopedNodes, timeFilter),
    [scopedNodes, timeFilter],
  );
  const currentCityStory = getCityStory(currentCity.id);
  const storyNode = activeStory
    ? soundMemories.find((node) => node.id === activeStory.nodeIds[storyStepIndex])
    : undefined;
  const mapFocusNode = storyNode
    ?? soundMemories.find((node) => node.id === mapFocusNodeId);
  const activeListeningMemory = listeningSession.memories.find((memory) => memory.id === listeningSession.activeMemoryId);

  useEffect(() => {
    let active = true;
    void loadCapturedMemories().then((capturedMemories) => {
      if (!active || capturedMemories.length === 0) return;
      setSoundMemories((current) => {
        const capturedIds = new Set(capturedMemories.map((memory) => memory.id));
        return [...capturedMemories, ...current.filter((memory) => !capturedIds.has(memory.id))];
      });
    }).catch(() => {
      // Capture remains usable in-memory when IndexedDB is unavailable.
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if ((atlasMode === 'my-atlas' || atlasMode === 'explore')
      && selectedNode
      && !visibleNodes.some((node) => node.id === selectedNode.id)) {
      setSelectedNode(undefined);
    }
  }, [atlasMode, selectedNode, visibleNodes]);

  const handleSelectCity = (cityId: string) => {
    const city = cities.find((item) => item.id === cityId);
    if (!city) {
      return;
    }

    setCurrentCityId(cityId);
    setExploredPlace(undefined);
    setTimeFilter({ mode: 'all' });
    setMapScope(atlasMode === 'my-atlas' ? 'mine' : 'all');
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

  const handleEnterGlobalCity = (city: GlobalCity) => {
    const knownCity = cities.find((item) => item.id === city.cityId);
    setSelectedGlobalCity(city);
    setAtlasMode('explore');
    setIsModeOpen(false);

    if (knownCity) {
      handleSelectCity(city.cityId);
      setViewMode('city');
      return;
    }

    setCurrentCityId(city.cityId);
    setExploredPlace({
      id: city.cityId,
      name: city.name,
      localName: city.name,
      country: city.country,
      center: [city.lng, city.lat],
      zoom: 12.4,
      timeZone: 'UTC',
      context: city.country,
    });
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
      meta: `${city.country} · ${city.echoes}段公开声音`,
    });
    setShowStorySuggestion(false);
    setCityFocusRequest((value) => value + 1);
    setViewMode('city');
  };

  const handleReturnToEarth = () => {
    setSelectedGlobalCity(undefined);
    setSelectedNode(undefined);
    setActiveStory(undefined);
    setShowStorySuggestion(false);
    setViewMode('global');
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
    setMapScope(atlasMode === 'my-atlas' ? 'mine' : 'all');
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
    const storyMemories = story.nodeIds
      .map((id) => soundMemories.find((memory) => memory.id === id))
      .filter((memory): memory is SoundMemory => Boolean(memory));
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
    setListeningSession({ memories: storyMemories, activeMemoryId: storyMemories[0]?.id, preset: 'story-listening' });
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
    if (node.ownerId !== CURRENT_USER_ID && mapScope === 'mine') {
      setMapScope('all');
    }
    setActiveStory(undefined);
    setShowStorySuggestion(false);
    setMapFocusNodeId(node.id);
    setSelectedNode(node);
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

  const handleCreateMemory = async ({ memory: node, audioBlob, imageBlob }: CapturedMemoryAssets) => {
    try {
      await saveCapturedMemory({ memory: node, audioBlob, imageBlob });
    } catch {
      // Keep the capture available for this session if persistence is unavailable.
    }
    setSoundMemories((current) => [node, ...current]);
    setListeningSession({ memories: [node, ...myMemories], activeMemoryId: node.id, preset: 'sound-imprint' });
    setAtlasMode('my-atlas');
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

  const setSessionMemory = (memory: SoundMemory, collection: SoundMemory[], autoPlay: boolean) => {
    const sessionMemories = collection.some((item) => item.id === memory.id)
      ? collection
      : [memory, ...collection];
    setListeningSession({ memories: sessionMemories, activeMemoryId: memory.id, preset: 'sound-imprint' });
    setPlayingNodeId(autoPlay ? memory.id : undefined);
  };

  const handlePlayMemory = (memory: SoundMemory, collection: SoundMemory[]) => {
    const shouldPause = playingNodeId === memory.id;
    setSessionMemory(memory, collection, !shouldPause);
  };

  const handleOpenMemory = (memory: SoundMemory, collection: SoundMemory[]) => {
    setSessionMemory(memory, collection, false);
    setSelectedNode(memory);
  };

  const handleToggleSave = (memory: SoundMemory) => {
    setSavedMemoryIds((ids) => ids.includes(memory.id)
      ? ids.filter((id) => id !== memory.id)
      : [...ids, memory.id]);
  };

  const handleSessionStep = (direction: -1 | 1) => {
    if (!activeListeningMemory || listeningSession.memories.length < 2) return;
    const currentIndex = listeningSession.memories.findIndex((memory) => memory.id === activeListeningMemory.id);
    const nextIndex = (currentIndex + direction + listeningSession.memories.length) % listeningSession.memories.length;
    const nextMemory = listeningSession.memories[nextIndex];
    setListeningSession((session) => ({ ...session, activeMemoryId: nextMemory.id }));
    setPlayingNodeId((current) => current ? nextMemory.id : undefined);
    setMapFocusNodeId(nextMemory.id);
  };

  const handleStoryStep = (nextIndex: number) => {
    if (!activeStory) return;
    const storyMemories = activeStory.nodeIds
      .map((id) => soundMemories.find((memory) => memory.id === id))
      .filter((memory): memory is SoundMemory => Boolean(memory));
    const nextMemory = soundMemories.find((memory) => memory.id === activeStory.nodeIds[nextIndex]);
    setStoryStepIndex(nextIndex);
    setPlayingNodeId(undefined);
    if (nextMemory) {
      setListeningSession({ memories: storyMemories, activeMemoryId: nextMemory.id, preset: 'story-listening' });
    }
  };

  const handleViewMemoryOnAtlas = (node: SoundMemory) => {
    const knownCity = cities.find((city) => city.id === node.cityId);
    setAtlasMode('explore');
    setIsAgentOpen(false);
    setIsLibraryOpen(false);
    setCurrentCityId(node.cityId);
    setExploredPlace(knownCity ? undefined : {
      id: node.cityId,
      name: node.location.city,
      localName: node.location.city,
      country: node.location.country,
      center: node.coordinate,
      zoom: 14.2,
      timeZone: 'UTC',
      context: `${node.location.placeName} · ${node.location.country}`,
    });
    setViewMode('city');
    setTimeFilter({ mode: 'all' });
    setMapScope('all');
    setHighlightedNodeIds([node.id]);
    setMapFocusNodeId(node.id);
    setSelectedNode(node.visibility === 'public' ? node : undefined);
    setSessionMemory(node, [node], false);
    setCityFocusRequest((value) => value + 1);
  };

  const handleChangeAtlasMode = (mode: AtlasMode) => {
    setAtlasMode(mode);
    setSelectedNode(undefined);
    setActiveStory(undefined);
    setHighlightedNodeIds([]);
    setIsModeOpen(false);
    setIsLibraryOpen(false);
    setIsAgentOpen(mode === 'recall');
    setMapScope(mode === 'my-atlas' ? 'mine' : 'all');
    setTimeFilter({ mode: 'all' });
  };

  return (
    <main className="app-shell">
      <div className={`global-earth-view ${viewMode === 'global' ? 'is-visible' : 'is-hidden'}`} aria-hidden={viewMode === 'city'}>
        {viewMode === 'global' && (
          <ParticleEarth
            cities={globalCities}
            selectedCity={selectedGlobalCity}
            onSelectCity={setSelectedGlobalCity}
            onEnterCity={handleEnterGlobalCity}
          />
        )}
        <nav className="global-city-accessibility" aria-label="选择城市">
          {globalCities.map((city) => (
            <button type="button" key={city.cityId} onClick={() => setSelectedGlobalCity({ ...city })}>
              {city.name}
            </button>
          ))}
        </nav>
        <header className="prototype-header">
          <p className="prototype-kicker">Echo Atlas / Earth 01</p>
          <h1>Global Listening Field</h1>
          <p className="prototype-subtitle">声音记忆的全球入口</p>
        </header>
        <footer className="prototype-footer">
          <div><span>ACTIVE CITIES</span><strong>{String(globalCities.length).padStart(2, '0')}</strong></div>
          <div><span>PUBLIC MEMORIES</span><strong>{publicMemories.length}</strong></div>
          <div className="selected-readout"><span>CURRENT SIGNAL</span><strong>{selectedGlobalCity?.name ?? 'GLOBAL'}</strong></div>
        </footer>
      </div>

      <div
        className={`city-view ${viewMode === 'city' ? 'is-visible' : 'is-hidden'} ${activeStory ? 'is-story-active' : ''} ${activeListeningMemory ? 'has-listening-session' : ''}`}
        aria-hidden={viewMode === 'global'}
      >
        <button className="return-earth-button" type="button" onClick={handleReturnToEarth}>
          <span aria-hidden="true">←</span> Earth
        </button>
        <TopBar
          city={currentCity}
          timeLabel={describeTimeFilter(timeFilter)}
          atlasMode={atlasMode}
          onChangeAtlasMode={handleChangeAtlasMode}
          onToggleAgent={() => {
            handleChangeAtlasMode('recall');
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
          searchNodes={atlasMode === 'my-atlas' ? myMemories : publicMemories}
          suggestedCities={cities}
          selectedNodeId={selectedNode?.id}
          playingNodeId={playingNodeId}
          highlightedNodeIds={highlightedNodeIds}
          dimUnowned={atlasMode === 'my-atlas' || mapScope === 'mine'}
          focusNode={mapFocusNode}
          focusRequest={cityFocusRequest}
          onExplorePlace={handleExplorePlace}
          onSelectNode={(node) => {
            setActiveStory(undefined);
            setShowStorySuggestion(false);
            setMapFocusNodeId(node.id);
            handleOpenMemory(node, currentCityNodes);
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

        {atlasMode === 'explore'
          && showStorySuggestion
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
        {atlasMode === 'following' && (
          <FollowingFeed
            memories={followingMemories}
            playingMemoryId={playingNodeId}
            savedMemoryIds={savedMemoryIds}
            onPlay={handlePlayMemory}
            onSave={handleToggleSave}
            onOpen={handleOpenMemory}
            onOpenOnMap={handleViewMemoryOnAtlas}
          />
        )}
        <EchoAgentPanel
          isOpen={isAgentOpen && atlasMode === 'recall'}
          nodes={recallMemories}
          scope={recallScope}
          playingMemoryId={playingNodeId}
          savedMemoryIds={savedMemoryIds}
          onScopeChange={(scope) => {
            setRecallScope(scope);
            setHighlightedNodeIds([]);
          }}
          onRoute={handleAgentRoute}
          onPlay={handlePlayMemory}
          onSave={handleToggleSave}
          onOpen={handleOpenMemory}
          onViewAtlas={handleViewMemoryOnAtlas}
        />
        <SoundDetailPanel
          node={selectedNode}
          onClose={() => {
            setSelectedNode(undefined);
          }}
          isPlaying={playingNodeId === selectedNode?.id}
          onTogglePlay={() => selectedNode && handlePlayMemory(selectedNode, listeningSession.memories.length > 0 ? listeningSession.memories : [selectedNode])}
        />
        <StoryModePanel
          story={activeStory}
          node={storyNode}
          stepIndex={storyStepIndex}
          isPlaying={playingNodeId === storyNode?.id}
          onTogglePlay={() => storyNode && handlePlayMemory(
            storyNode,
            activeStory?.nodeIds.map((id) => soundMemories.find((memory) => memory.id === id)).filter((memory): memory is SoundMemory => Boolean(memory)) ?? [storyNode],
          )}
          onPrevious={() => {
            handleStoryStep(Math.max(0, storyStepIndex - 1));
          }}
          onNext={() => {
            handleStoryStep(activeStory && storyStepIndex === activeStory.nodeIds.length - 1 ? 0 : storyStepIndex + 1);
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
                ? currentCityNodes.filter((node) => node.ownerId === CURRENT_USER_ID).map((node) => node.id)
                : [],
            );
            if (scope === 'mine') {
              setCityFocusRequest((value) => value + 1);
            }
          }}
          onClose={() => setIsLibraryOpen(false)}
          onSelectNode={(node) => {
            handleOpenMemory(node, myMemories);
            revealNode(node);
            setIsLibraryOpen(false);
          }}
          playingMemoryId={playingNodeId}
          savedMemoryIds={savedMemoryIds}
          onPlay={handlePlayMemory}
          onSave={handleToggleSave}
        />
        {atlasMode === 'my-atlas' && !isLibraryOpen && (
          <div className="my-atlas-view-switcher" aria-label="My Atlas views">
            <button type="button" aria-pressed="true">Map</button>
            <button type="button" onClick={() => setTimeFilter({ mode: 'all' })}>Timeline</button>
            <button type="button" onClick={() => setIsLibraryOpen(true)}>List</button>
          </div>
        )}
        {(atlasMode === 'my-atlas' || atlasMode === 'explore') && currentCityNodes.length > 0 && (
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
        <ListeningDock
          session={listeningSession}
          isPlaying={Boolean(activeListeningMemory && playingNodeId === activeListeningMemory.id)}
          onTogglePlay={() => activeListeningMemory && handlePlayMemory(activeListeningMemory, listeningSession.memories)}
          onPrevious={() => handleSessionStep(-1)}
          onNext={() => handleSessionStep(1)}
          onOpenVisual={() => setIsVisualListeningOpen(true)}
          onPlaybackEnded={() => setPlayingNodeId(undefined)}
          onClose={() => {
            setListeningSession({ memories: [] });
            setPlayingNodeId(undefined);
            setIsVisualListeningOpen(false);
          }}
        />
        {isVisualListeningOpen && (
          <VisualListeningPlaceholder session={listeningSession} onClose={() => setIsVisualListeningOpen(false)} />
        )}
      </div>
    </main>
  );
}

export default App;
