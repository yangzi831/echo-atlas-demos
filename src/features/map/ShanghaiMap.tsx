import { useEffect, useMemo, useRef, useState } from 'react';
import type { PickingInfo } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import maplibregl, { type IControl, type Map as MapLibreMap } from 'maplibre-gl';
import {
  createAtlasMap,
  requestedStyle,
  setAtlasMapStyle,
  type AtlasMapStyle,
  updateAtlasMapCity,
} from '../../services/maplibre';
import { fallbackSearchPlaces, type GeocodingResult } from '../../services/maptiler';
import type { City, SoundNode } from '../../types/sound';
import { CURRENT_USER_ID } from '../../data/users';
import { MapExplorerControls } from './MapExplorerControls';

type ShanghaiMapProps = {
  city: City;
  nodes: SoundNode[];
  allNodes: SoundNode[];
  searchNodes: SoundNode[];
  suggestedCities: City[];
  selectedNodeId?: string;
  playingNodeId?: string;
  highlightedNodeIds: string[];
  dimUnowned?: boolean;
  focusNode?: SoundNode;
  focusRequest?: number;
  onSelectNode: (node: SoundNode) => void;
  onExplorePlace: (result: GeocodingResult) => void;
};

type LayerState = {
  nodes: SoundNode[];
  ambientEchoes: AmbientEcho[];
  selectedNodeId?: string;
  playingNodeId?: string;
  highlightedNodeIds: Set<string>;
  dimUnowned: boolean;
};

type AmbientEcho = {
  id: string;
  coordinate: [number, number];
  radius: number;
  opacity: number;
  phase: number;
};

type HoveredNode = {
  node: SoundNode;
  x: number;
  y: number;
};

const cyanCore: [number, number, number, number] = [118, 239, 238, 234];
const cyanLine: [number, number, number, number] = [198, 255, 252, 218];
const warmCore: [number, number, number, number] = [228, 255, 251, 255];
const warmLine: [number, number, number, number] = [173, 255, 248, 244];

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function flyToNode(map: MapLibreMap, node: SoundNode) {
  map.flyTo({
    center: node.coordinate,
    zoom: 15.2,
    pitch: 58,
    bearing: 18,
    duration: prefersReducedMotion() ? 0 : 1500,
    essential: true,
  });
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createAmbientEchoes(city: City, anchors: SoundNode[], count = 120) {
  if (anchors.length === 0) {
    return [];
  }

  const random = seededRandom(hashSeed(`ambient-${city.id}`));
  const sourceAnchors = anchors;

  return Array.from({ length: count }, (_, index): AmbientEcho => {
    const anchor = sourceAnchors[index % sourceAnchors.length].coordinate;
    const longitudeScale = Math.max(0.62, Math.cos(city.center[1] * Math.PI / 180));
    const useAnchorCluster = index % 3 === 0;
    const angle = random() * Math.PI * 2;
    const distance = 0.002 + Math.pow(random(), 0.72) * 0.032;
    const coordinate: [number, number] = useAnchorCluster
      ? [
          anchor[0] + Math.cos(angle) * distance / longitudeScale,
          anchor[1] + Math.sin(angle) * distance * 0.68,
        ]
      : [
          city.center[0] + (random() - 0.5) * 0.24 / longitudeScale,
          city.center[1] + (random() - 0.5) * 0.14,
        ];

    return {
      id: `${city.id}-ambient-${index}`,
      coordinate,
      radius: 0.85 + random() * 1.5,
      opacity: 0.38 + random() * 0.4,
      phase: random() * Math.PI * 2,
    };
  });
}

function createSoundLayers(
  state: LayerState,
  time: number,
  onHover: (info: PickingInfo<SoundNode>) => void,
  onClick: (info: PickingInfo<SoundNode>) => void,
) {
  const primaryNodes = state.nodes.filter((node) => node.seedType !== 'ambient');
  const seedAmbientNodes: AmbientEcho[] = state.nodes
    .filter((node) => node.seedType === 'ambient')
    .map((node) => ({
      id: node.id,
      coordinate: node.coordinate,
      radius: 0.9 + (node.visualImprint.seed % 6) * 0.18,
      opacity: 0.34 + (node.visualImprint.seed % 5) * 0.08,
      phase: node.visualImprint.seed,
    }));
  const ambientNodes = [...state.ambientEchoes, ...seedAmbientNodes];
  const isEmphasized = (node: SoundNode) =>
    node.id === state.selectedNodeId
    || state.highlightedNodeIds.has(node.id)
    || (state.dimUnowned && node.ownerId === CURRENT_USER_ID);
  const isPlaying = (node: SoundNode) => node.id === state.playingNodeId;
  const nodeOpacity = (node: SoundNode) => state.dimUnowned && node.ownerId !== CURRENT_USER_ID ? 0.1 : 1;
  const pulse = 0.5 + Math.sin(time / 1100) * 0.5;

  return [
    new ScatterplotLayer<AmbientEcho>({
      id: 'ambient-echo-field',
      data: ambientNodes,
      getPosition: (echo) => echo.coordinate,
      getRadius: (echo) => echo.radius * (0.92 + Math.sin(time / 3400 + echo.phase) * 0.12),
      radiusUnits: 'pixels',
      radiusMinPixels: 0.9,
      radiusMaxPixels: 2.6,
      getFillColor: (echo) => [148, 235, 237, Math.round(255 * echo.opacity * (state.dimUnowned ? 0.26 : 0.86))],
      pickable: false,
      parameters: { depthWriteEnabled: false, depthCompare: 'always' },
    }),
    new ScatterplotLayer<SoundNode>({
      id: 'primary-echo-halo',
      data: primaryNodes,
      getPosition: (node) => node.coordinate,
      getRadius: (node) => 4 + node.density * 5 + (isEmphasized(node) ? 2 : 0),
      radiusUnits: 'pixels',
      radiusMinPixels: 4,
      radiusMaxPixels: 12,
      getFillColor: (node) =>
        isEmphasized(node)
          ? [216, 224, 200, Math.round(54 * nodeOpacity(node))]
          : [64, 214, 224, Math.round(34 * nodeOpacity(node))],
      stroked: false,
      parameters: { depthWriteEnabled: false, depthCompare: 'always' },
    }),
    new ScatterplotLayer<SoundNode>({
      id: 'primary-echo-core',
      data: primaryNodes,
      getPosition: (node) => node.coordinate,
      getRadius: (node) => 2.2 + node.density * 2.5 + (isEmphasized(node) ? 0.8 : 0),
      radiusUnits: 'pixels',
      radiusMinPixels: 2.4,
      radiusMaxPixels: 6.5,
      getFillColor: (node) => {
        const color = isEmphasized(node) ? warmCore : cyanCore;
        return [color[0], color[1], color[2], Math.round(color[3] * nodeOpacity(node))];
      },
      getLineColor: (node) => {
        const color = isEmphasized(node) ? warmLine : cyanLine;
        return [color[0], color[1], color[2], Math.round(color[3] * nodeOpacity(node))];
      },
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      stroked: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [70, 222, 238, 78],
      onHover,
      onClick,
      parameters: { depthWriteEnabled: false, depthCompare: 'always' },
    }),
    new ScatterplotLayer<SoundNode>({
      id: 'playing-echo-wave-inner',
      data: primaryNodes.filter(isPlaying),
      getPosition: (node) => node.coordinate,
      getRadius: 9 + pulse * 6,
      radiusUnits: 'pixels',
      filled: false,
      stroked: true,
      getLineColor: [152, 245, 241, Math.round(112 * (1 - pulse * 0.55))],
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      pickable: false,
      parameters: { depthWriteEnabled: false, depthCompare: 'always' },
    }),
    new ScatterplotLayer<SoundNode>({
      id: 'playing-echo-wave-outer',
      data: primaryNodes.filter(isPlaying),
      getPosition: (node) => node.coordinate,
      getRadius: 14 + pulse * 10,
      radiusUnits: 'pixels',
      filled: false,
      stroked: true,
      getLineColor: [131, 228, 232, Math.round(70 * (1 - pulse * 0.72))],
      getLineWidth: 0.8,
      lineWidthUnits: 'pixels',
      pickable: false,
      parameters: { depthWriteEnabled: false, depthCompare: 'always' },
    }),
  ];
}

export function ShanghaiMap({
  city,
  nodes,
  allNodes,
  searchNodes,
  suggestedCities,
  selectedNodeId,
  playingNodeId,
  highlightedNodeIds,
  dimUnowned = false,
  focusNode,
  focusRequest = 0,
  onSelectNode,
  onExplorePlace,
}: ShanghaiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const renderLayersRef = useRef<((pulse?: number) => void) | null>(null);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const selectNodeRef = useRef(onSelectNode);
  const previousCityIdRef = useRef(city.id);
  const previousFocusRequestRef = useRef(focusRequest);
  const [mapState, setMapState] = useState<'loading' | 'ready'>('loading');
  const [mapStyle, setMapStyle] = useState<AtlasMapStyle>(requestedStyle);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string>();
  const [hoveredNode, setHoveredNode] = useState<HoveredNode>();

  const highlightedNodeSet = useMemo(
    () => new Set(highlightedNodeIds),
    [highlightedNodeIds],
  );
  const ambientEchoes = useMemo(
    () => createAmbientEchoes(city, allNodes),
    [allNodes, city],
  );
  const mockPlaces = useMemo<GeocodingResult[]>(
    () => [
      ...suggestedCities.map((item) => ({
        id: `city-${item.id}`,
        name: item.name,
        context: `${item.localName} · ${item.country}`,
        center: item.center,
        placeType: 'place',
      })),
      ...fallbackSearchPlaces,
      ...searchNodes.map((node) => ({
        id: node.id,
        name: node.title,
        context: `${node.location.city} · ${node.location.placeName} · ${node.tags.join(' · ')}`,
        center: node.coordinate,
        placeType: 'poi',
      })),
    ],
    [searchNodes, suggestedCities],
  );
  const layerStateRef = useRef<LayerState>({
    nodes,
    ambientEchoes,
    selectedNodeId,
    playingNodeId,
    highlightedNodeIds: highlightedNodeSet,
    dimUnowned,
  });

  selectNodeRef.current = onSelectNode;
  layerStateRef.current = {
    nodes,
    ambientEchoes,
    selectedNodeId,
    playingNodeId,
    highlightedNodeIds: highlightedNodeSet,
    dimUnowned,
  };

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let disposed = false;
    let animationFrame = 0;
    const reducedMotion = prefersReducedMotion();
    const map = createAtlasMap(containerRef.current, city, mapStyle);
    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });

    mapRef.current = map;

    const hideTooltip = () => {
      map.getCanvas().style.cursor = '';
      setHoveredNode(undefined);
    };

    const handleHover = (info: PickingInfo<SoundNode>) => {
      if (!info.object) {
        hideTooltip();
        return;
      }

      map.getCanvas().style.cursor = 'pointer';
      setHoveredNode({ node: info.object, x: info.x, y: info.y });
    };

    const handleClick = (info: PickingInfo<SoundNode>) => {
      if (!info.object) {
        return;
      }

      hideTooltip();
      flyToNode(map, info.object);
      selectNodeRef.current(info.object);
    };

    const renderLayers = (time = 0) => {
      overlay.setProps({
        layers: createSoundLayers(
          layerStateRef.current,
          time,
          handleHover,
          handleClick,
        ),
      });
    };

    renderLayersRef.current = renderLayers;

    map.on('load', () => {
      if (disposed) {
        return;
      }

      map.addControl(overlay as unknown as IControl);
      setMapState('ready');
      renderLayers();

      if (!reducedMotion) {
        const animate = (time: number) => {
          renderLayers(time);
          animationFrame = window.requestAnimationFrame(animate);
        };
        animationFrame = window.requestAnimationFrame(animate);
      }
    });

    map.on('mouseout', hideTooltip);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      renderLayersRef.current = null;
      overlay.finalize();
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    renderLayersRef.current?.();
  }, [ambientEchoes, dimUnowned, highlightedNodeSet, nodes, playingNodeId, selectedNodeId]);

  useEffect(() => {
    if (hoveredNode && !nodes.some((node) => node.id === hoveredNode.node.id)) {
      setHoveredNode(undefined);
    }
  }, [hoveredNode, nodes]);

  useEffect(() => {
    const cityChanged = previousCityIdRef.current !== city.id;
    const focusRequested = previousFocusRequestRef.current !== focusRequest;
    if (!cityChanged && !focusRequested) {
      return;
    }

    previousCityIdRef.current = city.id;
    previousFocusRequestRef.current = focusRequest;
    setHoveredNode(undefined);
    if (mapRef.current) {
      updateAtlasMapCity(mapRef.current, city);
    }
    mapRef.current?.flyTo({
      center: city.center,
      zoom: city.zoom,
      pitch: 42,
      bearing: -12,
      duration: prefersReducedMotion() ? 0 : 1700,
      essential: true,
    });
  }, [city, focusRequest]);

  useEffect(() => {
    if (focusNode && mapRef.current) {
      setHoveredNode(undefined);
      flyToNode(mapRef.current, focusNode);
    }
  }, [focusNode]);

  const handleAccessibleNodeSelect = (node: SoundNode) => {
    const map = mapRef.current;
    if (map) {
      flyToNode(map, node);
    }
    onSelectNode(node);
  };

  const handleChangeMapStyle = (nextStyle: AtlasMapStyle) => {
    const map = mapRef.current;
    if (!map || nextStyle === mapStyle) {
      return;
    }

    setMapStyle(nextStyle);
    setMapState('loading');
    map.once('idle', () => setMapState('ready'));
    setAtlasMapStyle(map, city, nextStyle);

    const url = new URL(window.location.href);
    url.searchParams.set('mapStyle', nextStyle);
    window.history.replaceState({}, '', url);
  };

  const handleLocate = () => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) {
      setLocationMessage('当前浏览器不支持定位');
      return;
    }

    setLocating(true);
    setLocationMessage(undefined);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const center: [number, number] = [coords.longitude, coords.latitude];
        const markerElement = document.createElement('div');
        markerElement.className = 'user-location-marker';
        markerElement.setAttribute('aria-label', '你的位置');
        locationMarkerRef.current?.remove();
        locationMarkerRef.current = new maplibregl.Marker({ element: markerElement })
          .setLngLat(center)
          .addTo(map);
        map.flyTo({
          center,
          zoom: 17,
          pitch: 48,
          duration: prefersReducedMotion() ? 0 : 1400,
          essential: true,
        });
        setLocating(false);
        setLocationMessage('已定位到你的位置');
      },
      () => {
        setLocating(false);
        setLocationMessage('无法取得位置，请检查浏览器权限');
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60_000 },
    );
  };

  const handleSelectPlace = (result: GeocodingResult) => {
    onExplorePlace(result);
    mapRef.current?.flyTo({
      center: result.center,
      zoom: result.placeType === 'address' || result.placeType === 'poi' ? 17.5 : 16,
      pitch: 48,
      duration: prefersReducedMotion() ? 0 : 1400,
      essential: true,
    });
  };

  return (
    <section className="map-stage" aria-label={`${city.localName}声音记忆地图`}>
      <div
        ref={containerRef}
        className={`maplibre-layer ${mapState === 'ready' ? 'is-ready' : ''}`}
      />

      <div className={`map-loading ${mapState === 'ready' ? 'is-hidden' : ''}`}>
        正在进入声音地图
      </div>

      <div className="map-vignette" aria-hidden="true" />

      <MapExplorerControls
        mapStyle={mapStyle}
        cityCenter={city.center}
        mockPlaces={mockPlaces}
        locating={locating}
        locationMessage={locationMessage}
        onChangeStyle={handleChangeMapStyle}
        onLocate={handleLocate}
        onSelectPlace={handleSelectPlace}
      />

      {hoveredNode && (
        <div
          className="map-tooltip"
          role="tooltip"
          style={{ left: hoveredNode.x, top: hoveredNode.y }}
        >
          <time>{hoveredNode.node.recordedAt} · {city.name}</time>
          <strong>{hoveredNode.node.title}</strong>
          <span>{hoveredNode.node.location.placeName}</span>
          <p>{hoveredNode.node.note}</p>
        </div>
      )}

      <div className="map-node-accessibility">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => handleAccessibleNodeSelect(node)}
          >
            {node.title}, {node.location.placeName}
          </button>
        ))}
      </div>

      <div className="map-caption">
        <span>{mapState === 'ready' ? 'MapLibre + deck.gl' : 'Loading Atlas'}</span>
        <span>{city.name} · {city.country}</span>
        <span>{nodes.filter((node) => node.seedType !== 'ambient').length} primary · {ambientEchoes.length + nodes.filter((node) => node.seedType === 'ambient').length} ambient</span>
      </div>
    </section>
  );
}
