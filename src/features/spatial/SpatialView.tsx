import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ShaderChunk } from 'three/src/renderers/shaders/ShaderChunk.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import type { SoundMemory } from '../../types/sound';
import { resolvePublicAssetUrl } from '../../services/publicAssetUrl';

export type SpatialMemory = {
  id: string;
  title: string;
  timestamp: string;
  description: string;
  audioUrl: string;
  position: { x: number; y: number; z: number };
  sourceMemoryId: string;
};

export type SpatialMemoryPlace = {
  id: string;
  name: string;
  description: string;
  splatUrl: string;
  memories: SpatialMemory[];
};

type SpatialViewProps = {
  memories: SoundMemory[];
  onPlay: (memory: SoundMemory) => void;
  playingMemoryId?: string;
};

const placeDefinitions: Array<{
  id: string;
  name: string;
  description: string;
  file: string;
  memoryIds: string[];
}> = [
  { id: 'main-hall', name: '01 Main Hall 主场馆', description: 'Voices, ideas and first encounters gather here.', file: 'main-hall.spz', memoryIds: ['bus-stop-rain-night', 'longtang-life'] },
  { id: 'stage', name: '02 Stage 讲台', description: 'A temporary stage for unfinished thoughts.', file: 'stage.spz', memoryIds: ['shanghai-last-metro', 'beijing-first-arrival'] },
  { id: 'participant-area', name: '03 Participant Area 选手区', description: 'The low hum of people making something together.', file: 'participant-area.spz', memoryIds: ['shanghai-cycling-street', 'aya-shanghai-laundry'] },
  { id: 'exhibition', name: '04 Exhibition 展示区', description: 'Works, conversations and the sound of looking closer.', file: 'exhibition.spz', memoryIds: ['berlin-spati-chat', 'aya-berlin-tram'] },
  { id: 'rest-area', name: '05 Rest Area 休息区', description: 'A quieter pocket between one idea and the next.', file: 'rest-area.spz', memoryIds: ['huangpu-night-wind', 'suzhou-creek-under-bridge'] },
  { id: 'printing-room', name: '06 Printing Room 打印室', description: 'Paper, machines and the last-minute rush.', file: 'printing-room.spz', memoryIds: ['shanghai-market-morning', 'beijing-subway-transfer'] },
  { id: 'service-area', name: '07 Service Area 服务台', description: 'Arrivals, directions and small acts of care.', file: 'service-area.spz', memoryIds: ['singapore-tropical-rain', 'singapore-hawker-memory'] },
  { id: 'participant-wall', name: '08 Participant Wall 选手墙', description: 'Names and traces left behind after the room empties.', file: 'participant-wall.spz', memoryIds: ['tokyo-station-platform', 'new-york-subway-doors'] },
];

const positions = [
  { x: -0.72, y: 0.28, z: 0.16 },
  { x: 0.58, y: -0.12, z: 0.08 },
];

// Spark registers its custom GLSL include on the public Three namespace.
// Vite can resolve the renderer's internal registry separately, so bridge it
// explicitly before the first SparkRenderer is created.
const sparkShaderChunk = (THREE as typeof THREE & { ShaderChunk?: Record<string, string> }).ShaderChunk?.splatDefines;
if (sparkShaderChunk && !(ShaderChunk as Record<string, string>).splatDefines) {
  (ShaderChunk as Record<string, string>).splatDefines = sparkShaderChunk;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function createPlaces(memories: SoundMemory[]): SpatialMemoryPlace[] {
  return placeDefinitions.map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    splatUrl: resolvePublicAssetUrl(`/spatial/splats/${definition.file}`),
    memories: definition.memoryIds.map((sourceMemoryId, index) => {
      const source = memories.find((memory) => memory.id === sourceMemoryId) ?? memories[index % Math.max(1, memories.length)];
      return {
        id: `${definition.id}-${source?.id ?? index}`,
        title: source?.title.replace(/[《》]/g, '') ?? 'First Conversation',
        timestamp: source?.recordedAt ?? '2026-09-12T15:32:00',
        description: source?.note ?? 'Voices, keyboards and ideas briefly mixed together in the room.',
        audioUrl: source?.audioUrl ?? '/audio/samples/restaurant-crowd.mp3',
        position: positions[index % positions.length],
        sourceMemoryId: source?.id ?? '',
      };
    }),
  }));
}

export function SpatialView({ memories, onPlay, playingMemoryId }: SpatialViewProps) {
  const places = useMemo(() => createPlaces(memories), [memories]);
  const [activePlaceId, setActivePlaceId] = useState('main-hall');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const hostRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activePlace = places.find((place) => place.id === activePlaceId) ?? places[0];
  const selectedMemory = activePlace.memories.find((memory) => memory.id === selectedMemoryId);

  useEffect(() => {
    setSelectedMemoryId(undefined);
    setIsLoading(true);
    setLoadError(undefined);
  }, [activePlaceId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !activePlace) return;

    let disposed = false;
    let hasUserInteracted = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02070a);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x02070a, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.replaceChildren(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 0.8;
    controls.minDistance = 0.55;
    controls.maxDistance = 20;
    controls.target.set(0, 0, 0);
    controls.addEventListener('start', () => { hasUserInteracted = true; });
    const spark = new SparkRenderer({ renderer, maxStdDev: Math.sqrt(8) });
    scene.add(spark);
    const splat = new SplatMesh({ url: activePlace.splatUrl, raycastable: false, onLoad: () => { if (!disposed) setIsLoading(false); } });
    void splat.initialized.catch(() => { if (!disposed) { setIsLoading(false); setLoadError('load-failed'); } });
    splat.position.set(0, -0.18, 0);
    splat.scale.setScalar(1.05);
    scene.add(splat);

    const fitCameraToSplat = () => {
      if (disposed || !splat.isInitialized) return;

      scene.updateMatrixWorld(true);
      // Gaussian tails can extend far beyond the useful recorded image. Frame
      // from splat centers so those soft outliers do not make every room feel
      // distant on first entry.
      const bounds = splat.getBoundingBox(true).applyMatrix4(splat.matrixWorld);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      const aspect = width / height;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
      const isPortrait = aspect < 0.9;
      // Landscape views prioritize the useful horizontal band; portrait views
      // preserve the taller framing of the original phone capture.
      const fitSize = isPortrait ? size.y : size.x;
      const fitFov = isPortrait ? verticalFov : horizontalFov;
      const framingScale = isPortrait ? 0.68 : 0.42;
      const distance = (fitSize * 0.5) / Math.tan(fitFov * 0.5) * framingScale;
      const depthPadding = Math.max(size.z * 0.7, 0.5);

      camera.aspect = aspect;
      camera.near = Math.max(0.01, distance - depthPadding * 3);
      camera.far = Math.max(100, distance + depthPadding * 8);
      camera.position.set(center.x, center.y, center.z + distance);
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
    };

    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (!hasUserInteracted && splat.isInitialized) fitCameraToSplat();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    void splat.initialized.then(() => fitCameraToSplat());

    const animate = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      activePlace.memories.forEach((memory) => {
        const element = nodeRefs.current[memory.id];
        if (!element) return;
        const point = new THREE.Vector3(memory.position.x, memory.position.y, memory.position.z).project(camera);
        const visible = point.z > -1 && point.z < 1;
        element.style.opacity = visible ? '1' : '0';
        element.style.pointerEvents = visible ? 'auto' : 'none';
        element.style.transform = `translate(-50%, -50%) translate(${(point.x * 0.5 + 0.5) * host.clientWidth}px, ${(-point.y * 0.5 + 0.5) * host.clientHeight}px)`;
      });
    };
    renderer.setAnimationLoop(animate);

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      controls.dispose();
      splat.dispose();
      spark.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [activePlace]);

  const chooseMemory = (memory: SpatialMemory) => {
    setSelectedMemoryId(memory.id);
  };

  return (
    <section className="spatial-view" aria-label="SPATIAL 空间记忆">
      <div className="spatial-stage" ref={hostRef} aria-label={`${activePlace.name}空间`} />
      <div className="spatial-vignette" aria-hidden="true" />

      <aside className="spatial-navigator">
        <p className="panel-kicker">SPATIAL / 空间记忆</p>
        <h1>Shanghai AI Art Hackathon</h1>
        <p className="spatial-date">2026.09.12</p>
        <p className="spatial-description">A temporary space where voices, ideas and creations intersect.</p>
        <nav aria-label="空间选择">
          {places.map((place) => (
            <button key={place.id} type="button" className={place.id === activePlace.id ? 'is-active' : ''} onClick={() => setActivePlaceId(place.id)}>
              <span>{place.name}</span><small>{place.id === activePlace.id ? '进入中' : '进入'}</small>
            </button>
          ))}
        </nav>
      </aside>

      <div className="spatial-caption"><span>声音保存下来的空间</span><strong>{activePlace.name}</strong></div>

      {activePlace.memories.map((memory) => (
        <button
          key={memory.id}
          ref={(element) => { nodeRefs.current[memory.id] = element; }}
          type="button"
          className={`spatial-memory-node ${selectedMemory?.id === memory.id ? 'is-selected' : ''} ${playingMemoryId === memory.sourceMemoryId ? 'is-playing' : ''}`}
          onClick={() => chooseMemory(memory)}
          aria-label={`打开声音记忆 ${memory.title}`}
        >
          <i aria-hidden="true" /><span>{memory.title}</span><small>点击聆听</small>
        </button>
      ))}

      {isLoading && !loadError && <div className="spatial-loading">正在进入这段空间记忆……</div>}
      {loadError && <div className="spatial-loading is-error">空间暂时无法载入，请稍后重试。</div>}

      {selectedMemory && (
        <aside className="spatial-memory-card" aria-label="空间声音记忆详情">
          <button className="spatial-card-close" type="button" onClick={() => setSelectedMemoryId(undefined)} aria-label="关闭声音记忆">×</button>
          <p className="panel-kicker">Memory found in this room</p>
          <h2>{selectedMemory.title}</h2>
          <time>{formatTimestamp(selectedMemory.timestamp)}</time>
          <p>{selectedMemory.description}</p>
          <button className="spatial-play" type="button" onClick={() => { const source = memories.find((memory) => memory.id === selectedMemory.sourceMemoryId); if (source) onPlay(source); }}>
            <span aria-hidden="true">{playingMemoryId === selectedMemory.sourceMemoryId ? 'Ⅱ' : '▶'}</span>
            {playingMemoryId === selectedMemory.sourceMemoryId ? '暂停这段声音' : '播放这段声音'}
          </button>
        </aside>
      )}
    </section>
  );
}
