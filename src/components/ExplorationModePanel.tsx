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
    <aside className="mode-panel" aria-label="城市选择">
      <p className="panel-kicker">Suggested places</p>
      <p className="suggested-places-copy">or search any city, street, or place</p>
      <div className="city-selector" aria-label="选择城市">
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
    </aside>
  );
}
