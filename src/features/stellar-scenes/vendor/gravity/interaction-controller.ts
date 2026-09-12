/**
 * Stellar Synth — interaction controller.
 *
 * Owns the semantic tap / press / hold / release / pointer state and exposes it
 * as smoothed values the render loop consumes each frame. It is deliberately
 * transport-agnostic: the React layer wires DOM/pointer events into these
 * methods, and the host "Stellar Synth" system can drive the exact same methods
 * from its own performance controls.
 */
export class InteractionController {
  /** Pulse energy 0..1, spikes on tap() and decays each frame. */
  pulse = 0;
  /** Hold energy 0..1, ramps up while pressed, decays on release. */
  holding = 0;
  /** Total taps since mount (used for HUD beat counter). */
  beatCount = 0;

  /** Raw + smoothed normalized pointer, each axis in [-1, 1]. */
  pointer = { x: 0, y: 0, tx: 0, ty: 0, active: 0 };

  private pressed = false;
  private onTap?: () => void;

  constructor(onTap?: () => void) {
    this.onTap = onTap;
  }

  /** Single impulse: spike the pulse and advance the beat counter. */
  tap(): void {
    this.pulse = Math.max(this.pulse, 1);
    this.beatCount++;
    this.onTap?.();
  }

  /** Enter the sustained "charging" state. */
  press(): void {
    this.pressed = true;
  }

  /** Leave the charging state; hold energy decays afterward. */
  release(): void {
    this.pressed = false;
  }

  /** Programmatic hold accumulation (dt in seconds). */
  addHold(dt: number): void {
    this.holding = Math.min(1, this.holding + dt);
  }

  /** Set pointer target from normalized [0,1] coordinates. */
  setPointer(x: number, y: number): void {
    this.pointer.tx = x * 2 - 1;
    this.pointer.ty = 1 - y * 2;
    this.pointer.active = 1;
  }

  /** Set pointer target directly in [-1,1] device coordinates. */
  setPointerNdc(nx: number, ny: number): void {
    this.pointer.tx = nx;
    this.pointer.ty = ny;
    this.pointer.active = 1;
  }

  /**
   * Advance smoothing each frame. Ramps hold toward 1 while pressed and decays
   * pulse + hold otherwise, giving the "afterglow" release the brief promises.
   */
  update(dt: number): void {
    this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.06;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.06;
    this.pulse = Math.max(0, this.pulse - dt * 1.1);
    if (this.pressed) {
      this.holding = Math.min(1, this.holding + dt * 1.6);
    } else {
      // Slow afterglow decay — never snaps to zero.
      this.holding = Math.max(0, this.holding - dt * 0.9);
    }
  }
}
