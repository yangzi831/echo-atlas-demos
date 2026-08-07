import type { City } from '../types/sound';

type ExplorationModePanelProps = {
  isOpen: boolean;
  cities: City[];
  currentCityId: string;
  onSelectCity: (cityId: string) => void;
};

export function ExplorationModePanel({
  isOpen,
  cities,
  currentCityId,
  onSelectCity,
}: ExplorationModePanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="mode-panel" aria-label="探索方式">
      <p className="panel-kicker">Listening modes</p>
      <div className="city-selector" aria-label="选择城市">
        <span className="city-selector-label">城市档案</span>
        <div className="city-options">
          {cities.map((city) => (
            <button
              key={city.id}
              type="button"
              className={`city-choice ${currentCityId === city.id ? 'is-active' : ''}`}
              aria-pressed={currentCityId === city.id}
              onClick={() => onSelectCity(city.id)}
            >
              <strong>{city.localName}</strong>
              <small>{city.name}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="mode-option is-active">
        <span>地点漫游</span>
        <small>沿河流、街区和换乘空间自由移动。</small>
      </div>
      <div className="mode-option">
        <span>时间叠听</span>
        <small>比较同一片城市在不同年代的声场。</small>
      </div>
      <div className="mode-option">
        <span>情绪采样</span>
        <small>从安静、潮湿、热闹等感受进入地图。</small>
      </div>
    </aside>
  );
}
