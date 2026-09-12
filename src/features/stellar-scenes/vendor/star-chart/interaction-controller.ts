/**
 * Stellar Synth — 交互控制器
 * ==========================
 * 把指针 / 键盘事件抽象为统一的 tap / press / hold / release，
 * 并维护 hold 的 attack-release 包络（松开后缓慢回落，产生余辉）。
 * 也暴露方法供宿主的演奏系统直接注入交互。
 */

import type { EngineConfig, PointerNDC } from "./config";

export interface InteractionCallbacks {
  /** tap：在归一化坐标处触发一次脉冲 */
  onTap: (pointer: PointerNDC) => void;
}

export class InteractionController {
  readonly pointer: PointerNDC = { x: 0, y: 0 };
  private pressed = false;
  /** hold 包络值（0..~1.x），持续按压时上升，松开后回落 */
  hold = 0;

  constructor(
    private el: HTMLElement,
    private cfg: EngineConfig,
    private cb: InteractionCallbacks,
  ) {}

  private handleMove = (e: PointerEvent) => this.setPointerFromEvent(e);
  private handleDown = (e: PointerEvent) => {
    this.pressed = true;
    this.setPointerFromEvent(e);
    this.cb.onTap({ ...this.pointer });
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };
  private handleUp = () => {
    this.pressed = false;
  };

  attach(): void {
    this.el.addEventListener("pointermove", this.handleMove, { passive: true });
    this.el.addEventListener("pointerdown", this.handleDown, { passive: true });
    (["pointerup", "pointercancel", "pointerleave"] as const).forEach((n) =>
      this.el.addEventListener(n, this.handleUp, { passive: true }),
    );
  }

  detach(): void {
    this.el.removeEventListener("pointermove", this.handleMove);
    this.el.removeEventListener("pointerdown", this.handleDown);
    (["pointerup", "pointercancel", "pointerleave"] as const).forEach((n) =>
      this.el.removeEventListener(n, this.handleUp),
    );
  }

  private setPointerFromEvent(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  }

  /** 每帧推进 hold 包络 */
  step(dt: number): void {
    const rate = this.pressed ? this.cfg.holdAttack : this.cfg.holdRelease;
    const targetDelta = this.pressed ? 1 : -this.hold;
    this.hold += targetDelta * dt * rate;
    this.hold = Math.max(0, this.hold);
  }

  /** 把归一化指针转成世界坐标（供脉冲发射定位） */
  pointerToWorld(): { x: number; y: number } {
    return { x: this.pointer.x * 48, y: this.pointer.y * 75 };
  }

  // ---- 供宿主演奏系统注入的接口 ----
  externalPress(): void {
    this.pressed = true;
  }
  externalRelease(): void {
    this.pressed = false;
  }
  externalHold(v = 1): void {
    this.hold = Math.max(this.hold, v);
  }
}
