import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './scenes.css'
import './styles.css'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
