import { clamp01 } from '../seed'
import type { SoundFeatureFrame, SoundFeatureSummary } from '../types'
import { summarizeFrames } from '../imprint'

export interface OfflineAudioAnalysis {
  frames: SoundFeatureFrame[]
  summary: SoundFeatureSummary
  duration: number
}

const frequencies = [50, 80, 120, 180, 260, 380, 550, 800, 1150, 1650, 2400, 3500, 5000, 7200, 10000]

export function analyzeAudioBuffer(buffer: AudioBuffer, frameCount = 96): OfflineAudioAnalysis {
  const channel = buffer.getChannelData(0)
  const windowSize = Math.min(1024, channel.length)
  let previousRms = 0
  const frames = Array.from({ length: Math.max(8, Math.min(160, frameCount)) }, (_, frameIndex) => {
    const center = Math.round((frameIndex / Math.max(1, frameCount - 1)) * Math.max(0, channel.length - windowSize))
    let sumSquares = 0
    for (let sampleIndex = 0; sampleIndex < windowSize; sampleIndex += 1) {
      const sample = channel[center + sampleIndex] ?? 0
      sumSquares += sample * sample
    }
    const rms = clamp01(Math.sqrt(sumSquares / Math.max(1, windowSize)) * 3)
    const energies = frequencies.map((frequency) => {
      let real = 0
      let imaginary = 0
      const angular = (Math.PI * 2 * frequency) / buffer.sampleRate
      for (let sampleIndex = 0; sampleIndex < windowSize; sampleIndex += 1) {
        const sample = (channel[center + sampleIndex] ?? 0) * (0.5 - 0.5 * Math.cos((Math.PI * 2 * sampleIndex) / windowSize))
        real += sample * Math.cos(angular * sampleIndex)
        imaginary -= sample * Math.sin(angular * sampleIndex)
      }
      return Math.sqrt(real * real + imaginary * imaginary) / Math.max(1, windowSize)
    })
    const band = (minimum: number, maximum: number) => {
      const values = energies.filter((_, index) => frequencies[index] >= minimum && frequencies[index] < maximum)
      return clamp01(Math.sqrt(values.reduce((total, value) => total + value * value, 0) / Math.max(1, values.length)) * 10)
    }
    const spectralTotal = energies.reduce((total, energy) => total + energy, 0)
    const centroidHz = spectralTotal > 0
      ? energies.reduce((total, energy, index) => total + energy * frequencies[index], 0) / spectralTotal
      : 0
    const onset = clamp01(Math.max(0, rms - previousRms) * 7)
    previousRms = rms
    return {
      rms,
      low: band(35, 220),
      mid: band(220, 2400),
      high: band(2400, 12000),
      centroid: clamp01(centroidHz / 12000),
      onset,
      silent: rms < 0.018,
    }
  })
  return { frames, summary: summarizeFrames(frames), duration: buffer.duration }
}
