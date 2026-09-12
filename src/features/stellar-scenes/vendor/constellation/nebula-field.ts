/**
 * NebulaField — the volumetric fbm background cloud rendered on a full-screen
 * quad behind everything. Provides the warm→bone→green nebula ground and
 * responds to amplitude / beat / drone.
 */
import * as THREE from "three";
import { NEBULA_VERT, NEBULA_FRAG } from "./shaders";
import { hexColor } from "./utils";
import type { AudioFrame, EngineParams } from "./types";

export class NebulaField {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(params: EngineParams) {
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0 },
        uBeat: { value: 0 },
        uDrone: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uColorStar: { value: hexColor(params.palette.star) },
      },
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  update(
    time: number,
    audio: AudioFrame,
    pointer: THREE.Vector2,
    pulse: number,
  ): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uAmp.value = audio.amplitude;
    u.uBeat.value = audio.beat + pulse * 0.4;
    u.uDrone.value = audio.drone;
    u.uBass.value = audio.bass;
    u.uMid.value = audio.mid;
    u.uPointer.value.copy(pointer);
  }

  applyPalette(params: EngineParams): void {
    this.material.uniforms.uColorStar.value = hexColor(params.palette.star);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
