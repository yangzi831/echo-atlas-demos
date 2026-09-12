/**
 * Stellar Synth — 音频响应映射
 * ============================
 * 把标准化 AudioFrame 做时间平滑（attack-release 包络），并派生出
 * 供各视觉层消费的复合量（energy、spin 等）。这是「音频 → 视觉参数」的中枢。
 *
 * 各字段映射意图（在各视觉层内实现具体响应）：
 *   amplitude → 整体亮度 / 粒子活跃度 / 场域能量
 *   bass      → 核心膨胀 / 旋涡牵引 / 云团起伏
 *   mid       → 中层结构 / 流线重组 / 星图连接激活
 *   high      → 细小闪烁 / 星尘亮点 / 边缘扰动
 *   beat      → 环形脉冲扩散 / 局部激活
 *   drone     → 持续旋转 / 结构缓慢展开 / 空间张力
 */

import type { AudioFrame, EngineConfig } from "./config";
import { idleAudioFrame } from "./config";

export class AudioReactiveMapping {
  /** 当前平滑后的音频帧（对外可读） */
  readonly smoothed: AudioFrame = idleAudioFrame();

  constructor(private cfg: EngineConfig) {}

  /**
   * 用目标帧更新平滑帧。beat 用更快的响应以保留冲击感。
   * @param target 本帧的原始音频帧（真实分析或模拟）
   * @param dt     帧间隔（秒）
   */
  ingest(target: AudioFrame, dt: number): void {
    const s = this.smoothed;
    const k = this.cfg.audioSmoothing;
    s.amplitude += (target.amplitude - s.amplitude) * k;
    s.bass += (target.bass - s.bass) * k;
    s.mid += (target.mid - s.mid) * k;
    s.high += (target.high - s.high) * k;
    s.drone += (target.drone - s.drone) * k;
    // beat 快速跟随 + 自然衰减
    s.beat = Math.max(s.beat * (1 - dt * 3.2), target.beat);
  }

  /** 整体能量（叠加交互 hold 贡献） */
  energy(hold: number): number {
    return this.smoothed.amplitude + hold * 0.28;
  }

  /** 场景自转速度（drone + hold 累积） */
  spin(hold: number): number {
    return 0.03 + this.smoothed.drone * 0.05 + hold * 0.07;
  }
}
