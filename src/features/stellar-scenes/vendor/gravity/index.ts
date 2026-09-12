/**
 * Stellar Synth — visual engine public entry point.
 *
 * Import everything the host "Stellar Synth" system needs from here:
 *
 *   import { StellarScene, DEFAULT_CONFIG } from "@/lib/stellar-engine";
 *   import type { StellarSceneApi, AudioFrame } from "@/lib/stellar-engine";
 *
 * Module map:
 *   - scene.ts                   -> StellarScene (Scene + Renderer + loop + resize)
 *   - particle-system.ts         -> ParticleSystem (curl-noise vortex flow field)
 *   - audio-analyser.ts          -> AudioAnalyser (Web Audio file/mic analysis)
 *   - audio-reactive-mapping.ts  -> mapAudioToVisual (audio -> visual drive)
 *   - interaction-controller.ts  -> tap / press / hold / release / pointer
 *   - config.ts / types.ts       -> tunable Config + Parameters + contracts
 */
export { StellarScene } from "./scene";
export { ParticleSystem } from "./particle-system";
export { AudioAnalyser, mockAudioFrame } from "./audio-analyser";
export { InteractionController } from "./interaction-controller";
export { mapAudioToVisual } from "./audio-reactive-mapping";
export type { VisualDrive } from "./audio-reactive-mapping";
export { DEFAULT_CONFIG, mergeConfig } from "./config";
export type {
  AudioFrame,
  AudioFramePatch,
  AudioGain,
  AudioSourceKind,
  EngineConfig,
  EngineState,
  StellarSceneApi,
} from "./types";
