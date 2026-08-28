import type { AudioEngineSnapshot, AudioFeatures } from './types'
import { SILENT_FEATURES } from './types'

type Listener = (snapshot: AudioEngineSnapshot) => void

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export class AudioEngine {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private monitorGain: GainNode | null = null
  private mediaElement = new Audio()
  private mediaElementSource: MediaElementAudioSourceNode | null = null
  private microphoneStream: MediaStream | null = null
  private microphoneSource: MediaStreamAudioSourceNode | null = null
  private frequencyData: Uint8Array<ArrayBuffer> | null = null
  private timeData: Uint8Array<ArrayBuffer> | null = null
  private objectUrl: string | null = null
  private recordingUrl: string | null = null
  private recorder: MediaRecorder | null = null
  private activeSource: 'file' | 'microphone' | null = null
  private recordingChunks: Blob[] = []
  private rafId = 0
  private listeners = new Set<Listener>()
  private previousBass = 0
  private bassFloor = 0
  private beatEnvelope = 0
  private silenceStartedAt = performance.now()

  private snapshot: AudioEngineSnapshot = {
    features: { ...SILENT_FEATURES },
    mode: 'idle',
    playing: false,
    trackName: null,
    recording: false,
    recordingStartedAt: null,
    recordingUrl: null,
    error: null,
  }

  constructor() {
    this.mediaElement.crossOrigin = 'anonymous'
    this.mediaElement.preload = 'metadata'
    this.mediaElement.addEventListener('play', this.handlePlay)
    this.mediaElement.addEventListener('pause', this.handlePause)
    this.mediaElement.addEventListener('ended', this.handlePause)
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async loadFile(file: File) {
    await this.ensureGraph()
    this.disconnectSources()
    this.stopMicrophoneTracks()
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = URL.createObjectURL(file)
    this.mediaElement.src = this.objectUrl
    this.mediaElement.currentTime = 0
    this.connectFileSource()
    this.monitorGain!.gain.value = 1
    this.patch({ mode: 'file', trackName: file.name, error: null })
    await this.play()
  }

  async play() {
    if (this.snapshot.mode !== 'file' || !this.mediaElement.src) return
    await this.resumeContext()
    this.connectFileSource()
    this.monitorGain!.gain.value = 1
    await this.mediaElement.play()
  }

  pause() {
    this.mediaElement.pause()
  }

  async togglePlayback() {
    if (this.snapshot.mode !== 'file') return
    if (this.mediaElement.paused) await this.play()
    else this.pause()
  }

  async useMicrophone() {
    try {
      await this.ensureGraph()
      this.mediaElement.pause()
      this.disconnectSources()
      this.stopMicrophoneTracks()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      this.microphoneStream = stream
      this.microphoneSource = this.context!.createMediaStreamSource(stream)
      this.microphoneSource.connect(this.analyser!)
      this.activeSource = 'microphone'
      this.monitorGain!.gain.value = 0
      this.patch({ mode: 'microphone', playing: true, trackName: '实时麦克风', error: null })
      return stream
    } catch (error) {
      this.patch({ error: error instanceof Error ? error.message : '无法访问麦克风' })
      throw error
    }
  }

  stopInput() {
    this.mediaElement.pause()
    this.disconnectSources()
    this.stopMicrophoneTracks()
    this.patch({ mode: 'idle', playing: false, trackName: null })
  }

  async startRecording() {
    const stream = await this.useMicrophone()
    if (!('MediaRecorder' in window)) {
      this.patch({ error: '当前浏览器不支持录音' })
      return
    }
    if (this.recordingUrl) URL.revokeObjectURL(this.recordingUrl)
    this.recordingUrl = null
    this.recordingChunks = []
    this.recorder = new MediaRecorder(stream)
    this.recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.recordingChunks.push(event.data)
    })
    this.recorder.start(250)
    this.patch({ recording: true, recordingStartedAt: performance.now(), recordingUrl: null, error: null })
  }

  async stopRecording() {
    if (!this.recorder || this.recorder.state === 'inactive') return null
    const recorder = this.recorder
    const blob = await new Promise<Blob>((resolve) => {
      recorder.addEventListener('stop', () => {
        resolve(new Blob(this.recordingChunks, { type: recorder.mimeType || 'audio/webm' }))
      }, { once: true })
      recorder.stop()
    })
    this.recordingUrl = URL.createObjectURL(blob)
    this.patch({ recording: false, recordingStartedAt: null, recordingUrl: this.recordingUrl })
    return this.recordingUrl
  }

  dispose() {
    cancelAnimationFrame(this.rafId)
    this.stopInput()
    this.mediaElement.removeEventListener('play', this.handlePlay)
    this.mediaElement.removeEventListener('pause', this.handlePause)
    this.mediaElement.removeEventListener('ended', this.handlePause)
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    if (this.recordingUrl) URL.revokeObjectURL(this.recordingUrl)
    void this.context?.close()
    this.listeners.clear()
  }

  private async ensureGraph() {
    if (this.context) {
      await this.resumeContext()
      return
    }
    this.context = new AudioContext()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.68
    this.monitorGain = this.context.createGain()
    this.analyser.connect(this.monitorGain)
    this.monitorGain.connect(this.context.destination)
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
    this.timeData = new Uint8Array(this.analyser.fftSize)
    this.connectFileSource()
    this.tick()
  }

  private connectFileSource() {
    if (!this.context || !this.analyser) return
    if (this.activeSource === 'file') return
    if (!this.mediaElementSource) {
      this.mediaElementSource = this.context.createMediaElementSource(this.mediaElement)
    }
    this.mediaElementSource.connect(this.analyser)
    this.activeSource = 'file'
  }

  private disconnectSources() {
    try { this.mediaElementSource?.disconnect() } catch { /* already disconnected */ }
    try { this.microphoneSource?.disconnect() } catch { /* already disconnected */ }
    this.microphoneSource = null
    this.activeSource = null
  }

  private stopMicrophoneTracks() {
    this.microphoneStream?.getTracks().forEach((track) => track.stop())
    this.microphoneStream = null
  }

  private resumeContext = async () => {
    if (this.context?.state === 'suspended') await this.context.resume()
  }

  private handlePlay = () => this.patch({ playing: true })
  private handlePause = () => this.patch({ playing: false })

  private patch(patch: Partial<AudioEngineSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.emit()
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.snapshot))
  }

  private bandEnergy(data: Uint8Array<ArrayBuffer>, lowHz: number, highHz: number) {
    if (!this.context || !this.analyser) return 0
    const nyquist = this.context.sampleRate / 2
    const start = Math.max(0, Math.floor((lowHz / nyquist) * data.length))
    const end = Math.min(data.length, Math.ceil((highHz / nyquist) * data.length))
    let energy = 0
    for (let index = start; index < end; index += 1) {
      const value = data[index] / 255
      energy += value * value
    }
    return end > start ? Math.sqrt(energy / (end - start)) : 0
  }

  private tick = () => {
    if (!this.analyser || !this.frequencyData || !this.timeData) return
    this.analyser.getByteFrequencyData(this.frequencyData)
    this.analyser.getByteTimeDomainData(this.timeData)

    let sumSquares = 0
    for (const sample of this.timeData) {
      const centered = (sample - 128) / 128
      sumSquares += centered * centered
    }
    const rawVolume = clamp(Math.sqrt(sumSquares / this.timeData.length) * 3.2)
    const rawBass = clamp(this.bandEnergy(this.frequencyData, 35, 180) * 1.35)
    const rawMid = clamp(this.bandEnergy(this.frequencyData, 180, 2400) * 1.45)
    const rawHigh = clamp(this.bandEnergy(this.frequencyData, 2400, 12000) * 1.75)

    const previous = this.snapshot.features
    const smooth = (current: number, target: number, attack = 0.28, release = 0.08) =>
      current + (target - current) * (target > current ? attack : release)
    const volume = smooth(previous.volume, rawVolume)
    const bass = smooth(previous.bass, rawBass)
    const mid = smooth(previous.mid, rawMid, 0.2, 0.06)
    const high = smooth(previous.high, rawHigh, 0.22, 0.08)

    this.bassFloor = this.bassFloor * 0.97 + rawBass * 0.03
    const transient = Math.max(0, rawBass - this.previousBass) + Math.max(0, rawBass - this.bassFloor) * 0.45
    const beatTarget = clamp(transient * 5.5)
    this.beatEnvelope = beatTarget > this.beatEnvelope
      ? this.beatEnvelope + (beatTarget - this.beatEnvelope) * 0.72
      : this.beatEnvelope * 0.88
    this.previousBass = rawBass

    if (volume > 0.018) this.silenceStartedAt = performance.now()
    const silent = performance.now() - this.silenceStartedAt > 650
    const features: AudioFeatures = { volume, bass, mid, high, beat: this.beatEnvelope, silent }
    this.snapshot = { ...this.snapshot, features }
    this.emit()
    this.rafId = requestAnimationFrame(this.tick)
  }
}
