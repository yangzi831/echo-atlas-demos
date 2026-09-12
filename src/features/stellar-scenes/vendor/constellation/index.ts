/**
 * Stellar Synth · Visual Engine — public module barrel.
 *
 * Import everything a host integration needs from here:
 *
 *   import {
 *     StellarSynthEngine,
 *     type AudioFrame,
 *     type EngineParams,
 *     type InteractionEvent,
 *   } from "@/lib/stellar-engine";
 *
 * See README (docs/stellar-synth-integration.md) for the full integration
 * guide, audio-mapping contract, and interaction contract.
 */
export { StellarSynthEngine } from "./engine";
export { AudioReactiveMapping } from "./audio-reactive-mapping";
export { InteractionController } from "./interaction-controller";
export { NebulaField } from "./nebula-field";
export { ParticleSystem } from "./particle-system";
export { Constellation } from "./constellation";
export {
  DEFAULT_PARAMS,
  EMPTY_AUDIO_FRAME,
  type AudioFrame,
  type EngineOptions,
  type EngineParams,
  type InteractionEvent,
  type InteractionType,
} from "./types";
