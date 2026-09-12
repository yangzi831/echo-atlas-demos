/**
 * Stellar Synth — 视觉引擎类型定义
 * ================================
 * 这些是引擎对外暴露的核心契约类型，供你的「星宿合成器」宿主接入时使用。
 */

/**
 * 标准化音频帧。所有字段均归一化到 0–1 区间。
 * 你的音频系统只需产出这个结构，即可驱动整个视觉场景。
 */
export interface AudioFrame {
  /** 整体能量 / 响度 —— 控制整体亮度、粒子活跃度、场域能量 */
  amplitude: number;
  /** 低频 / 贝斯 —— 控制核心膨胀、大尺度脉冲、旋涡牵引、云团起伏 */
  bass: number;
  /** 中频 —— 控制中层结构变化、粒子群组织、星图连接激活 */
  mid: number;
  /** 高频 —— 控制细小闪烁、微粒跳动、星尘亮点、边缘扰动 */
  high: number;
  /** 节拍脉冲（瞬时冲量，0–1，会自然衰减）—— 控制环形扩散、局部激活 */
  beat: number;
  /** 持续音 / drone —— 控制持续旋转、结构缓慢展开、空间张力累积 */
  drone: number;
}

/** 交互输入类型 —— 便于宿主的演奏系统注入 */
export type InteractionKind = "tap" | "press" | "hold" | "release";

/** 归一化指针坐标（-1..1，中心为 0） */
export interface PointerNDC {
  x: number;
  y: number;
}

/** 各视觉层的音频响应权重（0 = 不响应，1 = 完全响应） */
export interface LayerWeights {
  /** 底层粒子星云流场权重 */
  nebula: number;
  /** 上层白线星图构成权重 */
  chart: number;
  /** 中心引力核心权重 */
  core: number;
}

/** 引擎完整配置。所有参数集中于此，可在初始化时传入或运行时用 setConfig 覆写。 */
export interface EngineConfig {
  /** 主色调（十六进制数值），来自设计 token */
  colors: { background: number; ink: number; muted: number };
  /** 粒子数量（移动端 / 桌面端会自动取一档） */
  particleCount: number;
  /** 各层音频响应权重 */
  weights: LayerWeights;
  /** 鼠标视差强度 */
  parallax: number;
  /** 音频包络平滑系数（attack-release），越小越平滑 */
  audioSmoothing: number;
  /** 交互 hold 的上升 / 回落速度 */
  holdAttack: number;
  holdRelease: number;
  /** 中心引力核的整体亮度系数（0 = 关闭亮核，1 = 原始亮度） */
  coreGlow: number;
  /** 设备像素比上限（性能） */
  maxPixelRatio: number;
  /** 是否遵循 prefers-reduced-motion */
  respectReducedMotion: boolean;
}

/** 默认配置（桌面基线）。可被外部部分覆写。 */
export function defaultConfig(): EngineConfig {
  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 700;
  return {
    colors: { background: 0x060608, ink: 0xf0f2f6, muted: 0x8a93a6 },
    particleCount: isMobile ? 34000 : 60000,
    weights: { nebula: 0.7, chart: 1, core: 1 },
    parallax: 0.11,
    audioSmoothing: 0.08,
    holdAttack: 2.8,
    holdRelease: 1.7,
    coreGlow: 0.22,
    maxPixelRatio: 2,
    respectReducedMotion: true,
  };
}

/** 中性静止音频帧（无声音输入时的基线） */
export function idleAudioFrame(): AudioFrame {
  return { amplitude: 0.18, bass: 0.14, mid: 0.2, high: 0.14, beat: 0, drone: 0.3 };
}
