import type { AtlasMode, City } from '../types/sound';

type TopBarProps = {
  city: City;
  timeLabel: string;
  onToggleAgent: () => void;
  onOpenUpload: () => void;
  onToggleLibrary: () => void;
  onToggleMode: () => void;
  isAgentOpen: boolean;
  isModeOpen: boolean;
  isLibraryOpen: boolean;
  atlasMode: AtlasMode;
  onChangeAtlasMode: (mode: AtlasMode) => void;
};

export function TopBar({
  city,
  timeLabel,
  onToggleAgent,
  onOpenUpload,
  onToggleLibrary,
  onToggleMode,
  isAgentOpen,
  isModeOpen,
  isLibraryOpen,
  atlasMode,
  onChangeAtlasMode,
}: TopBarProps) {
  const placeLabel = city.name === city.localName
    ? city.name
    : `${city.name} · ${city.localName}`;

  return (
    <header className="top-bar" aria-label="Echo Atlas controls">
      <div className="brand-lockup">
        <span className="brand-title">Echo Atlas</span>
        <span className="brand-subtitle">声音记忆档案</span>
        <span className="brand-meta">
          {placeLabel} · {timeLabel}
        </span>
      </div>

      <nav className="atlas-primary-nav" aria-label="Echo Atlas modes">
        <button type="button" aria-current={atlasMode === 'my-atlas' ? 'page' : undefined} onClick={() => onChangeAtlasMode('my-atlas')}>My Atlas</button>
        <button type="button" aria-current={atlasMode === 'explore' ? 'page' : undefined} onClick={() => onChangeAtlasMode('explore')}>Explore</button>
        <button type="button" aria-current={atlasMode === 'following' ? 'page' : undefined} onClick={() => onChangeAtlasMode('following')}>Following</button>
        <button type="button" aria-current={atlasMode === 'recall' ? 'page' : undefined} onClick={() => onChangeAtlasMode('recall')}>Recall</button>
      </nav>

      <nav className="top-actions" aria-label="map actions">
        <button
          className="ghost-action"
          type="button"
          aria-expanded={isModeOpen}
          onClick={onToggleMode}
        >
          推荐地点
        </button>
        <button className="ghost-action" type="button" onClick={onOpenUpload}>
          记录这里
        </button>
        {atlasMode === 'my-atlas' && <button className="ghost-action" type="button" aria-expanded={isLibraryOpen} onClick={onToggleLibrary}>List</button>}
        <button
          className="warm-action"
          type="button"
          aria-expanded={isAgentOpen}
          onClick={onToggleAgent}
        >
          想听什么？
        </button>
      </nav>
    </header>
  );
}
