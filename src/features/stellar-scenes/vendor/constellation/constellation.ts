/**
 * Constellation — the signature layer of the "星宿连线" direction: thin lines
 * forming a star-map relation web. Lines ignite in sequence on beats; mid
 * frequency reorganizes edge brightness. A tap activates a diffusion wave; a
 * hold grows the graph outward.
 *
 * Note: the glowing node points were intentionally removed — the host synth
 * supplies its own star points, so this layer contributes only the connecting
 * lines.
 */
import * as THREE from "three";
import { hexColor, clamp01 } from "./utils";
import type { AudioFrame, EngineParams } from "./types";

interface Edge {
  a: number;
  b: number;
  /** Per-edge phase so beats light edges "in sequence". */
  phase: number;
}

export class Constellation {
  readonly group: THREE.Group;
  private nodes: THREE.Vector3[] = [];
  private edges: Edge[] = [];
  private lineGeo: THREE.BufferGeometry;
  private lineMat: THREE.LineBasicMaterial;
  private lines: THREE.LineSegments;
  /** 0..1 growth of the graph (driven by hold / drone). */
  private growth = 1;
  /** Rolling beat index used to light edges sequentially. */
  private beatCursor = 0;

  // `texture` kept in the signature for engine call compatibility; unused now
  // that node points are removed.
  constructor(params: EngineParams, _texture?: THREE.Texture) {
    void _texture;
    this.group = new THREE.Group();
    this.buildNodes(params.nodeCount);

    const linePos = this.buildLinePositions();
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePos, 3),
    );
    this.lineMat = new THREE.LineBasicMaterial({
      color: hexColor(params.palette.line),
      transparent: true,
      opacity: params.lineOpacity[0],
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(this.lineGeo, this.lineMat);
    this.lines.frustumCulled = false;

    // Lines only — no node points. The host provides its own star points.
    this.group.add(this.lines);
  }

  private buildNodes(nodeCount: number): void {
    this.nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const a = (i / nodeCount) * Math.PI * 2 + (i % 5) * 0.17;
      const r = 5.2 + Math.sin(i * 2.1) * 3.2 + Math.random() * 2.3;
      this.nodes.push(
        new THREE.Vector3(
          Math.cos(a) * r * 1.15,
          Math.sin(a) * r * 0.78,
          (Math.random() - 0.5) * 6,
        ),
      );
    }
    // Build a star-map relation web: ring neighbours plus longer "constellation"
    // chords so the graph reads as intentional structure, not a mesh.
    this.edges = [];
    const n = this.nodes.length;
    for (let i = 0; i < n; i++) {
      this.edges.push({ a: i, b: (i + 1) % n, phase: i / n });
      if (i % 3 === 0) {
        this.edges.push({ a: i, b: (i + 7) % n, phase: ((i + 7) % n) / n });
      }
    }
  }

  private buildLinePositions(): number[] {
    const linePos: number[] = [];
    for (const e of this.edges) {
      linePos.push(...this.nodes[e.a].toArray(), ...this.nodes[e.b].toArray());
    }
    return linePos;
  }

  /**
   * Activate a diffusion wave (tap) or begin growth (hold). Positive `grow`
   * expands the graph; the animation loop eases growth back toward 1.
   */
  activate(grow = 0): void {
    this.beatCursor = (this.beatCursor + 1) % Math.max(1, this.edges.length);
    if (grow > 0) this.growth = Math.min(1.6, this.growth + grow);
  }

  update(
    time: number,
    audio: AudioFrame,
    params: EngineParams,
    pulse: number,
    press: number,
    dt: number,
  ): void {
    // Growth eases back to baseline unless a hold keeps feeding it.
    this.growth += ((1 + press * 0.5 + audio.drone * 0.3) - this.growth) * Math.min(1, dt * 2.2);
    this.group.scale.setScalar(this.growth);

    // Beat cursor advances with the beat so edges light "in sequence".
    if (audio.beat > 0.5) {
      this.beatCursor = (this.beatCursor + 1) % Math.max(1, this.edges.length);
    }

    const [minO, maxO] = params.lineOpacity;
    const beatLit = clamp01(audio.beat + pulse * 0.4);
    const midLit = audio.mid * 0.4;
    this.lineMat.opacity =
      minO + (maxO - minO) * clamp01(beatLit + midLit + press * 0.25);
  }

  applyPalette(params: EngineParams): void {
    this.lineMat.color = hexColor(params.palette.line);
  }

  rebuild(params: EngineParams): void {
    this.buildNodes(params.nodeCount);
    this.lineGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.buildLinePositions(), 3),
    );
  }

  dispose(): void {
    this.lineGeo.dispose();
    this.lineMat.dispose();
  }
}
