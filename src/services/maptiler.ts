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

export const fallbackSearchPlaces: GeocodingResult[] = [
  { id: 'mock-paris', name: 'Paris', context: 'Paris · France', center: [2.3522, 48.8566], placeType: 'place' },
  { id: 'mock-tokyo', name: 'Tokyo', context: 'Tokyo · Japan', center: [139.6917, 35.6895], placeType: 'place' },
  { id: 'mock-lisbon', name: 'Lisbon', context: 'Lisbon · Portugal', center: [-9.1393, 38.7223], placeType: 'place' },
  { id: 'mock-shibuya', name: 'Shibuya Crossing', context: 'Shibuya · Tokyo · Japan', center: [139.7006, 35.6595], placeType: 'poi' },
  { id: 'mock-marina-bay', name: 'Marina Bay', context: 'Downtown Core · Singapore', center: [103.8585, 1.2834], placeType: 'poi' },
  { id: 'mock-brandenburg-gate', name: 'Brandenburg Gate', context: 'Mitte · Berlin · Germany', center: [13.3777, 52.5163], placeType: 'poi' },
];

export function canSearchMapTiler() {
  return Boolean(mapTilerKey);
}

export function searchMockPlaces(
  query: string,
  places: GeocodingResult[],
) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return [];
  }

  return places
    .filter((place) => `${place.name} ${place.context}`.toLocaleLowerCase().includes(normalized))
    .slice(0, 6);
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
