import type { City, TimePeriod } from '../types/sound';

type TopBarProps = {
  city: City;
  selectedPeriod: TimePeriod;
  onToggleAgent: () => void;
  onOpenUpload: () => void;
  onToggleMode: () => void;
  isAgentOpen: boolean;
  isModeOpen: boolean;
};

export function TopBar({
  city,
  selectedPeriod,
  onToggleAgent,
  onOpenUpload,
  onToggleMode,
  isAgentOpen,
  isModeOpen,
}: TopBarProps) {
  return (
    <header className="top-bar" aria-label="Echo Atlas controls">
      <div className="brand-lockup">
        <span className="brand-title">Echo Atlas</span>
        <span className="brand-subtitle">城市回声档案</span>
        <span className="brand-meta">
          {city.name} · {city.localName} · {selectedPeriod}
        </span>
      </div>

      <nav className="top-actions" aria-label="primary actions">
        <button
          className="ghost-action"
          type="button"
          aria-expanded={isModeOpen}
          onClick={onToggleMode}
        >
          探索方式
        </button>
        <button className="ghost-action" type="button" onClick={onOpenUpload}>
          上传声音
        </button>
        <button
          className="warm-action"
          type="button"
          aria-expanded={isAgentOpen}
          onClick={onToggleAgent}
        >
          Echo Agent
        </button>
      </nav>
    </header>
  );
}
