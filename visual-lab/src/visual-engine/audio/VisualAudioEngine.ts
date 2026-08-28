import { clamp01 } from '../seed'
import type { AudioAnalysis, AudioAnalysisSnapshot, SoundMemory, VisualSession } from '../types'

type Listener = (snapshot: AudioAnalysisSnapshot) => void

const EMPTY_ANALYSIS: AudioAnalysis = {
  rms: 0,
  loudness: 0,
  lowEnergy: 0,
  midEnergy: 0,
  highEnergy: 0,
  spectralCentroid: 0,
  transient: 0,
  onset: 0,
  rhythmDensity: 0,
  pulse: 0,
  progress: 0,
  silent: true,
}

interface Track {
  memory: SoundMemory
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode | null
  analyser: AnalyserNode | null
  gain: GainNode | null
  frequency: Uint8Array<ArrayBuffer> | null
  time: Uint8Array<ArrayBuffer> | null
  previousFrequency: Uint8Array<ArrayBuffer> | null
  previousRms: number
  pulse: number
  analysis: AudioAnalysis
  onsetTimes: number[]
}

const smooth = (current: number, target: number, attack = 0.32, release = 0.08) =>
  current + (target - current) * (target > current ? attack : release)

export class VisualAudioEngine {
  private context: AudioContext | null = null
  private masterAnalyser: AnalyserNode | null = null
  private masterFrequency: Uint8Array<ArrayBuffer> | null = null
  private masterTime: Uint8Array<ArrayBuffer> | null = null
  private masterPreviousFrequency: Uint8Array<ArrayBuffer> | null = null
  private masterPreviousRms = 0
  private masterPulse = 0
  private masterOnsetTimes: number[] = []
  private tracks = new Map<string, Track>()
  private listeners = new Set<Listener>()
  private rafId = 0
  private mode: VisualSession['mode'] = 'single'
  private activeMemoryId: string | undefined
  private disposed = false
  private snapshot: AudioAnalysisSnapshot = {
    byMemory: {},
    master: { ...EMPTY_ANALYSIS },
    playing: false,
    playableMemoryIds: [],
    error: null,
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  setSession(session: VisualSession) {
    this.disposed = false
    this.mode = session.mode
    this.activeMemoryId = session.activeMemoryId ?? session.memories[0]?.id
    const nextIds = new Set(session.memories.map((memory) => memory.id))
    for (const [id, track] of this.tracks) {
      if (!nextIds.has(id)) this.removeTrack(id, track)
    }
    for (const memory of session.memories) {
      const current = this.tracks.get(memory.id)
      if (!current) this.tracks.set(memory.id, this.createTrack(memory))
      else if (current.memory.audio !== memory.audio) {
        this.removeTrack(memory.id, current)
        this.tracks.set(memory.id, this.createTrack(memory))
      } else current.memory = memory
    }
    if (this.mode === 'single') {
      this.tracks.forEach((track, id) => {
        if (id !== this.activeMemoryId) track.element.pause()
      })
    }
    this.updateMix()
    this.publish()
  }

  setActiveMemory(memoryId: string) {
    this.activeMemoryId = memoryId
    this.updateMix()
  }

  async play() {
    const playable = [...this.tracks.values()].filter((track) => Boolean(track.memory.audio))
    if (!playable.length) {
      this.patch({ error: 'This session has no playable audio URL.' })
      return
    }
    await this.ensureGraph()
    if (this.context?.state === 'suspended') await this.context.resume()
    this.updateMix()
    const targets = this.mode === 'single'
      ? playable.filter((track) => track.memory.id === this.activeMemoryId).slice(0, 1)
      : playable
    const failures: string[] = []
    await Promise.all(targets.map(async (track) => {
      try {
        await track.element.play()
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `Unable to play ${track.memory.id}`)
      }
    }))
    this.patch({ playing: targets.some((track) => !track.element.paused), error: failures[0] ?? null })
  }

  pause() {
    this.tracks.forEach((track) => track.element.pause())
    this.patch({ playing: false })
  }

  async toggle() {
    if (this.snapshot.playing) this.pause()
    else await this.play()
  }

  seek(progress: number, memoryId?: string) {
    const target = clamp01(progress)
    this.tracks.forEach((track, id) => {
      if (memoryId && id !== memoryId) return
      const duration = Number.isFinite(track.element.duration) ? track.element.duration : track.memory.duration ?? 0
      if (duration > 0) track.element.currentTime = target * duration
    })
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.tracks.forEach((track, id) => this.removeTrack(id, track))
    this.tracks.clear()
    this.masterAnalyser?.disconnect()
    void this.context?.close()
    this.context = null
    this.listeners.clear()
  }

  private createTrack(memory: SoundMemory): Track {
    const element = new Audio()
    element.preload = 'metadata'
    element.crossOrigin = 'anonymous'
    element.loop = this.mode === 'soundscape'
    if (memory.audio) element.src = memory.audio
    element.onended = () => {
      if ([...this.tracks.values()].every((track) => track.element.paused)) this.patch({ playing: false })
    }
    element.onerror = () => this.patch({ error: `Unable to load audio for ${memory.title ?? memory.id}. Check the URL and CORS headers.` })
    return {
      memory,
      element,
      source: null,
      analyser: null,
      gain: null,
      frequency: null,
      time: null,
      previousFrequency: null,
      previousRms: 0,
      pulse: 0,
      analysis: { ...EMPTY_ANALYSIS },
      onsetTimes: [],
    }
  }

  private removeTrack(id: string, track: Track) {
    track.element.pause()
    track.element.onended = null
    track.element.onerror = null
    track.element.removeAttribute('src')
    track.element.load()
    track.source?.disconnect()
    track.analyser?.disconnect()
    track.gain?.disconnect()
    this.tracks.delete(id)
  }

  private async ensureGraph() {
    if (!this.context) {
      this.context = new AudioContext()
      this.masterAnalyser = this.context.createAnalyser()
      this.masterAnalyser.fftSize = 1024
      this.masterAnalyser.smoothingTimeConstant = 0
      this.masterAnalyser.connect(this.context.destination)
      this.masterFrequency = new Uint8Array(this.masterAnalyser.frequencyBinCount)
      this.masterTime = new Uint8Array(this.masterAnalyser.fftSize)
      this.masterPreviousFrequency = new Uint8Array(this.masterAnalyser.frequencyBinCount)
    }
    for (const track of this.tracks.values()) this.connectTrack(track)
    if (!this.rafId) this.rafId = requestAnimationFrame(this.tick)
  }

  private connectTrack(track: Track) {
    if (!this.context || !this.masterAnalyser || track.source || !track.memory.audio) return
    track.source = this.context.createMediaElementSource(track.element)
    track.analyser = this.context.createAnalyser()
    track.analyser.fftSize = 1024
    track.analyser.smoothingTimeConstant = 0
    track.gain = this.context.createGain()
    track.frequency = new Uint8Array(track.analyser.frequencyBinCount)
    track.time = new Uint8Array(track.analyser.fftSize)
    track.previousFrequency = new Uint8Array(track.analyser.frequencyBinCount)
    track.source.connect(track.analyser)
    track.analyser.connect(track.gain)
    track.gain.connect(this.masterAnalyser)
  }

  private updateMix() {
    if (!this.context) return
    const now = this.context.currentTime
    this.tracks.forEach((track, id) => {
      track.element.loop = this.mode === 'soundscape'
      if (!track.gain) return
      const target = this.mode === 'single' ? (id === this.activeMemoryId ? 1 : 0) : (id === this.activeMemoryId ? 0.92 : 0.42)
      track.gain.gain.cancelScheduledValues(now)
      track.gain.gain.setTargetAtTime(target, now, 0.32)
    })
  }

  private analyze(
    analyser: AnalyserNode,
    frequency: Uint8Array<ArrayBuffer>,
    time: Uint8Array<ArrayBuffer>,
    previousFrequency: Uint8Array<ArrayBuffer>,
    previous: AudioAnalysis,
    previousRms: number,
    previousPulse: number,
    onsetTimes: number[],
    progress: number,
  ) {
    analyser.getByteFrequencyData(frequency)
    analyser.getByteTimeDomainData(time)
    let sumSquares = 0
    for (const sample of time) {
      const centered = (sample - 128) / 128
      sumSquares += centered * centered
    }
    const rawRms = clamp01(Math.sqrt(sumSquares / Math.max(1, time.length)) * 3.1)
    const nyquist = (this.context?.sampleRate ?? 48000) / 2
    const band = (lowHz: number, highHz: number) => {
      const start = Math.max(0, Math.floor((lowHz / nyquist) * frequency.length))
      const end = Math.min(frequency.length, Math.ceil((highHz / nyquist) * frequency.length))
      let energy = 0
      for (let index = start; index < end; index += 1) {
        const value = frequency[index] / 255
        energy += value * value
      }
      return clamp01(Math.sqrt(energy / Math.max(1, end - start)) * 1.35)
    }
    let spectralEnergy = 0
    let weightedFrequency = 0
    let flux = 0
    for (let index = 1; index < frequency.length; index += 1) {
      const magnitude = frequency[index] / 255
      spectralEnergy += magnitude
      weightedFrequency += magnitude * ((index / frequency.length) * nyquist)
      flux += Math.max(0, frequency[index] - previousFrequency[index]) / 255
      previousFrequency[index] = frequency[index]
    }
    const centroid = spectralEnergy > 0 ? clamp01((weightedFrequency / spectralEnergy) / 12000) : 0
    const transientRaw = clamp01(Math.max(0, rawRms - previousRms) * 5 + (flux / frequency.length) * 2.4)
    const onsetRaw = transientRaw > 0.19 && rawRms > 0.025 ? transientRaw : 0
    const now = performance.now()
    if (onsetRaw > 0.19 && (onsetTimes.at(-1) ?? 0) < now - 120) onsetTimes.push(now)
    while (onsetTimes[0] < now - 4000) onsetTimes.shift()
    const pulse = onsetRaw > previousPulse ? smooth(previousPulse, onsetRaw, 0.78, 0.12) : previousPulse * 0.87
    const analysis: AudioAnalysis = {
      rms: smooth(previous.rms, rawRms),
      loudness: smooth(previous.loudness, clamp01(Math.sqrt(rawRms) * 0.9)),
      lowEnergy: smooth(previous.lowEnergy, band(35, 220), 0.28, 0.07),
      midEnergy: smooth(previous.midEnergy, band(220, 2400), 0.24, 0.07),
      highEnergy: smooth(previous.highEnergy, band(2400, 12000), 0.25, 0.09),
      spectralCentroid: smooth(previous.spectralCentroid, centroid, 0.18, 0.07),
      transient: smooth(previous.transient, transientRaw, 0.55, 0.12),
      onset: onsetRaw,
      rhythmDensity: smooth(previous.rhythmDensity, clamp01(onsetTimes.length / 12), 0.12, 0.04),
      pulse,
      progress: clamp01(progress),
      silent: rawRms < 0.012,
    }
    return { analysis, rawRms, pulse }
  }

  private tick = () => {
    if (this.disposed || !this.context || !this.masterAnalyser || !this.masterFrequency || !this.masterTime || !this.masterPreviousFrequency) return
    const byMemory: Record<string, AudioAnalysis> = {}
    this.tracks.forEach((track, id) => {
      if (!track.analyser || !track.frequency || !track.time || !track.previousFrequency) {
        byMemory[id] = track.analysis
        return
      }
      const duration = Number.isFinite(track.element.duration) ? track.element.duration : track.memory.duration ?? 0
      const result = this.analyze(
        track.analyser,
        track.frequency,
        track.time,
        track.previousFrequency,
        track.analysis,
        track.previousRms,
        track.pulse,
        track.onsetTimes,
        duration > 0 ? track.element.currentTime / duration : 0,
      )
      track.analysis = result.analysis
      track.previousRms = result.rawRms
      track.pulse = result.pulse
      byMemory[id] = result.analysis
    })
    const activeProgress = this.activeMemoryId ? byMemory[this.activeMemoryId]?.progress ?? 0 : 0
    const masterResult = this.analyze(
      this.masterAnalyser,
      this.masterFrequency,
      this.masterTime,
      this.masterPreviousFrequency,
      this.snapshot.master,
      this.masterPreviousRms,
      this.masterPulse,
      this.masterOnsetTimes,
      activeProgress,
    )
    this.masterPreviousRms = masterResult.rawRms
    this.masterPulse = masterResult.pulse
    this.snapshot = { ...this.snapshot, byMemory, master: masterResult.analysis }
    this.emit()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private publish() {
    const byMemory = Object.fromEntries([...this.tracks].map(([id, track]) => [id, track.analysis]))
    const playableMemoryIds = [...this.tracks.values()].filter((track) => Boolean(track.memory.audio)).map((track) => track.memory.id)
    const playing = [...this.tracks.values()].some((track) => !track.element.paused)
    this.snapshot = { ...this.snapshot, byMemory, playableMemoryIds, playing }
    this.emit()
  }

  private patch(patch: Partial<AudioAnalysisSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.emit()
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.snapshot))
  }
}

export { EMPTY_ANALYSIS }
