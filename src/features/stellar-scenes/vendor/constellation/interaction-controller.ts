/**
 * InteractionController — normalizes raw pointer / touch input into the
 * engine's tap / press / hold / release model, and lets a host dispatch the
 * same events programmatically (for its performance system).
 *
 * State it maintains for the render loop:
 *  - pointer (eased target in clip space -1..1)
 *  - press   (0..1, held while pressed, decays on release → afterglow)
 *  - pulse   (0..1 transient, spikes on tap, decays each frame)
 */
import * as THREE from "three";
import type { InteractionEvent, InteractionType } from "./types";

const HOLD_THRESHOLD_MS = 260;

export type InteractionListener = (
  type: InteractionType,
  x: number,
  y: number,
  strength: number,
) => void;

export class InteractionController {
  /** Eased pointer position, clip space (-1..1). */
  readonly pointer = new THREE.Vector2(0, 0);
  private target = new THREE.Vector2(0, 0);
  /** Sustained press energy 0..1 (decays as afterglow after release). */
  press = 0;
  /** Transient pulse 0..1 (tap / beat), decays each frame. */
  pulse = 0;

  private el: HTMLElement | null = null;
  private pointerActive = false;
  private pressStart = 0;
  private holdFired = false;
  private listeners = new Set<InteractionListener>();
  private influence = 1;

  private readonly onMove = (e: PointerEvent) => {
    const rect = this.el?.getBoundingClientRect();
    const w = rect?.width ?? window.innerWidth;
    const h = rect?.height ?? window.innerHeight;
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    this.target.x = ((e.clientX - left) / w) * 2 - 1;
    this.target.y = -(((e.clientY - top) / h) * 2 - 1);
  };

  private readonly onDown = (e: PointerEvent) => {
    this.pointerActive = true;
    this.pressStart = performance.now();
    this.holdFired = false;
    this.onMove(e);
    this.emit("press", 1);
    this.el?.setPointerCapture?.(e.pointerId);
  };

  private readonly onUp = () => {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    const held = performance.now() - this.pressStart;
    if (held < HOLD_THRESHOLD_MS && !this.holdFired) {
      this.emit("tap", 1);
    }
    this.emit("release", 1);
  };

  setInfluence(v: number): void {
    this.influence = v;
  }

  attach(el: HTMLElement): void {
    this.el = el;
    el.style.touchAction = "none";
    el.addEventListener("pointermove", this.onMove, { passive: true });
    el.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointerup", this.onUp, { passive: true });
    window.addEventListener("pointercancel", this.onUp, { passive: true });
  }

  detach(): void {
    if (!this.el) return;
    this.el.removeEventListener("pointermove", this.onMove);
    this.el.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    this.el = null;
  }

  onInteraction(fn: InteractionListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Host-facing programmatic dispatch. */
  dispatch(event: InteractionEvent): void {
    const s = event.strength ?? 1;
    if (typeof event.x === "number") this.target.x = event.x;
    if (typeof event.y === "number") this.target.y = event.y;
    this.emit(event.type, s);
  }

  private emit(type: InteractionType, strength: number): void {
    switch (type) {
      case "tap":
        this.pulse = Math.max(this.pulse, strength);
        this.press = Math.max(this.press, strength * 0.9);
        break;
      case "press":
        this.press = Math.max(this.press, strength);
        break;
      case "hold":
        this.press = Math.max(this.press, strength);
        this.holdFired = true;
        break;
      case "release":
        this.press = Math.min(this.press, 0.25 * strength);
        break;
    }
    for (const l of this.listeners) l(type, this.target.x, this.target.y, strength);
  }

  /** Called each frame by the engine: ease pointer, decay energies, fire hold. */
  update(dt: number): void {
    this.pointer.lerp(this.target, Math.min(1, dt * 3));
    this.pointer.multiplyScalar(1); // keep raw; influence applied in shaders
    // Detect a sustained hold and promote press → hold once.
    if (this.pointerActive && !this.holdFired) {
      if (performance.now() - this.pressStart >= HOLD_THRESHOLD_MS) {
        this.emit("hold", 1);
      }
    }
    // Decay: pulse fast, press slow (afterglow) toward a residual while held.
    this.pulse *= Math.exp(-6 * dt);
    const floor = this.pointerActive ? 1 : 0;
    this.press += (floor - this.press) * Math.min(1, dt * (this.pointerActive ? 8 : 1.6));
    if (!this.pointerActive && this.press < 0.001) this.press = 0;
  }

  /** Effective pointer for shaders, scaled by host influence param. */
  effectivePointer(out: THREE.Vector2): THREE.Vector2 {
    return out.copy(this.pointer).multiplyScalar(this.influence);
  }
}
