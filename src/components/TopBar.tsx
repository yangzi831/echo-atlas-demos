import type { City } from '../types/sound';

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
}: TopBarProps) {
  const placeLabel = city.name === city.localName
    ? city.name
    : `${city.name} · ${city.localName}`;

  return (
    <header className="top-bar" aria-label="Echo Atlas controls">
      <div className="brand-lockup">
        <span className="brand-title">Echo Atlas</span>
        <span className="brand-subtitle">城市回声档案</span>
        <span className="brand-meta">
          {placeLabel} · {timeLabel}
        </span>
      </div>

      <nav className="top-actions" aria-label="primary actions">
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
        <button
          className="ghost-action"
          type="button"
          aria-expanded={isLibraryOpen}
          onClick={onToggleLibrary}
        >
          My Sounds
        </button>
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
