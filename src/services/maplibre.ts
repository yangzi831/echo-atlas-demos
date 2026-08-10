import maplibregl, { type Map, type StyleSpecification } from 'maplibre-gl';
import type { City } from '../types/sound';

export type AtlasMapStyle =
  | 'deep-blue'
  | 'dark-satellite';

const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY?.trim();
const mapContexts = new WeakMap<Map, { city: City; style: AtlasMapStyle }>();
const mapTilerFallbacks = new WeakSet<Map>();

const vectorSource = {
  type: 'vector' as const,
  url: 'https://tiles.openfreemap.org/planet',
  attribution: '© OpenStreetMap contributors',
};

const glyphs = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const labelField = [
  'coalesce',
  ['get', 'name:nonlatin'],
  ['get', 'name_en'],
  ['get', 'name'],
] as unknown as string;

function citySource(city: City) {
  return {
    type: 'geojson' as const,
    data: {
      type: 'Feature' as const,
      properties: {
        name: city.name,
        localName: city.localName,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: city.center,
      },
    },
  };
}

function commonLabelLayers(options: {
  cityColor: string;
  cityHalo: string;
  districtColor: string;
  streetColor: string;
  waterColor: string;
  poiColor: string;
  streetOpacity: number;
  streetMinZoom: number;
}) {
  return [
    {
      id: 'water-names',
      type: 'symbol' as const,
      source: 'atlas-vector',
      'source-layer': 'water_name',
      minzoom: 8,
      maxzoom: 16,
      layout: {
        'symbol-placement': 'line' as const,
        'symbol-spacing': 520,
        'text-field': labelField,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 15, 11],
        'text-letter-spacing': 0.04,
        'text-max-angle': 28,
        'text-rotation-alignment': 'map' as const,
      },
      paint: {
        'text-color': options.waterColor,
        'text-opacity': 0.86,
        'text-halo-color': options.cityHalo,
        'text-halo-width': 1.6,
        'text-halo-blur': 0.8,
      },
    },
    {
      id: 'regional-place-names',
      type: 'symbol' as const,
      source: 'atlas-vector',
      'source-layer': 'place',
      maxzoom: 11.5,
      filter: [
        'match',
        ['get', 'class'],
        ['city', 'town', 'village'],
        true,
        false,
      ],
      layout: {
        'text-field': labelField,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 11, 13],
        'text-letter-spacing': 0.04,
        'text-allow-overlap': false,
        'text-padding': 12,
      },
      paint: {
        'text-color': options.districtColor,
        'text-opacity': 0.76,
        'text-halo-color': options.cityHalo,
        'text-halo-width': 1.6,
        'text-halo-blur': 0.8,
      },
    },
    {
      id: 'district-neighborhood-names',
      type: 'symbol' as const,
      source: 'atlas-vector',
      'source-layer': 'place',
      minzoom: 10.2,
      maxzoom: 17,
      filter: [
        'match',
        ['get', 'class'],
        ['suburb', 'quarter', 'neighbourhood', 'town'],
        true,
        false,
      ],
      layout: {
        'text-field': labelField,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 16, 11.5],
        'text-letter-spacing': 0.03,
        'text-allow-overlap': false,
        'text-padding': 16,
      },
      paint: {
        'text-color': options.districtColor,
        'text-opacity': 0.84,
        'text-halo-color': options.cityHalo,
        'text-halo-width': 1.8,
        'text-halo-blur': 0.9,
      },
    },
    {
      id: 'landmark-names',
      type: 'symbol' as const,
      source: 'atlas-vector',
      'source-layer': 'poi',
      minzoom: 12.6,
      maxzoom: 18,
      filter: [
        'match',
        ['get', 'class'],
        ['museum', 'park', 'stadium', 'attraction', 'university', 'hospital', 'railway'],
        true,
        false,
      ],
      layout: {
        'text-field': labelField,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12.6, 9, 17, 10.5],
        'text-letter-spacing': 0.02,
        'text-allow-overlap': false,
        'text-padding': 24,
      },
      paint: {
        'text-color': options.poiColor,
        'text-opacity': 0.78,
        'text-halo-color': options.cityHalo,
        'text-halo-width': 1.7,
        'text-halo-blur': 0.8,
      },
    },
    {
      id: 'street-names',
      type: 'symbol' as const,
      source: 'atlas-vector',
      'source-layer': 'transportation_name',
      minzoom: options.streetMinZoom,
      filter: [
        'match',
        ['get', 'class'],
        ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
        true,
        false,
      ],
      layout: {
        'symbol-placement': 'line' as const,
        'symbol-spacing': 380,
        'text-field': labelField,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8.5, 17, 10.5],
        'text-letter-spacing': 0.02,
        'text-max-angle': 28,
        'text-rotation-alignment': 'map' as const,
      },
      paint: {
        'text-color': options.streetColor,
        'text-opacity': options.streetOpacity,
        'text-halo-color': options.cityHalo,
        'text-halo-width': 1.8,
        'text-halo-blur': 0.7,
      },
    },
    {
      id: 'current-city-name',
      type: 'symbol' as const,
      source: 'current-city',
      minzoom: 9,
      maxzoom: 16.5,
      layout: {
        'text-field': ['concat', ['get', 'localName'], '  ', ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 15, 13, 20],
        'text-letter-spacing': 0.04,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-offset': [0, -1.1],
      },
      paint: {
        'text-color': options.cityColor,
        'text-opacity': 0.96,
        'text-halo-color': options.cityHalo,
        'text-halo-width': 2.4,
        'text-halo-blur': 1.1,
      },
    },
  ];
}

function deepBlueStyle(city: City): StyleSpecification {
  return {
    version: 8,
    sources: {
      'atlas-vector': vectorSource,
      'current-city': citySource(city),
    },
    glyphs,
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#071521' },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'atlas-vector',
        'source-layer': 'landcover',
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            ['wood', 'grass', 'park'],
            '#102b32',
            ['farmland', 'sand'],
            '#172b35',
            '#0d2230',
          ],
          'fill-opacity': 0.82,
        },
      },
      {
        id: 'water-glow',
        type: 'line',
        source: 'atlas-vector',
        'source-layer': 'water',
        paint: {
          'line-color': '#2aa9c8',
          'line-width': 8,
          'line-blur': 10,
          'line-opacity': 0.18,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'atlas-vector',
        'source-layer': 'water',
        paint: { 'fill-color': '#0a4058', 'fill-opacity': 0.94 },
      },
      {
        id: 'boundaries',
        type: 'line',
        source: 'atlas-vector',
        'source-layer': 'boundary',
        paint: {
          'line-color': '#567486',
          'line-width': 0.8,
          'line-opacity': 0.3,
          'line-dasharray': [3, 5],
        },
      },
      {
        id: 'road-casing',
        type: 'line',
        source: 'atlas-vector',
        'source-layer': 'transportation',
        paint: {
          'line-color': '#07131d',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 13, 2.5, 17, 6],
          'line-opacity': 0.74,
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'atlas-vector',
        'source-layer': 'transportation',
        paint: {
          'line-color': [
            'match',
            ['get', 'class'],
            ['motorway', 'trunk'],
            '#79a9bd',
            ['primary', 'secondary'],
            '#557c91',
            '#36566b',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.35, 13, 1.15, 17, 2.8],
          'line-opacity': 0.62,
        },
      },
      {
        id: 'buildings',
        type: 'fill',
        source: 'atlas-vector',
        'source-layer': 'building',
        minzoom: 12.5,
        paint: { 'fill-color': '#294154', 'fill-opacity': 0.35 },
      },
      ...commonLabelLayers({
        cityColor: '#f2fbfa',
        cityHalo: '#06121c',
        districtColor: '#c7dadd',
        streetColor: '#d6e4e5',
        waterColor: '#9ce6ef',
        poiColor: '#c1d3d4',
        streetOpacity: 0.82,
        streetMinZoom: 11.8,
      }),
    ],
  } as StyleSpecification;
}

function darkSatelliteStyle(city: City): StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Tiles © Esri',
      },
      'atlas-vector': vectorSource,
      'current-city': citySource(city),
    },
    glyphs,
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#071216' },
      },
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        paint: {
          'raster-opacity': 0.74,
          'raster-saturation': -0.68,
          'raster-contrast': 0.3,
          'raster-brightness-min': 0.03,
          'raster-brightness-max': 0.44,
          'raster-hue-rotate': 16,
        },
      },
      {
        id: 'water-veil',
        type: 'fill',
        source: 'atlas-vector',
        'source-layer': 'water',
        paint: { 'fill-color': '#073744', 'fill-opacity': 0.42 },
      },
      {
        id: 'road-haze',
        type: 'line',
        source: 'atlas-vector',
        'source-layer': 'transportation',
        paint: {
          'line-color': '#b9d7d4',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 13, 3, 17, 7],
          'line-blur': 5,
          'line-opacity': 0.11,
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'atlas-vector',
        'source-layer': 'transportation',
        paint: {
          'line-color': [
            'match',
            ['get', 'class'],
            ['motorway', 'trunk'],
            '#d8e6df',
            ['primary', 'secondary'],
            '#a5bbb7',
            '#748b8a',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 13, 0.85, 17, 1.8],
          'line-opacity': 0.54,
        },
      },
      {
        id: 'building-lights',
        type: 'fill',
        source: 'atlas-vector',
        'source-layer': 'building',
        minzoom: 13,
        paint: { 'fill-color': '#d6e3dc', 'fill-opacity': 0.1 },
      },
      ...commonLabelLayers({
        cityColor: '#f5fbf8',
        cityHalo: '#030a0d',
        districtColor: '#e2ece8',
        streetColor: '#eef4f0',
        waterColor: '#9ee2e8',
        poiColor: '#dce7e2',
        streetOpacity: 0.86,
        streetMinZoom: 11.8,
      }),
    ],
  } as StyleSpecification;
}

function artisticMinimalStyle(city: City): StyleSpecification {
  return {
    version: 8,
    sources: {
      'atlas-vector': vectorSource,
      'current-city': citySource(city),
    },
    glyphs,
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#142128' },
      },
      {
        id: 'land-mass',
        type: 'fill',
        source: 'atlas-vector',
        'source-layer': 'landcover',
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            ['wood', 'grass', 'park'],
            '#233a3b',
            '#1b2d34',
          ],
          'fill-opacity': 0.74,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'atlas-vector',
        'source-layer': 'water',
        paint: { 'fill-color': '#0a3b48', 'fill-opacity': 0.94 },
      },
      {
        id: 'city-outline',
        type: 'line',
        source: 'atlas-vector',
        'source-layer': 'boundary',
        paint: {
          'line-color': '#8ba0a3',
          'line-width': 0.8,
          'line-opacity': 0.36,
          'line-dasharray': [2, 6],
        },
      },
      {
        id: 'secondary-road-field',
        type: 'line',
        source: 'atlas-vector',
        'source-layer': 'transportation',
        paint: {
          'line-color': '#718288',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.18, 14, 0.55, 17, 1.1],
          'line-opacity': 0.25,
        },
      },
      {
        id: 'primary-traces',
        type: 'line',
        source: 'atlas-vector',
        'source-layer': 'transportation',
        filter: [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk', 'primary', 'secondary'],
          true,
          false,
        ],
        paint: {
          'line-color': '#b4c0bd',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 14, 0.9, 17, 1.8],
          'line-opacity': 0.54,
        },
      },
      {
        id: 'building-field',
        type: 'fill',
        source: 'atlas-vector',
        'source-layer': 'building',
        minzoom: 13,
        paint: { 'fill-color': '#b9c7c3', 'fill-opacity': 0.08 },
      },
      ...commonLabelLayers({
        cityColor: '#f1f5f1',
        cityHalo: '#111b20',
        districtColor: '#cbd5d2',
        streetColor: '#d8dfdc',
        waterColor: '#8fd0d7',
        poiColor: '#c7d1cd',
        streetOpacity: 0.72,
        streetMinZoom: 12.3,
      }),
    ],
  } as StyleSpecification;
}

export function requestedStyle(): AtlasMapStyle {
  const value = new URLSearchParams(window.location.search).get('mapStyle');
  if (value === 'dark-satellite') {
    return value;
  }
  return 'deep-blue';
}

function createAtlasStyle(city: City, style: AtlasMapStyle): StyleSpecification {
  if (style === 'dark-satellite') {
    return darkSatelliteStyle(city);
  }
  return deepBlueStyle(city);
}

function mapTilerStyleUrl(style: AtlasMapStyle) {
  if (!mapTilerKey) {
    return undefined;
  }

  const mapId = style === 'dark-satellite' ? 'hybrid' : 'streets-v2';
  return `https://api.maptiler.com/maps/${mapId}/style.json?key=${encodeURIComponent(mapTilerKey)}`;
}

function setPaintIfPossible(
  map: Map,
  layerId: string,
  property: string,
  value: unknown,
) {
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // MapTiler styles evolve; unsupported paint properties should not break the map.
  }
}

function layerIdentity(layer: StyleSpecification['layers'][number]) {
  const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : '';
  return `${layer.id} ${sourceLayer ?? ''}`.toLowerCase();
}

function themeMapTilerStyle(map: Map, style: AtlasMapStyle) {
  const layers = map.getStyle().layers ?? [];
  const satellite = style === 'dark-satellite';

  layers.forEach((layer) => {
    const identity = layerIdentity(layer);

    if (layer.type === 'background') {
      setPaintIfPossible(map, layer.id, 'background-color', satellite ? '#071216' : '#071722');
      return;
    }

    if (layer.type === 'raster') {
      setPaintIfPossible(map, layer.id, 'raster-saturation', -0.68);
      setPaintIfPossible(map, layer.id, 'raster-contrast', 0.28);
      setPaintIfPossible(map, layer.id, 'raster-brightness-min', 0.025);
      setPaintIfPossible(map, layer.id, 'raster-brightness-max', satellite ? 0.48 : 0.62);
      setPaintIfPossible(map, layer.id, 'raster-opacity', satellite ? 0.82 : 0.72);
      return;
    }

    if (layer.type === 'fill') {
      if (/water|ocean|river|lake/.test(identity)) {
        setPaintIfPossible(map, layer.id, 'fill-color', satellite ? '#063746' : '#0a4058');
        setPaintIfPossible(map, layer.id, 'fill-opacity', satellite ? 0.42 : 0.94);
      } else if (/building/.test(identity)) {
        setPaintIfPossible(map, layer.id, 'fill-color', satellite ? '#d3dfdb' : '#294655');
        setPaintIfPossible(map, layer.id, 'fill-opacity', satellite ? 0.13 : 0.52);
      } else if (/park|wood|forest|grass|landcover/.test(identity)) {
        setPaintIfPossible(map, layer.id, 'fill-color', satellite ? '#17312f' : '#123239');
        setPaintIfPossible(map, layer.id, 'fill-opacity', satellite ? 0.22 : 0.82);
      } else if (!satellite && /landuse|residential|commercial|industrial/.test(identity)) {
        setPaintIfPossible(map, layer.id, 'fill-color', '#102630');
        setPaintIfPossible(map, layer.id, 'fill-opacity', 0.72);
      }
      return;
    }

    if (layer.type === 'fill-extrusion' && /building/.test(identity)) {
      setPaintIfPossible(map, layer.id, 'fill-extrusion-color', satellite ? '#aab8b5' : '#294655');
      setPaintIfPossible(map, layer.id, 'fill-extrusion-opacity', satellite ? 0.18 : 0.42);
      return;
    }

    if (layer.type === 'line') {
      if (/water|river|stream|canal/.test(identity)) {
        setPaintIfPossible(map, layer.id, 'line-color', satellite ? '#4b9fb0' : '#2b8fa8');
        setPaintIfPossible(map, layer.id, 'line-opacity', satellite ? 0.7 : 0.8);
      } else if (/boundary|admin/.test(identity)) {
        setPaintIfPossible(map, layer.id, 'line-color', '#647c88');
        setPaintIfPossible(map, layer.id, 'line-opacity', 0.38);
      } else if (/road|street|transport|motorway|trunk|primary|secondary|tertiary|path/.test(identity)) {
        const isMajor = /motorway|trunk|primary/.test(identity);
        const isMinor = /minor|service|path|track|residential/.test(identity);
        const color = satellite
          ? isMajor ? '#e5efeb' : isMinor ? '#8fa3a1' : '#b8cbc7'
          : isMajor ? '#79a9bd' : isMinor ? '#36586a' : '#557f92';
        setPaintIfPossible(map, layer.id, 'line-color', color);
        setPaintIfPossible(map, layer.id, 'line-opacity', satellite ? 0.68 : isMinor ? 0.52 : 0.72);
      }
      return;
    }

    if (layer.type === 'symbol') {
      const isWater = /water|river|ocean|marine/.test(identity);
      const isRoad = /road|street|transportation/.test(identity);
      const isPoi = /poi|transit|station|airport|rail|place-label/.test(identity);
      const textColor = isWater
        ? '#9ce6ef'
        : satellite
          ? '#f0f5f2'
          : isRoad
            ? '#d7e5e6'
            : isPoi
              ? '#c9dcda'
              : '#e6efed';

      setPaintIfPossible(map, layer.id, 'text-color', textColor);
      setPaintIfPossible(map, layer.id, 'text-halo-color', satellite ? '#03090c' : '#06131d');
      setPaintIfPossible(map, layer.id, 'text-halo-width', isRoad ? 1.8 : 1.6);
      setPaintIfPossible(map, layer.id, 'text-halo-blur', 0.7);
      setPaintIfPossible(map, layer.id, 'text-opacity', isPoi ? 0.88 : 0.92);
      setPaintIfPossible(map, layer.id, 'icon-opacity', isPoi ? 0.86 : 0.72);
    }
  });
}

function ensureCityLabel(map: Map, city: City, style: AtlasMapStyle) {
  if (!map.getSource('current-city')) {
    map.addSource('current-city', citySource(city));
  }
  if (map.getLayer('current-city-name')) {
    return;
  }

  map.addLayer({
    id: 'current-city-name',
    type: 'symbol',
    source: 'current-city',
    minzoom: 8,
    maxzoom: 14.5,
    layout: {
      'text-field': ['concat', ['get', 'localName'], '  ', ['get', 'name']],
      'text-size': ['interpolate', ['linear'], ['zoom'], 8, 15, 13, 21],
      'text-letter-spacing': 0.04,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-offset': [0, -1.2],
    },
    paint: {
      'text-color': '#f2f8f6',
      'text-halo-color': style === 'dark-satellite' ? '#03090c' : '#06131d',
      'text-halo-width': 2.4,
      'text-halo-blur': 1,
    },
  });
}

function decorateLoadedStyle(map: Map, city: City, style: AtlasMapStyle) {
  if (mapTilerKey) {
    themeMapTilerStyle(map, style);
  }
  ensureCityLabel(map, city, style);
}

export function hasMapTilerBasemap() {
  return Boolean(mapTilerKey);
}

export function setAtlasMapStyle(map: Map, city: City, style: AtlasMapStyle) {
  mapContexts.set(map, { city, style });
  const hostedStyle = mapTilerStyleUrl(style);
  map.setStyle(hostedStyle ?? createAtlasStyle(city, style));
}

export function updateAtlasMapCity(map: Map, city: City) {
  const context = mapContexts.get(map);
  mapContexts.set(map, { city, style: context?.style ?? requestedStyle() });
  const source = map.getSource('current-city') as maplibregl.GeoJSONSource | undefined;
  source?.setData(citySource(city).data);
}

export function createAtlasMap(
  container: HTMLElement,
  city: City,
  style = requestedStyle(),
): Map {
  const hostedStyle = mapTilerStyleUrl(style);
  const map = new maplibregl.Map({
    container,
    center: city.center,
    zoom: city.zoom,
    pitch: 42,
    bearing: -12,
    attributionControl: false,
    style: hostedStyle ?? createAtlasStyle(city, style),
  });
  mapContexts.set(map, { city, style });

  map.on('style.load', () => {
    const context = mapContexts.get(map) ?? { city, style };
    decorateLoadedStyle(map, context.city, context.style);
  });

  map.on('error', (event) => {
    const message = event.error?.message ?? '';
    if (
      !mapTilerKey
      || mapTilerFallbacks.has(map)
      || !message.toLowerCase().includes('maptiler')
    ) {
      return;
    }

    mapTilerFallbacks.add(map);
    const context = mapContexts.get(map) ?? { city, style };
    map.setStyle(createAtlasStyle(context.city, context.style));
  });

  return map;
}
