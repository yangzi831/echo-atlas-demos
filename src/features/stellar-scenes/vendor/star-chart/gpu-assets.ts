/**
 * Stellar Synth — 共享 GPU 资源
 * =============================
 * 供各视觉层复用的发光精灵纹理等。
 */

import * as THREE from "three";

/** 生成柔和径向发光的圆形精灵纹理（用于粒子、节点、核心） */
export function createGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d")!;
  const r = 48;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.22, "rgba(240,242,246,0.72)");
  gr.addColorStop(0.52, "rgba(160,170,190,0.18)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 96, 96);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
