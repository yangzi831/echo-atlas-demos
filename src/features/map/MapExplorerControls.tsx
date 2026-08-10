import { useEffect, useRef, useState } from 'react';
import type { AtlasMapStyle } from '../../services/maplibre';
import {
  canSearchMapTiler,
  searchMockPlaces,
  searchMapTilerPlaces,
  type GeocodingResult,
} from '../../services/maptiler';

type MapExplorerControlsProps = {
  mapStyle: AtlasMapStyle;
  cityCenter: [number, number];
  mockPlaces: GeocodingResult[];
  locating: boolean;
  locationMessage?: string;
  onChangeStyle: (style: AtlasMapStyle) => void;
  onLocate: () => void;
  onSelectPlace: (result: GeocodingResult) => void;
};

export function MapExplorerControls({
  mapStyle,
  cityCenter,
  mockPlaces,
  locating,
  locationMessage,
  onChangeStyle,
  onLocate,
  onSelectPlace,
}: MapExplorerControlsProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const suppressedQueryRef = useRef('');
  const searchAvailable = canSearchMapTiler();

  useEffect(() => {
    const normalizedQuery = query.trim();
    abortRef.current?.abort();

    if (normalizedQuery === suppressedQueryRef.current) {
      setResults([]);
      setSearchState('idle');
      return;
    }

    if (normalizedQuery.length < 2) {
      setResults([]);
      setSearchState('idle');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(async () => {
      setSearchState('loading');
      try {
        const nextResults = searchAvailable
          ? await searchMapTilerPlaces(normalizedQuery, cityCenter, controller.signal)
          : searchMockPlaces(normalizedQuery, mockPlaces);
        setResults(nextResults);
        setSearchState('idle');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          const fallbackResults = searchMockPlaces(normalizedQuery, mockPlaces);
          setResults(fallbackResults);
          setSearchState(fallbackResults.length > 0 ? 'idle' : 'error');
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cityCenter, mockPlaces, query, searchAvailable]);

  const handleSelectResult = (result: GeocodingResult) => {
    suppressedQueryRef.current = result.name;
    setQuery(result.name);
    setResults([]);
    onSelectPlace(result);
  };

  return (
    <div className="map-explorer-controls">
      <div className="map-mode-switch" aria-label="地图模式">
        <button
          type="button"
          aria-pressed={mapStyle === 'deep-blue'}
          onClick={() => onChangeStyle('deep-blue')}
        >
          Deep blue
        </button>
        <button
          type="button"
          aria-pressed={mapStyle === 'dark-satellite'}
          onClick={() => onChangeStyle('dark-satellite')}
        >
          Satellite
        </button>
      </div>

      <div className="map-search-shell">
        <span className="map-search-icon" aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="搜索城市、街道或地点"
          aria-label="搜索城市、街道或地点"
          onChange={(event) => {
            suppressedQueryRef.current = '';
            setQuery(event.target.value);
          }}
        />
        {searchState === 'loading' && <span className="map-search-status">搜索中</span>}

        {(results.length > 0 || searchState === 'error') && (
          <div className="map-search-results" role="listbox">
            {searchState === 'error' ? (
              <p>暂时无法搜索地点</p>
            ) : results.map((result) => (
              <button
                key={result.id}
                type="button"
                role="option"
                onClick={() => handleSelectResult(result)}
              >
                <strong>{result.name}</strong>
                <span>{result.context}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className="map-location-button"
        type="button"
        title="定位到我的位置"
        aria-label="定位到我的位置"
        aria-busy={locating}
        onClick={onLocate}
      >
        <span aria-hidden="true" />
      </button>

      {locationMessage && <div className="map-location-message">{locationMessage}</div>}
    </div>
  );
}
