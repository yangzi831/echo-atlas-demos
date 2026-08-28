import { seededNoise } from './seed'
import type { AudioAnalysis, EchoForm, VisualPreset } from './types'

export interface RenderLayer {
  form: EchoForm
  analysis: AudioAnalysis
  weight: number
  active: boolean
  offsetX: number
  offsetY: number
  scale: number
  hover: number
}

interface RenderOptions {
  width: number
  height: number
  preset: VisualPreset
  time: number
  progress: number
  reducedMotion: boolean
  compact: boolean
}

const rgba = (hex: string, alpha: number) => {
  const value = hex.replace('#', '')
  const expanded = value.length === 3 ? value.split('').map((character) => character + character).join('') : value
  const numeric = Number.parseInt(expanded, 16)
  return `rgba(${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}, ${alpha})`
}

const formPoint = (form: EchoForm, index: number, span: number, height: number, time: number, energy: number) => {
  const point = form.points[index]
  const motion = Math.sin(time * 1.15 + index * 0.22 + form.seed * 0.0001) * energy * (0.8 + point.high) * 8
  return { x: (point.x - 0.5) * span, y: point.y * height + motion }
}

const strokeForm = (context: CanvasRenderingContext2D, layer: RenderLayer, span: number, height: number, time: number, alpha: number, offset = 0) => {
  const { form, analysis } = layer
  context.beginPath()
  form.points.forEach((point, index) => {
    const position = formPoint(form, index, span, height, time, analysis.rms)
    const y = position.y + offset * (0.35 + point.high)
    if (index === 0) context.moveTo(position.x, y)
    else context.lineTo(position.x, y)
  })
  context.strokeStyle = rgba(form.palette[offset === 0 ? 0 : 2], alpha)
  context.lineWidth = Math.max(0.7, (offset === 0 ? 1.8 : 0.7) + analysis.rms * 4 + layer.hover * 1.5)
  context.stroke()
}

const drawTrace = (context: CanvasRenderingContext2D, layer: RenderLayer, span: number, height: number, time: number) => {
  const alpha = layer.weight * (0.46 + layer.analysis.loudness * 0.45)
  strokeForm(context, layer, span, height, time, alpha)
  const filament = 8 + layer.form.summary.high * 18
  strokeForm(context, layer, span, height, time * 0.7, alpha * 0.22, filament)
  strokeForm(context, layer, span, height, time * 0.8, alpha * 0.16, -filament * 0.72)
  layer.form.points.forEach((point, index) => {
    if (point.onset < 0.22 && point.branch < 0.55) return
    const position = formPoint(layer.form, index, span, height, time, layer.analysis.rms)
    const radius = 1.3 + point.onset * 4 + layer.analysis.pulse * 5
    context.beginPath()
    context.arc(position.x, position.y, radius, 0, Math.PI * 2)
    context.fillStyle = rgba(layer.form.palette[1], alpha * 0.8)
    context.fill()
  })
}

const drawField = (context: CanvasRenderingContext2D, layer: RenderLayer, span: number, height: number, time: number, compact: boolean) => {
  const count = compact ? 90 : 210
  const intensity = 0.15 + layer.analysis.loudness * 0.75
  for (let index = 0; index < count; index += 1) {
    const pointIndex = (index * 13 + layer.form.seed) % layer.form.points.length
    const anchor = formPoint(layer.form, pointIndex, span, height, time * 0.3, layer.analysis.rms)
    const radius = 8 + Math.abs(seededNoise(layer.form.seed ^ 0x51, index)) * (42 + layer.form.summary.high * 85)
    const angle = seededNoise(layer.form.seed, index) * Math.PI + time * (0.05 + layer.form.summary.rhythmDensity * 0.2) * (index % 2 ? 1 : -1)
    const x = anchor.x + Math.cos(angle) * radius
    const y = anchor.y + Math.sin(angle) * radius * 0.55
    const size = 0.45 + Math.abs(seededNoise(layer.form.seed ^ 0x93, index)) * 1.6 + layer.analysis.transient * 1.4
    context.beginPath()
    context.arc(x, y, size, 0, Math.PI * 2)
    context.fillStyle = rgba(index % 7 === 0 ? layer.form.palette[1] : layer.form.palette[0], layer.weight * intensity * (0.16 + size * 0.12))
    context.fill()
  }
  strokeForm(context, layer, span, height, time, layer.weight * 0.23)
}

const drawArchive = (context: CanvasRenderingContext2D, layer: RenderLayer, span: number, height: number, time: number) => {
  const layers = 9
  for (let stratum = layers - 1; stratum >= 0; stratum -= 1) {
    const distance = (stratum - (layers - 1) / 2) * (8 + layer.form.summary.low * 10)
    const fade = 1 - Math.abs(stratum - (layers - 1) / 2) / layers
    strokeForm(context, layer, span, height, time * 0.12, layer.weight * fade * 0.2, distance)
  }
  context.beginPath()
  layer.form.points.forEach((_point, index) => {
    const position = formPoint(layer.form, index, span, height, time * 0.08, layer.analysis.rms * 0.3)
    if (index === 0) context.moveTo(position.x, position.y + 10)
    else context.lineTo(position.x, position.y + 10)
  })
  for (let index = layer.form.points.length - 1; index >= 0; index -= 1) {
    const position = formPoint(layer.form, index, span, height, time * 0.08, layer.analysis.rms * 0.3)
    context.lineTo(position.x, position.y + 42 + layer.form.points[index].low * 24)
  }
  context.closePath()
  context.fillStyle = rgba(layer.form.palette[0], layer.weight * 0.055)
  context.fill()
}

const drawGrowth = (context: CanvasRenderingContext2D, layer: RenderLayer, span: number, height: number, time: number) => {
  strokeForm(context, layer, span, height, time * 0.35, layer.weight * 0.65)
  layer.form.points.forEach((point, index) => {
    if (point.branch < 0.36 || index < 3 || index > layer.form.points.length - 4) return
    const anchor = formPoint(layer.form, index, span, height, time * 0.35, layer.analysis.rms)
    const side = seededNoise(layer.form.seed ^ 0x7a, index) > 0 ? 1 : -1
    const length = (12 + point.branch * 58) * (0.8 + layer.analysis.highEnergy * 0.35)
    const bend = seededNoise(layer.form.seed ^ 0x19, index) * 18
    context.beginPath()
    context.moveTo(anchor.x, anchor.y)
    context.quadraticCurveTo(anchor.x + length * 0.45, anchor.y + side * length * 0.22 + bend, anchor.x + length, anchor.y + side * length)
    context.strokeStyle = rgba(index % 3 === 0 ? layer.form.palette[1] : layer.form.palette[2], layer.weight * (0.24 + point.high * 0.38))
    context.lineWidth = 0.6 + point.rms * 2
    context.stroke()
    context.beginPath()
    context.arc(anchor.x + length, anchor.y + side * length, 1 + point.high * 2 + layer.analysis.pulse * 2, 0, Math.PI * 2)
    context.fillStyle = rgba(layer.form.palette[1], layer.weight * 0.65)
    context.fill()
  })
}

export function drawListeningFrame(context: CanvasRenderingContext2D, layers: readonly RenderLayer[], options: RenderOptions) {
  const { width, height, preset, reducedMotion, compact } = options
  const time = reducedMotion ? 0 : options.time
  context.clearRect(0, 0, width, height)
  const gradient = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.76)
  gradient.addColorStop(0, '#111918')
  gradient.addColorStop(0.5, '#0a0f0f')
  gradient.addColorStop(1, '#050808')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
  context.globalCompositeOperation = 'lighter'
  const span = Math.min(width * 0.68, 820)
  const formHeight = Math.min(height * 0.42, 310)
  layers.forEach((layer) => {
    context.save()
    context.translate(width * 0.5 + layer.offsetX, height * 0.48 + layer.offsetY)
    context.scale(layer.scale, layer.scale)
    if (preset === 'field') drawField(context, layer, span, formHeight, time, compact)
    else if (preset === 'archive') drawArchive(context, layer, span, formHeight, time)
    else if (preset === 'growth') drawGrowth(context, layer, span, formHeight, time)
    else drawTrace(context, layer, span, formHeight, time)
    const progress = layer.analysis.progress
    if (progress > 0 && layer.active) {
      const pointIndex = Math.min(layer.form.points.length - 1, Math.floor(progress * layer.form.points.length))
      const position = formPoint(layer.form, pointIndex, span, formHeight, time, layer.analysis.rms)
      const glow = context.createRadialGradient(position.x, position.y, 0, position.x, position.y, 20 + layer.analysis.pulse * 22)
      glow.addColorStop(0, rgba(layer.form.palette[1], 0.94))
      glow.addColorStop(1, rgba(layer.form.palette[1], 0))
      context.fillStyle = glow
      context.beginPath()
      context.arc(position.x, position.y, 22 + layer.analysis.pulse * 22, 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
  })
  context.globalCompositeOperation = 'source-over'
}
