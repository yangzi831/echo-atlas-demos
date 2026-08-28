import type { SoundFeatureFrame, SoundMemory } from './visual-engine'

type Texture = 'transit' | 'rain' | 'wind' | 'shop'

const makeFrames = (texture: Texture, count = 88): SoundFeatureFrame[] => Array.from({ length: count }, (_, index) => {
  const phase = index / (count - 1)
  const base = Math.sin(Math.PI * phase) ** 0.2
  if (texture === 'transit') {
    const arrival = 0.35 + Math.sin(phase * Math.PI * 3.4) * 0.2
    const onset = index % 13 === 2 ? 0.82 : 0
    return { rms: base * arrival, low: 0.76, mid: 0.44, high: 0.18, centroid: 0.24, onset, silent: false }
  }
  if (texture === 'rain') {
    const onset = index % 7 === 1 || index % 11 === 4 ? 0.58 : 0
    return { rms: base * (0.24 + Math.sin(index * 2.7) * 0.05), low: 0.16, mid: 0.48, high: 0.78, centroid: 0.72, onset, silent: false }
  }
  if (texture === 'wind') {
    const lull = index > 34 && index < 45
    return { rms: base * (lull ? 0.035 : 0.28 + Math.sin(phase * 17) * 0.12), low: 0.56, mid: 0.4, high: 0.3, centroid: 0.34, onset: index % 19 === 6 ? 0.32 : 0, silent: lull }
  }
  const onset = index % 16 === 4 || index % 16 === 8 ? 0.74 : 0
  return { rms: base * (0.31 + onset * 0.14), low: 0.34, mid: 0.7, high: 0.44, centroid: 0.5, onset, silent: false }
})

export const DEMO_MEMORIES: SoundMemory[] = [
  {
    id: 'berlin-u8',
    title: 'U8 beneath Kottbusser Tor',
    audio: '/audio/u-bahn.wav',
    location: { name: 'Kottbusser Tor, Berlin', latitude: 52.499, longitude: 13.419 },
    recordedAt: '2025-01-18T18:42:00+01:00',
    duration: 12,
    tags: ['u-bahn', 'platform', 'winter'],
    moods: ['metallic', 'subterranean'],
    seed: 'berlin-u8-2025-01-18',
    visualImprint: { version: 1, frames: makeFrames('transit') },
  },
  {
    id: 'kreuzberg-rain',
    title: 'Rain on Oranienstraße',
    audio: '/audio/rain.wav',
    location: { name: 'Oranienstraße, Berlin', latitude: 52.501, longitude: 13.416 },
    recordedAt: '2025-01-18T20:06:00+01:00',
    duration: 12,
    tags: ['rain', 'street', 'night'],
    moods: ['silver', 'restless'],
    seed: 'oranien-rain-2006',
    visualImprint: { version: 1, frames: makeFrames('rain') },
  },
  {
    id: 'tempelhof-wind',
    title: 'Wind across Tempelhof',
    audio: '/audio/wind.wav',
    location: { name: 'Tempelhofer Feld, Berlin', latitude: 52.474, longitude: 13.404 },
    recordedAt: '2025-01-19T15:18:00+01:00',
    duration: 12,
    tags: ['wind', 'field', 'distance'],
    moods: ['open', 'cold'],
    seed: 'tempelhof-west-wind',
    visualImprint: { version: 1, frames: makeFrames('wind') },
  },
  {
    id: 'spati-evening',
    title: 'Späti at closing time',
    audio: '/audio/spati.wav',
    location: { name: 'Weserstraße, Berlin', latitude: 52.484, longitude: 13.435 },
    recordedAt: '2025-01-19T23:47:00+01:00',
    duration: 12,
    tags: ['voices', 'fridge', 'bottles'],
    moods: ['warm', 'near'],
    seed: 'weser-spati-2347',
    visualImprint: { version: 1, frames: makeFrames('shop') },
  },
]
