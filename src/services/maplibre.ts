import maplibregl, { type Map, type StyleSpecification } from 'maplibre-gl';
import type { City } from '../types/sound';

const darkAtlasStyle: StyleSpecification = {
  version: 8,
  sources: {
    dark: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#06131b' },
    },
    {
      id: 'dark-map',
      type: 'raster',
      source: 'dark',
      paint: {
        'raster-opacity': 0.94,
        'raster-saturation': -0.18,
        'raster-contrast': 0.06,
        'raster-brightness-min': 0.03,
        'raster-brightness-max': 0.82,
      },
    },
  ],
};

export function createAtlasMap(container: HTMLElement, city: City): Map {
  return new maplibregl.Map({
    container,
    center: city.center,
    zoom: city.zoom,
    pitch: 42,
    bearing: -12,
    attributionControl: false,
    style: darkAtlasStyle,
  });
}
