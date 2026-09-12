import type { AtlasMode, City, ProductMode } from '../types/sound';

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
  productMode: ProductMode;
  onChangeProductMode: (mode: ProductMode) => void;
  showAtlasActions?: boolean;
  showBrand?: boolean;
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
  productMode,
  onChangeProductMode,
  showAtlasActions = true,
  showBrand = true,
}: TopBarProps) {
  const placeLabel = city.name === city.localName
    ? city.name
    : `${city.name} · ${city.localName}`;

  return (
    <header className={`top-bar ambient-top-bar ${showAtlasActions ? 'has-atlas-actions' : ''}`} aria-label="Echo Atlas controls">
      {showBrand && <div className="brand-lockup">
        <span className="brand-title">Echo Atlas</span>
        <span className="brand-subtitle">声音记忆档案</span>
        <span className="brand-meta">
          {placeLabel} · {timeLabel}
        </span>
      </div>}

      <nav className="atlas-primary-nav" aria-label="Echo Atlas modes">
        <button type="button" aria-current={productMode === 'listen' ? 'page' : undefined} onClick={() => onChangeProductMode('listen')}>LISTEN</button>
        <button type="button" aria-current={productMode === 'memories' ? 'page' : undefined} onClick={() => onChangeProductMode('memories')}>MEMORIES</button>
        <button type="button" aria-current={productMode === 'atlas' ? 'page' : undefined} onClick={() => onChangeProductMode('atlas')}>ATLAS</button>
      </nav>

      {showAtlasActions && <nav className="top-actions" aria-label="map actions">
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
        </nav>}
    </header>
  );
}
