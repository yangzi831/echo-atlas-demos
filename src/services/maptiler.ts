export type GeocodingResult = {
  id: string;
  name: string;
  context: string;
  center: [number, number];
  placeType: string;
};

type MapTilerFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  place_type?: string[];
};

const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY?.trim();

export function canSearchMapTiler() {
  return Boolean(mapTilerKey);
}

export async function searchMapTilerPlaces(
  query: string,
  proximity: [number, number],
  signal?: AbortSignal,
): Promise<GeocodingResult[]> {
  if (!mapTilerKey || !query.trim()) {
    return [];
  }

  const params = new URLSearchParams({
    key: mapTilerKey,
    limit: '6',
    language: 'zh,en',
    proximity: proximity.join(','),
  });
  const response = await fetch(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query.trim())}.json?${params}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(`MapTiler geocoding failed with ${response.status}`);
  }

  const payload = await response.json() as { features?: MapTilerFeature[] };
  return (payload.features ?? []).flatMap((feature, index) => {
    if (!feature.center) {
      return [];
    }

    const name = feature.text ?? feature.place_name ?? '未命名地点';
    return [{
      id: feature.id ?? `${name}-${index}`,
      name,
      context: feature.place_name ?? name,
      center: feature.center,
      placeType: feature.place_type?.[0] ?? 'place',
    }];
  });
}
