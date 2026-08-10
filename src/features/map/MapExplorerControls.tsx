import { useEffect, useRef, useState } from 'react';
import type { AtlasMapStyle } from '../../services/maplibre';
import {
  canSearchMapTiler,
  searchMapTilerPlaces,
  type GeocodingResult,
} from '../../services/maptiler';

type MapExplorerControlsProps = {
  mapStyle: AtlasMapStyle;
  cityCenter: [number, number];
  locating: boolean;
  locationMessage?: string;
  onChangeStyle: (style: AtlasMapStyle) => void;
  onLocate: () => void;
  onSelectPlace: (result: GeocodingResult) => void;
};

export function MapExplorerControls({
  mapStyle,
  cityCenter,
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
  const searchAvailable = canSearchMapTiler();

  useEffect(() => {
    const normalizedQuery = query.trim();
    abortRef.current?.abort();

    if (!searchAvailable || normalizedQuery.length < 2) {
      setResults([]);
      setSearchState('idle');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(async () => {
      setSearchState('loading');
      try {
        const nextResults = await searchMapTilerPlaces(
          normalizedQuery,
          cityCenter,
          controller.signal,
        );
        setResults(nextResults);
        setSearchState('idle');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setSearchState('error');
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cityCenter, query, searchAvailable]);

  const handleSelectResult = (result: GeocodingResult) => {
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
          placeholder={searchAvailable ? '搜索街道、地铁站或地点' : '配置 MapTiler Key 后可搜索'}
          aria-label="搜索地图地点"
          disabled={!searchAvailable}
          onChange={(event) => setQuery(event.target.value)}
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
