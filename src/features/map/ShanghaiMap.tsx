import { useEffect, useMemo, useRef, useState } from 'react';
import { createAtlasAmap } from '../../services/amap';
import type { City, SoundNode } from '../../types/sound';

type ShanghaiMapProps = {
  city: City;
  nodes: SoundNode[];
  selectedNodeId?: string;
  highlightedNodeIds: string[];
  onSelectNode: (node: SoundNode) => void;
};

export function ShanghaiMap({
  city,
  nodes,
  selectedNodeId,
  highlightedNodeIds,
  onSelectNode,
}: ShanghaiMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapState, setMapState] = useState<'fallback' | 'loading' | 'ready'>(
    import.meta.env.VITE_AMAP_KEY ? 'loading' : 'fallback',
  );
  const highlighted = useMemo(
    () => new Set(highlightedNodeIds),
    [highlightedNodeIds],
  );

  useEffect(() => {
    const key = import.meta.env.VITE_AMAP_KEY;
    if (!key || !mapRef.current) {
      setMapState('fallback');
      return;
    }

    let disposed = false;
    let amap: { destroy: () => void } | undefined;

    setMapState('loading');
    createAtlasAmap(key, mapRef.current, city)
      .then((instance) => {
        if (disposed) {
          instance.destroy();
          return;
        }
        amap = instance;
        setMapState('ready');
      })
      .catch(() => {
        if (!disposed) {
          setMapState('fallback');
        }
      });

    return () => {
      disposed = true;
      amap?.destroy();
    };
  }, [city]);

  return (
    <section className="map-stage" aria-label={`${city.localName}声音记忆地图`}>
      <div
        ref={mapRef}
        className={`amap-layer ${mapState === 'ready' ? 'is-ready' : ''}`}
        aria-hidden={mapState !== 'ready'}
      />

      {mapState !== 'ready' && <AtlasMapFallback />}

      <div className="map-vignette" aria-hidden="true" />
      <div className="node-layer">
        {nodes.map((node) => {
          const size = 18 + node.density * 26;
          const isHighlighted = highlighted.has(node.id);
          const isSelected = selectedNodeId === node.id;

          return (
            <button
              key={node.id}
              className={`sound-node ${isHighlighted ? 'is-highlighted' : ''} ${
                isSelected ? 'is-selected' : ''
              }`}
              type="button"
              style={{
                left: `${node.mapPosition.x}%`,
                top: `${node.mapPosition.y}%`,
                width: `${size}px`,
                height: `${size}px`,
              }}
              onClick={() => onSelectNode(node)}
              aria-label={`${node.title}, ${node.location}`}
            >
              <span className="node-core" />
              <span className="node-tooltip">
                <strong>{node.location}</strong>
                <span>{node.recordedAt}</span>
                <em>{node.tags.join(' · ')}</em>
              </span>
            </button>
          );
        })}
      </div>

      <div className="map-caption">
        <span>{mapState === 'ready' ? 'AMap JS API 2.0' : 'Fallback Atlas'}</span>
        <span>{city.name} · {city.country}</span>
        <span>{nodes.length} active echoes</span>
      </div>
    </section>
  );
}

function AtlasMapFallback() {
  return (
    <div className="fallback-map" aria-hidden="true">
      <svg viewBox="0 0 1200 760" role="img">
        <defs>
          <filter id="softBlur">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <linearGradient id="riverTone" x1="0%" x2="100%" y1="40%" y2="60%">
            <stop offset="0%" stopColor="#617487" stopOpacity="0.34" />
            <stop offset="52%" stopColor="#d8dfdf" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#7b7465" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <path
          className="city-outline"
          d="M165 410 C195 250 315 165 500 140 C700 112 912 154 1028 296 C1104 388 1087 525 956 604 C796 700 566 686 360 632 C238 600 146 526 165 410 Z"
        />
        <path
          className="river"
          d="M40 398 C180 354 244 430 360 395 C494 355 540 255 690 278 C818 298 885 398 1158 330"
        />
        <path
          className="river branch"
          d="M332 396 C400 446 472 479 590 462 C690 448 760 520 875 544"
        />
        <g className="roads">
          <path d="M190 250 C372 332 560 368 1024 214" />
          <path d="M146 540 C330 506 490 514 650 430 C804 350 910 345 1088 416" />
          <path d="M260 160 C298 268 338 390 382 654" />
          <path d="M486 130 C506 310 522 466 552 690" />
          <path d="M708 136 C688 252 705 420 792 646" />
          <path d="M930 216 C848 312 820 450 836 640" />
          <path d="M238 622 C410 565 610 604 1002 570" />
        </g>
        <g className="district-lines">
          <path d="M328 282 C398 236 512 240 600 300 C688 360 752 350 846 296" />
          <path d="M300 470 C425 422 562 434 690 488 C765 520 846 505 940 468" />
          <path d="M602 190 C640 310 628 450 604 610" />
        </g>
        <g className="fog" filter="url(#softBlur)">
          <ellipse cx="325" cy="286" rx="170" ry="60" />
          <ellipse cx="790" cy="366" rx="240" ry="82" />
          <ellipse cx="570" cy="602" rx="290" ry="70" />
        </g>
      </svg>
      <div className="scanline" />
    </div>
  );
}
