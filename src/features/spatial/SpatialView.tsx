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
  sourceMemory?: SoundMemory;
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
  { id: 'participant-area', name: '03 Booth Area 展台区', description: 'Projects, demonstrations and conversations around the booths.', file: 'participant-area.spz', memoryIds: ['shanghai-cycling-street', 'aya-shanghai-laundry'] },
  { id: 'exhibition', name: '04 3D Printing Room 3D 打印室', description: 'Printers hum as ideas take physical shape.', file: 'exhibition.spz', memoryIds: ['berlin-spati-chat', 'aya-berlin-tram'] },
  { id: 'rest-area', name: '05 Rest Area 休息区', description: 'A quieter pocket between one idea and the next.', file: 'rest-area.spz', memoryIds: ['huangpu-night-wind', 'suzhou-creek-under-bridge'] },
  { id: 'service-area', name: '06 Service Area 服务台', description: 'Arrivals, directions and small acts of care.', file: 'printing-room.spz', memoryIds: ['shanghai-market-morning', 'beijing-subway-transfer'] },
  { id: 'participant-wall', name: '07 Participant Wall 选手墙', description: 'Names and traces left behind after the room empties.', file: 'service-area.spz', memoryIds: ['singapore-tropical-rain', 'singapore-hawker-memory'] },
  { id: 'hackathon-entrance', name: '08 Hackathon Entrance 黑客松入口', description: 'The first step into a shared day of making.', file: 'participant-wall.spz', memoryIds: ['tokyo-station-platform', 'new-york-subway-doors'] },
];

type SpatialAudioRecord = {
  id: string;
  title: string;
  file: string;
  placeId: string;
  description: string;
};

// Event recordings stay separate from the seeded Atlas memories so the spatial
// rooms can use the supplied audio without changing the rest of the product.
const spatialAudioRecords: SpatialAudioRecord[] = [
  { id: 'printing-teacher-expression', title: '打印老师的倾情表达', file: 'printing-teacher-expression.m4a', placeId: 'exhibition', description: '打印老师在 3D 打印室里的倾情表达。' },
  { id: 'participant-printing-discussion', title: '选手的打印探讨', file: 'participant-printing-discussion.m4a', placeId: 'exhibition', description: '选手在打印室讨论正在成形的作品。' },
  { id: '3d-printing-room-discussion', title: '3D打印室讨论', file: '3d-printing-room-discussion.m4a', placeId: 'exhibition', description: '3D 打印室里关于作品与材料的现场讨论。' },
  { id: 'dinner-pork-or-peppers', title: '晚饭吃排骨还是辣椒炒肉', file: 'dinner-pork-or-peppers.m4a', placeId: 'service-area', description: '服务台附近关于晚饭吃什么的轻声讨论。' },
  { id: 'hungry-want-meat', title: '饿了想吃肉', file: 'hungry-want-meat.m4a', placeId: 'service-area', description: '一句关于饥饿和晚饭的现场回应。' },
  { id: 'ai-lab-workbench-greeting', title: 'AI LAB工作台寒暄', file: 'ai-lab-workbench-greeting.m4a', placeId: 'service-area', description: 'AI LAB 工作台旁的寒暄。' },
  { id: 'ai-lab', title: 'AI LAB', file: 'ai-lab.m4a', placeId: 'service-area', description: '服务台一带留下的 AI LAB 声音。' },
  { id: 'host-any-ideas', title: '主持人：大家现在都有想法吗', file: 'host-any-ideas.mp3', placeId: 'stage', description: '主持人在讲台向现场发问。' },
  { id: 'host-three-thousand-interaction', title: '主持人：三万元大奖的举手互动', file: 'host-three-thousand-interaction.mp3', placeId: 'stage', description: '讲台上的主持人与现场互动。' },
  { id: 'betty-greeting', title: 'Betty打招呼', file: 'betty-greeting.m4a', placeId: 'participant-wall', description: '选手墙附近留下的一声打招呼。' },
  { id: 'queenie-soul-question', title: 'queenie的灵魂质问', file: 'queenie-soul-question.m4a', placeId: 'participant-area', description: '展台区突然出现的一句灵魂质问。' },
  { id: 'rest-before-sleep-chat', title: '休息室睡前唠嗑邀请', file: 'rest-before-sleep-chat.m4a', placeId: 'rest-area', description: '休息室里睡前唠嗑的邀请。' },
  { id: 'ai-save-painting-or-cat', title: 'AI救画还是猫', file: 'ai-save-painting-or-cat.m4a', placeId: 'rest-area', description: '休息室里关于 AI、画和猫的选择。' },
  { id: 'photography-teacher-hello', title: '摄影老师的你好', file: 'photography-teacher-hello.m4a', placeId: 'hackathon-entrance', description: '黑客松入口处，摄影老师的一声问候。' },
  { id: 'peng-teacher-plan', title: '彭老师讨论方案', file: 'peng-teacher-plan.m4a', placeId: 'main-hall', description: '主场馆里关于方案的讨论。' },
  { id: 'teammate-absurd-laugh', title: '队友抽象笑声', file: 'teammate-absurd-laugh.m4a', placeId: 'main-hall', description: '主场馆里突然留下的一阵笑声。' },
  { id: 'teammate-awkward', title: '队友尴尬', file: 'teammate-awkward.m4a', placeId: 'main-hall', description: '主场馆里一段尴尬又真实的停顿。' },
  { id: 'random-participant-greeting', title: '随机选手打招呼', file: 'random-participant-greeting.m4a', placeId: 'main-hall', description: '主场馆里随机发生的一次交流。' },
];

// 参考各场景截图设置独立朝向；资源文件沿用原名，对应关系以列表为准。
const entryViews: Record<string, {
  direction: [number, number, number];
  distanceScale: number;
  portraitDistanceScale?: number;
  /** Override the default close-up framing for captures that need the full view. */
  landscapeFramingScale?: number;
  target?: [number, number, number];
  targetOffset?: [number, number, number];
}> = {
  // Keep the complete venue in view; this is the stable framing for the
  // landscape capture even though its center is slightly offset.
  'main-hall': { direction: [0, 0, 1], distanceScale: 1, landscapeFramingScale: 1 },
  stage: { direction: [0, 0, 1], distanceScale: 0.22, portraitDistanceScale: 0.32 },
  'participant-area': { direction: [-0.2, 0.08, 1], distanceScale: 0.65, target: [-2, 0.3, 0] },
  'service-area': { direction: [0, 0, 1], distanceScale: 0.25 },
  'participant-wall': { direction: [0, 0, 1], distanceScale: 0.32 },
  exhibition: { direction: [0, 0, 1], distanceScale: 0.22, portraitDistanceScale: 0.32 },
  'rest-area': { direction: [-0.15, 0.1, 1], distanceScale: 0.2, portraitDistanceScale: 0.3 },
  // Keep the entrance on its captured forward axis. The previous oblique
  // target landed inside a sparse splat layer and produced a blurred view.
  'hackathon-entrance': { direction: [0, 0, 1], distanceScale: 0.25, portraitDistanceScale: 0.32 },
};

// Spread the markers across each room's useful image band. The splat scenes
// have different scales, so positions are deliberately room-specific instead
// of reusing the same two coordinates for every recording.
const positionsByPlace: Record<string, Array<{ x: number; y: number; z: number }>> = {
  'main-hall': [
    { x: -0.78, y: 0.3, z: 0.18 },
    { x: 0.7, y: 0.3, z: -0.12 },
    { x: -0.58, y: -0.28, z: -0.2 },
    { x: 0.58, y: -0.3, z: 0.16 },
  ],
  stage: [
    { x: -0.68, y: 0.28, z: 0.12 },
    { x: 0.68, y: -0.2, z: -0.08 },
  ],
  'participant-area': [{ x: 0.08, y: 0.02, z: 0.12 }],
  exhibition: [
    { x: -0.72, y: 0.34, z: 0.18 },
    { x: 0.02, y: 0.02, z: -0.16 },
    { x: 0.72, y: -0.3, z: 0.1 },
  ],
  'rest-area': [
    { x: -0.62, y: 0.25, z: 0.14 },
    { x: 0.62, y: -0.2, z: -0.12 },
  ],
  'service-area': [
    { x: -0.78, y: 0.34, z: 0.18 },
    { x: 0.76, y: 0.28, z: -0.12 },
    { x: -0.6, y: -0.3, z: -0.18 },
    { x: 0.58, y: -0.34, z: 0.12 },
  ],
  'participant-wall': [{ x: -0.08, y: 0.02, z: 0.08 }],
  'hackathon-entrance': [{ x: 0.08, y: 0.04, z: 0.1 }],
};

// The labels are HTML overlays, so use stable screen anchors for each room.
// This prevents a deep or sparse splat from projecting several recordings into
// the same tiny patch, while their source positions remain available above.
const screenAnchorsByPlace: Record<string, Array<{ x: number; y: number }>> = {
  'main-hall': [{ x: 0.55, y: 0.32 }, { x: 0.78, y: 0.32 }, { x: 0.57, y: 0.62 }, { x: 0.8, y: 0.62 }],
  stage: [{ x: 0.55, y: 0.35 }, { x: 0.8, y: 0.62 }],
  'participant-area': [{ x: 0.72, y: 0.48 }],
  exhibition: [{ x: 0.54, y: 0.3 }, { x: 0.7, y: 0.52 }, { x: 0.84, y: 0.72 }],
  'rest-area': [{ x: 0.58, y: 0.36 }, { x: 0.8, y: 0.64 }],
  'service-area': [{ x: 0.54, y: 0.3 }, { x: 0.8, y: 0.3 }, { x: 0.57, y: 0.62 }, { x: 0.83, y: 0.64 }],
  'participant-wall': [{ x: 0.72, y: 0.48 }],
  'hackathon-entrance': [{ x: 0.72, y: 0.48 }],
};

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
    memories: spatialAudioRecords.filter((record) => record.placeId === definition.id).map((record, index) => {
      const source = memories.find((memory) => memory.id === definition.memoryIds[index % Math.max(1, definition.memoryIds.length)]) ?? memories[index % Math.max(1, memories.length)];
      const sourceMemory = source ? {
        ...source,
        id: `spatial-${record.id}`,
        title: record.title,
        audioUrl: `/audio/spatial/${record.file}`,
        note: record.description,
        sourcePlatform: 'imported' as const,
        captureSource: 'upload' as const,
        location: { ...source.location, placeName: definition.name },
      } : undefined;
      return {
        id: `${definition.id}-${record.id}`,
        title: record.title,
        timestamp: source?.recordedAt ?? '2026-09-12T15:32:00',
        description: record.description,
        audioUrl: `/audio/spatial/${record.file}`,
        position: (positionsByPlace[definition.id] ?? [{ x: 0, y: 0, z: 0 }])[index % (positionsByPlace[definition.id]?.length ?? 1)],
        sourceMemoryId: sourceMemory?.id ?? '',
        sourceMemory,
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
    let entryMotion: { startedAt: number; from: THREE.Vector3; to: THREE.Vector3 } | undefined;
    const markerCenter = new THREE.Vector3();
    const markerSize = new THREE.Vector3(1, 1, 1);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    controls.addEventListener('start', () => {
      hasUserInteracted = true;
      entryMotion = undefined;
    });
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
      markerCenter.copy(center);
      markerSize.copy(size);
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
      const framingScale = isPortrait ? 0.68 : (entryViews[activePlace.id]?.landscapeFramingScale ?? 0.42);
      const distance = THREE.MathUtils.clamp(
        (fitSize * 0.5) / Math.tan(fitFov * 0.5) * framingScale,
        controls.minDistance,
        controls.maxDistance,
      );
      // 进入后靠近房间主体；按各场景尺寸计算，避免小房间推进过头。
      const entryView = entryViews[activePlace.id];
      const distanceScale = entryView?.distanceScale ?? 0.55;
      const portraitDistanceScale = entryView?.portraitDistanceScale ?? distanceScale;
      const entryDistance = Math.max(controls.minDistance, distance * (isPortrait ? Math.min(0.85, portraitDistanceScale * 1.27) : distanceScale));
      const target = entryView?.target
        ? new THREE.Vector3(...entryView.target)
        : center.clone().add(new THREE.Vector3(...(entryView?.targetOffset ?? [0, 0, 0])).multiply(size));
      const direction = new THREE.Vector3(...(entryView?.direction ?? [0, 0, 1] as [number, number, number])).normalize();
      const depthPadding = Math.max(size.z * 0.7, 0.5);

      camera.aspect = aspect;
      camera.near = 0.01;
      camera.far = Math.max(100, distance + depthPadding * 8);
      const startDistance = Math.max(entryDistance, distance);
      const from = target.clone().addScaledVector(direction, startDistance);
      const to = target.clone().addScaledVector(direction, entryDistance);
      camera.position.copy(reduceMotion ? to : from);
      entryMotion = reduceMotion ? undefined : { startedAt: performance.now(), from, to };
      camera.updateProjectionMatrix();
      controls.target.copy(target);
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
    void splat.initialized.then(() => fitCameraToSplat()).catch(() => { /* 载入错误由上方统一展示。 */ });

    const animate = () => {
      if (disposed) return;
      if (entryMotion) {
        const progress = Math.min(1, (performance.now() - entryMotion.startedAt) / 1100);
        const eased = progress * progress * (3 - 2 * progress);
        camera.position.lerpVectors(entryMotion.from, entryMotion.to, eased);
        if (progress === 1) entryMotion = undefined;
      }
      controls.update();
      renderer.render(scene, camera);
      const screenAnchors = screenAnchorsByPlace[activePlace.id] ?? [{ x: 0.72, y: 0.48 }];
      const projectedMarkers = activePlace.memories.map((memory, index) => {
        const element = nodeRefs.current[memory.id];
        if (!element) return undefined;
        // Marker positions are normalized to each room's useful splat bounds,
        // so a room with a different capture scale still gets separated nodes.
        const markerWorldPosition = markerCenter.clone().add(new THREE.Vector3(
          memory.position.x * markerSize.x * 0.42,
          memory.position.y * markerSize.y * 0.42,
          memory.position.z * markerSize.z * 0.16,
        ));
        const point = markerWorldPosition.project(camera);
        const anchor = screenAnchors[index % screenAnchors.length];
        const anchorX = anchor.x * host.clientWidth;
        const anchorY = anchor.y * host.clientHeight;
        // Keep the marker visible while the camera moves or the splat has a
        // large depth range; the anchor is the legible presentation position.
        return { element, visible: splat.isInitialized, x: anchorX, y: anchorY };
      });
      const visibleMarkers = projectedMarkers.filter((marker): marker is { element: HTMLButtonElement; visible: boolean; x: number; y: number } => Boolean(marker?.visible));
      // Resolve label collisions after projection. This keeps nearby 3D points
      // legible without changing their underlying room coordinates.
      const minGap = Math.min(210, Math.max(130, host.clientWidth * 0.11));
      for (let pass = 0; pass < 4; pass += 1) {
        visibleMarkers.forEach((marker, index) => {
          visibleMarkers.slice(index + 1).forEach((other) => {
            const dx = other.x - marker.x;
            const dy = other.y - marker.y;
            const distance = Math.hypot(dx, dy);
            if (distance >= minGap) return;
            const angle = distance > 0.01 ? Math.atan2(dy, dx) : ((index % 2 ? 1 : -1) * Math.PI / 2);
            const push = (minGap - Math.max(distance, 0.01)) * 0.52;
            marker.x -= Math.cos(angle) * push;
            marker.y -= Math.sin(angle) * push;
            other.x += Math.cos(angle) * push;
            other.y += Math.sin(angle) * push;
          });
        });
      }
      const halfLabelWidth = Math.min(170, host.clientWidth * 0.18);
      visibleMarkers.forEach((marker) => {
        marker.x = THREE.MathUtils.clamp(marker.x, halfLabelWidth, host.clientWidth - halfLabelWidth);
        marker.y = THREE.MathUtils.clamp(marker.y, 72, host.clientHeight - 72);
      });
      projectedMarkers.forEach((marker) => {
        if (!marker) return;
        marker.element.style.opacity = marker.visible ? '1' : '0';
        marker.element.style.pointerEvents = marker.visible ? 'auto' : 'none';
        if (marker.visible) marker.element.style.transform = `translate(-50%, -50%) translate(${marker.x}px, ${marker.y}px)`;
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
          <i aria-hidden="true" /><span>{memory.title}</span><small><b aria-hidden="true">▶</b> 点击聆听</small>
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
          <button className="spatial-play" type="button" onClick={() => { if (selectedMemory.sourceMemory) onPlay(selectedMemory.sourceMemory); }}>
            <span aria-hidden="true">{playingMemoryId === selectedMemory.sourceMemoryId ? 'Ⅱ' : '▶'}</span>
            {playingMemoryId === selectedMemory.sourceMemoryId ? '暂停这段声音' : '播放这段声音'}
          </button>
        </aside>
      )}
    </section>
  );
}
