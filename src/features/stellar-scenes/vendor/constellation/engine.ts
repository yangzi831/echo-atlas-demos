/**
 * StellarSynthEngine — the mountable visual module for the "星宿合成器 /
 * Stellar Synth" host.
 *
 * Public API (integration surface):
 *   const engine = new StellarSynthEngine(options);
 *   engine.mount(element);              // attach renderer + start loop
 *   engine.setEnabled(bool);            // pause / resume the loop
 *   engine.setParams({ ... });          // live parameter patch
 *   engine.pushAudio(frame);            // external audio → visuals
 *   engine.dispatch({ type: "tap" });   // external tap/press/hold/release
 *   engine.resize();                    // manual resize (also automatic)
 *   engine.audio;                       // AudioReactiveMapping (mic / upload)
 *   engine.dispose();                   // full teardown
 *
 * Internally it owns: Renderer (THREE.WebGLRenderer), Scene + Camera, the
 * NebulaField / ParticleSystem / Constellation modules, the
 * InteractionController, the AudioReactiveMapping, and one unified
 * animation loop + resize handler.
 */
import * as THREE from "three";
import { NebulaField } from "./nebula-field";
import { ParticleSystem } from "./particle-system";
import { Constellation } from "./constellation";
import { InteractionController } from "./interaction-controller";
import { AudioReactiveMapping } from "./audio-reactive-mapping";
import { createDotTexture } from "./utils";
import {
  DEFAULT_PARAMS,
  type AudioFrame,
  type EngineOptions,
  type EngineParams,
  type InteractionEvent,
} from "./types";

export class StellarSynthEngine {
  readonly audio = new AudioReactiveMapping();
  readonly interaction = new InteractionController();

  private params: EngineParams;
  private readonly maxPixelRatio: number;
  private readonly respectReducedMotion: boolean;
  private readonly attachPointerListeners: boolean;
  private reducedMotion = false;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private mountEl: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;

  private nebula!: NebulaField;
  private particles!: ParticleSystem;
  private constellation!: Constellation;
  private dotTexture!: THREE.Texture;

  private enabled = false;
  private rafId = 0;
  private startTime = 0;
  private lastTime = 0;
  private tmpPointer = new THREE.Vector2();
  private resizeObserver: ResizeObserver | null = null;
  /** Accumulated self-rotation angle (radians). Never resets, so audio can
   *  speed it up / slow it down smoothly without any jump. */
  private spin = 0;
  /** Eased current angular velocity, so audio changes ramp instead of snap. */
  private spinVel = 0;

  constructor(options: EngineOptions = {}) {
    this.params = { ...DEFAULT_PARAMS, ...options.params };
    this.maxPixelRatio = options.maxPixelRatio ?? 2;
    this.respectReducedMotion = options.respectReducedMotion ?? true;
    this.attachPointerListeners = options.attachPointerListeners ?? true;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
    this.camera.position.z = 26;
    this.interaction.setInfluence(this.params.pointerInfluence);
    // Advance the graph a step whenever a tap/hold arrives.
    this.interaction.onInteraction((type) => {
      if (type === "tap") this.constellation?.activate(0.12);
      if (type === "hold") this.constellation?.activate(0.05);
    });
  }

  /** Attach to a DOM element and begin rendering. */
  mount(el: HTMLElement): void {
    if (this.mountEl) return;
    this.mountEl = el;
    this.reducedMotion =
      this.respectReducedMotion &&
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;";
    el.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio));
    this.renderer = renderer;

    this.dotTexture = createDotTexture();
    this.nebula = new NebulaField(this.params);
    this.particles = new ParticleSystem(this.params, this.dotTexture);
    this.constellation = new Constellation(this.params, this.dotTexture);
    this.scene.add(this.nebula.mesh, this.particles.points, this.constellation.group);

    if (this.attachPointerListeners) this.interaction.attach(el);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(el);
    window.addEventListener("resize", this.handleResize, { passive: true });

    this.resize();
    this.setEnabled(true);
  }

  private handleResize = () => this.resize();

  resize(): void {
    if (!this.renderer || !this.mountEl) return;
    const w = this.mountEl.clientWidth || window.innerWidth;
    const h = this.mountEl.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) {
      this.startTime = this.startTime || performance.now();
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    } else if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** Live parameter patch. Rebuilds geometry only when counts change. */
  setParams(patch: Partial<EngineParams>): void {
    const prev = this.params;
    this.params = {
      ...prev,
      ...patch,
      palette: { ...prev.palette, ...(patch.palette ?? {}) },
    };
    this.interaction.setInfluence(this.params.pointerInfluence);
    if (!this.renderer) return;
    if (patch.palette) {
      this.nebula.applyPalette(this.params);
      this.particles.applyPalette(this.params);
      this.constellation.applyPalette(this.params);
    }
    if (patch.pointerInfluence != null) this.particles.applyPalette(this.params);
    if (patch.particleCount && patch.particleCount !== prev.particleCount) {
      this.particles.rebuild(this.params);
    }
    if (patch.nodeCount && patch.nodeCount !== prev.nodeCount) {
      this.constellation.rebuild(this.params);
    }
  }

  getParams(): Readonly<EngineParams> {
    return this.params;
  }

  /** External audio path. */
  pushAudio(frame: Partial<AudioFrame>): void {
    this.audio.push(frame);
  }

  /** External interaction path. */
  dispatch(event: InteractionEvent): void {
    this.interaction.dispatch(event);
  }

  private tick = (now: number): void => {
    if (!this.enabled || !this.renderer) return;
    const time = (now - this.startTime) / 1000;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000) || 0.016;
    this.lastTime = now;

    const react = this.params.audioReactivity;
    this.audio.update(time, now, this.params.ambientMotion && !this.reducedMotion);
    this.interaction.update(dt);

    // Scale audio influence by reactivity for a single, honest control.
    const a = this.audio.frame;
    const f: AudioFrame = {
      amplitude: a.amplitude * react,
      bass: a.bass * react,
      mid: a.mid * react,
      high: a.high * react,
      beat: a.beat * react,
      drone: a.drone * react,
    };

    const press = this.interaction.press;
    const pulse = this.interaction.pulse;
    this.interaction.effectivePointer(this.tmpPointer);

    // Ambient + audio-driven self-rotation of the whole field.
    // Base speed keeps it slowly spinning even in silence; amplitude / bass /
    // beat add extra angular velocity so louder audio visibly spins faster.
    if (!this.reducedMotion) {
      const base = this.params.rotationSpeed;
      const audioSpin =
        base * (1.0 * f.amplitude + 1.3 * f.bass + 0.7 * f.beat + 0.5 * f.drone);
      const targetVel = base + audioSpin;
      // Ease angular velocity toward the target so it ramps up/down smoothly.
      this.spinVel += (targetVel - this.spinVel) * Math.min(1, dt * 3);
      this.spin += this.spinVel * dt * 60;
      this.particles.points.rotation.z = this.spin;
      this.particles.points.rotation.x = this.tmpPointer.y * 0.05;
      this.particles.points.rotation.y = this.tmpPointer.x * 0.07;
      this.constellation.group.rotation.copy(this.particles.points.rotation);
    }

    this.nebula.update(time, f, this.tmpPointer, pulse);
    this.particles.update(time, f, this.tmpPointer, press);
    this.constellation.update(time, f, this.params, pulse, press, dt);

    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.setEnabled(false);
    window.removeEventListener("resize", this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.interaction.detach();
    this.audio.dispose();
    this.nebula?.dispose();
    this.particles?.dispose();
    this.constellation?.dispose();
    this.dotTexture?.dispose();
    this.renderer?.dispose();
    if (this.canvas && this.mountEl?.contains(this.canvas)) {
      this.mountEl.removeChild(this.canvas);
    }
    this.renderer = null;
    this.canvas = null;
    this.mountEl = null;
  }
}
