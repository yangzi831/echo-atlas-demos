import { clamp01, hashSeed, mulberry32, seededNoise } from './seed'
import type { EchoForm, SoundFeatureFrame, SoundFeatureSummary, SoundMemory } from './types'

const PALETTES = [
  ['#b9dfd0', '#f0bd78', '#d8f3ee'],
  ['#9bb8e7', '#df9fb4', '#e9e0c8'],
  ['#a8c48c', '#e6d6a4', '#d2efe1'],
  ['#c1afd9', '#8dc6c4', '#f1c58d'],
] as const

const FALLBACK: SoundFeatureSummary = {
  rms: 0.32,
  low: 0.38,
  mid: 0.48,
  high: 0.3,
  centroid: 0.42,
  rhythmDensity: 0.28,
  silenceRatio: 0.12,
}

const average = (frames: readonly SoundFeatureFrame[], key: keyof SoundFeatureFrame) =>
  frames.reduce((total, frame) => total + Number(frame[key] || 0), 0) / Math.max(1, frames.length)

export function summarizeFrames(frames: readonly SoundFeatureFrame[]): SoundFeatureSummary {
  return {
    rms: clamp01(average(frames, 'rms')),
    low: clamp01(average(frames, 'low')),
    mid: clamp01(average(frames, 'mid')),
    high: clamp01(average(frames, 'high')),
    centroid: clamp01(average(frames, 'centroid')),
    rhythmDensity: clamp01(average(frames, 'onset') * 1.8),
    silenceRatio: frames.filter((frame) => frame.silent || frame.rms < 0.018).length / Math.max(1, frames.length),
  }
}

function resolveSummary(memory: SoundMemory, frames: readonly SoundFeatureFrame[]): SoundFeatureSummary {
  const measured = frames.length ? summarizeFrames(frames) : FALLBACK
  const stored = memory.visualImprint?.summary ?? {}
  const supplied = memory.soundFeatures ?? {}
  const value = (key: keyof SoundFeatureSummary) => clamp01(supplied[key] ?? stored[key] ?? measured[key])
  return {
    rms: value('rms'),
    low: value('low'),
    mid: value('mid'),
    high: value('high'),
    centroid: value('centroid'),
    rhythmDensity: value('rhythmDensity'),
    silenceRatio: value('silenceRatio'),
  }
}

function generatedFrame(summary: SoundFeatureSummary, seed: number, index: number, count: number): SoundFeatureFrame {
  const phase = index / Math.max(1, count - 1)
  const envelope = Math.pow(Math.sin(Math.PI * phase), 0.22)
  const slow = Math.sin(phase * Math.PI * (2.2 + summary.rhythmDensity * 5) + seed * 0.0001)
  const texture = seededNoise(seed, index) * 0.16 + seededNoise(seed ^ 0xa53a, Math.floor(index / 3)) * 0.13
  const silenceGate = seededNoise(seed ^ 0x71, Math.floor(index / 5)) > 1 - summary.silenceRatio * 2
  const rms = clamp01((summary.rms * (0.72 + slow * 0.24 + texture)) * envelope * (silenceGate ? 0.12 : 1))
  const onsetStep = Math.max(3, Math.round(13 - summary.rhythmDensity * 9))
  const onset = index % onsetStep === hashSeed(seed + onsetStep) % onsetStep ? 0.45 + summary.rhythmDensity * 0.55 : 0
  return {
    rms,
    low: clamp01(summary.low + seededNoise(seed ^ 0x12, index) * 0.12),
    mid: clamp01(summary.mid + seededNoise(seed ^ 0x34, index) * 0.1),
    high: clamp01(summary.high + seededNoise(seed ^ 0x56, index) * 0.16),
    centroid: clamp01(summary.centroid + texture * 0.3),
    onset,
    silent: silenceGate,
  }
}

export function createVisualImprint(memory: SoundMemory): EchoForm {
  const seed = hashSeed(memory.visualImprint?.seed ?? memory.seed ?? memory.id)
  const sourceFrames = memory.visualImprint?.frames?.filter((frame) => Number.isFinite(frame.rms)) ?? []
  const summary = resolveSummary(memory, sourceFrames)
  const count = Math.max(56, Math.min(128, sourceFrames.length || Math.round(68 + (memory.duration ?? 30) * 0.7)))
  const random = mulberry32(seed)
  const frames = Array.from({ length: count }, (_, index) => {
    if (!sourceFrames.length) return generatedFrame(summary, seed, index, count)
    const sourceIndex = Math.round((index / Math.max(1, count - 1)) * (sourceFrames.length - 1))
    return sourceFrames[sourceIndex]
  })
  let drift = (random() - 0.5) * 0.1
  const points = frames.map((frame, index) => {
    const x = index / Math.max(1, count - 1)
    const local = frame.silent ? 0.12 : 1
    const harmonic = Math.sin(x * Math.PI * (2 + summary.low * 3) + seed * 0.00007) * summary.low * 0.25
    const fine = Math.sin(x * Math.PI * (7 + summary.centroid * 11) + seed * 0.00013) * frame.high * 0.1
    drift = drift * 0.88 + seededNoise(seed, index) * (0.018 + frame.mid * 0.018)
    const y = (harmonic + fine + drift) * local
    return {
      ...frame,
      x,
      y,
      width: 0.012 + frame.rms * 0.09 + frame.low * 0.018,
      branch: clamp01(frame.onset * 0.85 + frame.high * 0.22),
    }
  })
  const palette = memory.visualImprint?.palette ?? PALETTES[seed % PALETTES.length]
  return {
    memoryId: memory.id,
    seed,
    duration: memory.duration ?? 0,
    palette,
    summary,
    points,
  }
}

export function echoFormPath(form: EchoForm, width = 640, height = 240, inset = 30) {
  const scaleX = width - inset * 2
  const scaleY = height * 0.74
  return form.points.map((point, index) => {
    const x = inset + point.x * scaleX
    const y = height / 2 + point.y * scaleY
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}
