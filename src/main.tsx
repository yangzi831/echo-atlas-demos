import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/global.css';
import './styles/memories-final.css';
import './styles/journey.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
