/**
 * Small self-contained helpers used across engine modules. Kept dependency-free
 * (aside from three) so modules stay easy to reuse in a host integration.
 */
import * as THREE from "three";

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate-independent exponential approach of `current` toward `target`. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * Soft radial dot sprite used for both star-dust particles and constellation
 * nodes. Warm-white core fading to transparent, matching the design's glowing
 * node aesthetic. Built once and shared.
 */
export function createDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,248,232,1)");
  g.addColorStop(0.22, "rgba(232,216,192,0.85)");
  g.addColorStop(1, "rgba(232,216,192,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Parse a hex color string into a THREE.Color, tolerant of a leading `#`. */
export function hexColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}
