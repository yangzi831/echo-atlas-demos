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
import type { GeocodingResult } from '../../services/maptiler';
import type { City, SoundNode } from '../../types/sound';
import { MapExplorerControls } from './MapExplorerControls';

type ShanghaiMapProps = {
  city: City;
  nodes: SoundNode[];
  selectedNodeId?: string;
  highlightedNodeIds: string[];
  focusRequest?: number;
  onSelectNode: (node: SoundNode) => void;
};

type LayerState = {
  nodes: SoundNode[];
  selectedNodeId?: string;
  highlightedNodeIds: Set<string>;
};

type HoveredNode = {
  node: SoundNode;
  x: number;
  y: number;
};

const cyanCore: [number, number, number, number] = [111, 239, 235, 238];
const cyanLine: [number, number, number, number] = [192, 252, 248, 210];
const warmCore: [number, number, number, number] = [233, 211, 154, 248];
const warmLine: [number, number, number, number] = [255, 238, 191, 230];

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

function createSoundLayers(
  state: LayerState,
  pulse: number,
  onHover: (info: PickingInfo<SoundNode>) => void,
  onClick: (info: PickingInfo<SoundNode>) => void,
) {
  const isEmphasized = (node: SoundNode) =>
    node.id === state.selectedNodeId || state.highlightedNodeIds.has(node.id);

  return [
    new ScatterplotLayer<SoundNode>({
      id: 'echo-glow',
      data: state.nodes,
      getPosition: (node) => node.coordinate,
      getRadius: (node) =>
        (150 + node.density * 240) * pulse * (isEmphasized(node) ? 1.22 : 1),
      radiusUnits: 'meters',
      radiusMinPixels: 10,
      radiusMaxPixels: 40,
      getFillColor: (node) =>
        isEmphasized(node) ? [216, 180, 111, 56] : [42, 207, 222, 40],
      getLineColor: (node) =>
        isEmphasized(node) ? [233, 211, 154, 150] : [83, 226, 235, 120],
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      stroked: true,
      parameters: { depthWriteEnabled: false, depthCompare: 'always' },
    }),
    new ScatterplotLayer<SoundNode>({
      id: 'echo-core',
      data: state.nodes,
      getPosition: (node) => node.coordinate,
      getRadius: (node) =>
        (40 + node.density * 44) * (isEmphasized(node) ? 1.25 : 1),
      radiusUnits: 'meters',
      radiusMinPixels: 5,
      radiusMaxPixels: 13,
      getFillColor: (node) => (isEmphasized(node) ? warmCore : cyanCore),
      getLineColor: (node) => (isEmphasized(node) ? warmLine : cyanLine),
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
  ];
}

export function ShanghaiMap({
  city,
  nodes,
  selectedNodeId,
  highlightedNodeIds,
  focusRequest = 0,
  onSelectNode,
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
  const layerStateRef = useRef<LayerState>({
    nodes,
    selectedNodeId,
    highlightedNodeIds: highlightedNodeSet,
  });

  selectNodeRef.current = onSelectNode;
  layerStateRef.current = {
    nodes,
    selectedNodeId,
    highlightedNodeIds: highlightedNodeSet,
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

    const renderLayers = (pulse = 1) => {
      overlay.setProps({
        layers: createSoundLayers(
          layerStateRef.current,
          pulse,
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
          renderLayers(0.95 + Math.sin(time / 900) * 0.08);
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
  }, [highlightedNodeSet, nodes, selectedNodeId]);

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
          <span>{hoveredNode.node.location}</span>
          <p>{hoveredNode.node.memoryText}</p>
        </div>
      )}

      <div className="map-node-accessibility">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => handleAccessibleNodeSelect(node)}
          >
            {node.title}, {node.location}
          </button>
        ))}
      </div>

      <div className="map-caption">
        <span>{mapState === 'ready' ? 'MapLibre + deck.gl' : 'Loading Atlas'}</span>
        <span>{city.name} · {city.country}</span>
        <span>{nodes.length} active echoes</span>
      </div>
    </section>
  );
}
