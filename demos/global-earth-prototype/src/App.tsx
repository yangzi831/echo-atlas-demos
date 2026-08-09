import { useState } from 'react';
import { cities, type City } from './cities';
import { ParticleEarth } from './ParticleEarth';

export function App() {
  const [selectedCity, setSelectedCity] = useState<City>();

  return (
    <main className="prototype-shell">
      <ParticleEarth
        cities={cities}
        selectedCity={selectedCity}
        onSelectCity={setSelectedCity}
      />

      <header className="prototype-header">
        <p className="prototype-kicker">Echo Atlas / Earth 01</p>
        <h1>Global Listening Field</h1>
        <p className="prototype-subtitle">城市声音记忆的全球入口</p>
      </header>

      <footer className="prototype-footer">
        <div>
          <span>ACTIVE CITIES</span>
          <strong>{String(cities.length).padStart(2, '0')}</strong>
        </div>
        <div>
          <span>MEMORY SIGNALS</span>
          <strong>{cities.reduce((sum, city) => sum + city.echoes, 0)}</strong>
        </div>
        <div className="selected-readout">
          <span>CURRENT SIGNAL</span>
          <strong>{selectedCity?.name ?? 'GLOBAL'}</strong>
        </div>
      </footer>
    </main>
  );
}
