import type { City } from '../types/sound';

type AMapInstance = {
  destroy: () => void;
};

export async function createAtlasAmap(
  key: string,
  container: HTMLElement,
  city: City,
): Promise<AMapInstance> {
  const { default: AMapLoader } = await import('@amap/amap-jsapi-loader');
  const AMap = await AMapLoader.load({
    key,
    version: '2.0',
    plugins: ['AMap.Scale', 'AMap.ToolBar'],
  });

  return new AMap.Map(container, {
    center: city.center,
    zoom: city.zoom,
    viewMode: '2D',
    mapStyle: 'amap://styles/darkblue',
    showLabel: false,
  }) as AMapInstance;
}
