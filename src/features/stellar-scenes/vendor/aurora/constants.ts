// Aurora Core — instrument tuning constants.
// The single source of truth for gesture thresholds, musical material, and the
// finite set of pattern variants. Both audio and visual engines read the shared
// state these values shape — nothing is driven by an audio spectrum.

/** Global tempo (experimental electronic, on the faster side). */
export const DEFAULT_BPM = 128;

/** 16 sixteenth-note steps per bar. */
export const STEPS_PER_BAR = 16;

/** Gesture timing thresholds (ms). */
export const GESTURE = {
  /** Below this, a down→up is a Tap (short transient). */
  tapMax: 180,
  /** At/above this, a sustained press becomes a Hold. */
  holdEnter: 350,
  /** Release phrase + residue decay window (ms). */
  releaseDecay: 2200,
} as const;

/** Instrument lifecycle mode. */
export type InstrumentMode = "idle" | "press" | "hold" | "release";

/**
 * The shared state. This is the ONLY authority. The transport advances it,
 * gestures mutate it, and both engines read it every frame.
 */
export interface SharedState {
  bpm: number;
  beat: number; // 1..4
  bar: number; // 1..n
  step: number; // 1..16
  energy: number; // 0..1 intensity envelope
  scene: number; // 0..3 layered progression
  holdDuration: number; // ms held so far
  releaseAmount: number; // 0..1 remaining decay
  patternVariant: number; // index into PATTERN_VARIANTS
  isDown: boolean;
  mode: InstrumentMode;
}

export function createSharedState(): SharedState {
  return {
    bpm: DEFAULT_BPM,
    beat: 1,
    bar: 1,
    step: 1,
    energy: 0.2,
    scene: 0,
    holdDuration: 0,
    releaseAmount: 0,
    patternVariant: 0,
    isDown: false,
    mode: "idle",
  };
}

// --- Musical material ------------------------------------------------------
// A fixed scale keeps the result musical: intense but never harsh, never fully
// random. Dorian-ish minor pentatonic + a color tone, centered around A.

/** Root note names for arpeggiator / phrases, low → high across octaves. */
export const SCALE_NOTES = [
  "A2",
  "C3",
  "D3",
  "E3",
  "G3",
  "A3",
  "C4",
  "D4",
  "E4",
  "G4",
  "A4",
  "C5",
  "E5",
] as const;

/** Drone root layers (fifths) for the sustained bed. */
export const DRONE_NOTES = ["A1", "E2", "A2"] as const;

/**
 * A finite set of pattern variants. Every 1–2 bars the transport advances to a
 * neighbouring variant, so the music evolves in small steps — never mechanical
 * repetition, never fully random. Each variant tweaks step density, the
 * arpeggio index sequence, and the note subdivision feel.
 */
export interface PatternVariant {
  id: string;
  /** Which of the 16 steps fire an arp note (true = play). */
  steps: boolean[];
  /** Scale-degree offsets walked across the SCALE_NOTES array. */
  sequence: number[];
  /** Note length as a Tone.js duration. */
  noteLength: string;
}

const S = (bits: string) => bits.split("").map((c) => c === "1");

export const PATTERN_VARIANTS: PatternVariant[] = [
  {
    id: "A",
    steps: S("1000100010001010"),
    sequence: [0, 2, 4, 5, 4, 2],
    noteLength: "16n",
  },
  {
    id: "B",
    steps: S("1010001010100010"),
    sequence: [0, 3, 5, 7, 5, 3, 2],
    noteLength: "16n",
  },
  {
    id: "C",
    steps: S("1010101010101010"),
    sequence: [0, 4, 7, 9, 7, 5, 4, 2],
    noteLength: "32n",
  },
  {
    id: "D",
    steps: S("1011001010110010"),
    sequence: [2, 5, 7, 9, 11, 9, 7, 5],
    noteLength: "16n",
  },
];

export const VARIANT_COUNT = PATTERN_VARIANTS.length;
