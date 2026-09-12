/**
 * Stellar Synth — Scene orchestrator.
 *
 * The single class the host integrates. It owns the Three.js renderer, camera,
 * the particle vortex, the orbital rings, and the luminous core glow, plus the
 * animation loop and resize handling. It implements {@link StellarSceneApi} so
 * the React layer and any external "Stellar Synth" host talk to a stable
 * contract only — never to internals.
 *
 * Usage (standalone or embedded):
 *   const scene = new StellarScene();
 *   scene.mount(canvas);
 *   scene.resize(w, h);
 *   // drive it:
 *   scene.setPointer(0.5, 0.5); scene.tap(); scene.press(); scene.release();
 *   scene.setAudioFrame({ bass: 0.8, amplitude: 0.9 }); // external audio
 *   // or let it analyse audio itself:
 *   await scene.playFile(file); await scene.startMic();
 *   // teardown:
 *   scene.dispose();
 */
import * as THREE from "three";
import type {
  AudioFrame,
  AudioFramePatch,
  AudioSourceKind,
  EngineConfig,
  EngineState,
  StellarSceneApi,
} from "./types";
import { DEFAULT_CONFIG, mergeConfig } from "./config";
import { AudioAnalyser, mockAudioFrame } from "./audio-analyser";
import { InteractionController } from "./interaction-controller";
import { ParticleSystem } from "./particle-system";
import { mapAudioToVisual } from "./audio-reactive-mapping";

export class StellarScene implements StellarSceneApi {
  private cfg: EngineConfig;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private particles: ParticleSystem | null = null;
  private ringGroup = new THREE.Group();
  private rings: THREE.LineLoop[] = [];
  private glowMat: THREE.ShaderMaterial | null = null;

  private interaction: InteractionController;
  private analyser = new AudioAnalyser();
  private externalFrame: AudioFrame | null = null;
  private currentFrame: AudioFrame = AudioAnalyser.empty();

  private raf = 0;
  private last = 0;
  private visible = true;
  private fps = 60;
  private width = 1;
  private height = 1;

  private stateSubs = new Set<(s: EngineState) => void>();
  private onVisibility = () => {
    this.visible = !document.hidden;
  };

  constructor(config?: Partial<EngineConfig>) {
    this.cfg = mergeConfig(DEFAULT_CONFIG, config);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);
    this.camera.position.z = 13;
    this.interaction = new InteractionController();
  }

  // --- Lifecycle ------------------------------------------------------------
  mount(canvas: HTMLCanvasElement): void {
    if (this.renderer) return;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;

    const isMobile =
      typeof window !== "undefined" ? window.innerWidth < 520 : false;
    const count = isMobile
      ? this.cfg.particleCountMobile
      : this.cfg.particleCountDesktop;

    this.particles = new ParticleSystem(this.cfg, count);
    this.scene.add(this.particles.points);

    this.scene.add(this.ringGroup);
    this.rings = [
      this.makeRing(2.1, 0.1),
      this.makeRing(3.4, -0.3),
      this.makeRing(5.2, -0.8),
    ];

    this.buildCoreGlow();

    const w = typeof window !== "undefined" ? window.innerWidth : 1;
    const h = typeof window !== "undefined" ? window.innerHeight : 1;
    this.resize(w, h);

    document.addEventListener("visibilitychange", this.onVisibility);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.analyser.dispose();
    this.particles?.dispose();
    this.rings.forEach((r) => {
      r.geometry.dispose();
      (r.material as THREE.Material).dispose();
    });
    this.glowMat?.dispose();
    this.renderer?.dispose();
    this.renderer = null;
    this.stateSubs.clear();
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    if (!this.renderer) return;
    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      this.cfg.maxPixelRatio,
    );
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  // --- Interaction ----------------------------------------------------------
  tap(): void {
    this.interaction.tap();
  }
  press(): void {
    this.interaction.press();
  }
  release(): void {
    this.interaction.release();
  }
  hold(dt: number): void {
    this.interaction.addHold(dt);
  }
  setPointer(x: number, y: number): void {
    this.interaction.setPointer(x, y);
  }
  /** Internal helper for DOM pointer wiring (NDC coords in [-1,1]). */
  setPointerNdc(nx: number, ny: number): void {
    this.interaction.setPointerNdc(nx, ny);
  }

  // --- Audio ----------------------------------------------------------------
  setAudioFrame(frame: AudioFramePatch): void {
    this.externalFrame = { ...this.currentFrame, ...frame };
  }
  async playFile(file: File): Promise<void> {
    this.externalFrame = null;
    await this.analyser.playFile(file);
  }
  async startMic(): Promise<void> {
    this.externalFrame = null;
    await this.analyser.startMic();
  }
  stopAudio(): void {
    this.analyser.stop();
  }
  getSource(): AudioSourceKind {
    if (this.analyser.active) return this.analyser.kind;
    if (this.externalFrame) return "external";
    return "none";
  }

  // --- Config + state -------------------------------------------------------
  setConfig(patch: Partial<EngineConfig>): void {
    this.cfg = mergeConfig(this.cfg, patch);
    this.particles?.setConfig(this.cfg);
  }
  getState(): EngineState {
    const f = this.currentFrame;
    return {
      amplitude: f.amplitude,
      bass: f.bass,
      mid: f.mid,
      high: f.high,
      drone: f.drone,
      beatCount: this.interaction.beatCount,
      holding: this.interaction.holding,
      fps: this.fps,
    };
  }
  onState(cb: (state: EngineState) => void): () => void {
    this.stateSubs.add(cb);
    return () => this.stateSubs.delete(cb);
  }

  // --- Internals ------------------------------------------------------------
  private makeRing(scale: number, offset: number): THREE.LineLoop {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 220; i++) {
      const a = (i / 220) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          Math.cos(a) * scale * 1.28,
          Math.sin(a) * scale * 0.62,
          offset + Math.sin(a * 3) * 0.08,
        ),
      );
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
    });
    const loop = new THREE.LineLoop(g, m);
    this.ringGroup.add(loop);
    return loop;
  }

  private buildCoreGlow(): void {
    const geo = new THREE.PlaneGeometry(3.2, 3.2);
    const [r, g, b] = this.cfg.coreColor;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCore: { value: 0.55 },
        uColor: { value: new THREE.Vector3(r, g, b) },
      },
      vertexShader: /* glsl */ `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: /* glsl */ `varying vec2 vUv;uniform float uCore;uniform vec3 uColor;void main(){float d=length(vUv-0.5);float a=smoothstep(0.5,0.0,d);vec3 c=mix(uColor,vec3(1.0),a);gl_FragColor=vec4(c,a*uCore*0.62);}`,
    });
    this.glowMat = mat;
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || !this.renderer || !this.particles) return;

    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (dt > 0) this.fps = this.fps * 0.9 + (1 / dt) * 0.1;

    // Resolve the active audio frame: internal analysis > external > mock.
    const internal = this.analyser.read(now);
    if (internal) {
      this.currentFrame = internal;
      if (internal.beat) this.interaction.tap();
    } else if (this.externalFrame) {
      this.currentFrame = this.externalFrame;
      if (this.externalFrame.beat) this.interaction.tap();
    } else {
      this.currentFrame = mockAudioFrame(now);
    }

    this.interaction.update(dt);
    const hold = this.interaction.holding;
    const pulse = this.interaction.pulse;
    const drive = mapAudioToVisual(
      this.currentFrame,
      this.cfg.audioGain,
      pulse,
      hold,
    );

    // Rings react to mid (spin) + bass (swell) + interaction.
    this.ringGroup.rotation.z += dt * drive.ringSpin;
    this.ringGroup.scale.setScalar(drive.ringScale);
    this.rings.forEach((r, i) => {
      (r.material as THREE.LineBasicMaterial).opacity =
        0.07 + i * 0.035 + pulse * 0.16 + this.currentFrame.bass * 0.06;
    });

    // Core glow tracks bass + pulse + hold.
    if (this.glowMat) this.glowMat.uniforms.uCore.value = drive.core;

    // Parallax from pointer.
    this.particles.points.rotation.y = this.interaction.pointer.x * 0.06;
    this.particles.points.rotation.x = -this.interaction.pointer.y * 0.04;

    this.particles.update(dt, now, drive, this.interaction.pointer);

    this.renderer.render(this.scene, this.camera);

    if (this.stateSubs.size) {
      const s = this.getState();
      this.stateSubs.forEach((cb) => cb(s));
    }
  };
}
