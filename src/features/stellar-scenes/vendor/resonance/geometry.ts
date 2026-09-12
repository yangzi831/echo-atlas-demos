import * as THREE from "three";

// Geometry builders for the Resonance Axis scene.
// Rings = many concentric line loops (the hero, fine lines); filaments =
// continuous thin line strands winding between rings; cylinder = a wireframe
// tube tunnel core at the center. Everything is thin luminous line work.

export interface RingStation {
  /** base X position along the horizontal axis */
  x: number;
  /** number of concentric rings at this station */
  count: number;
  /** base radius */
  radius: number;
  /** distance from center 0..1 (for depth shading) */
  depth: number;
  /** phase seed */
  seed: number;
}

/** Spacing between ring stations along the axis. */
export const AXIS_SPACING = 5.0;
/** Total wrap span used by the shader for the seamless conveyor loop. */
export function axisSpan(ringCount: number): number {
  return ringCount * AXIS_SPACING;
}

/** Distribute ring stations evenly along the horizontal axis (a wide belt). */
export function buildStations(ringCount: number): RingStation[] {
  const stations: RingStation[] = [];
  // Lay out stations across a wide belt so the structure fills the whole
  // width instead of clumping in the center. The shader wraps X by the span
  // to create a seamless right→left marching loop.
  const half = Math.floor(ringCount / 2);
  for (let i = -half; i <= half; i++) {
    // depth varies per-station (decoupled from screen position) so the belt
    // stays visually rich all the way across, not one central clump
    const depth = 0.22 + 0.5 * Math.abs(Math.sin(i * 1.7));
    const big = ((i % 3) + 3) % 3 === 0;
    stations.push({
      x: i * AXIS_SPACING,
      count: big ? 22 : Math.max(10, 18 - Math.floor(depth * 6)),
      radius: (big ? 6.0 : 4.6) - depth * 1.4,
      depth,
      seed: i * 12.9898,
    });
  }
  return stations;
}

const RING_SEGMENTS = 260;

/**
 * All concentric ring loops as LineSegments. Rings are tightly nested and
 * thin, giving the crisp geometric line beauty of the reference.
 */
export function buildRingGeometry(stations: RingStation[]): {
  geometry: THREE.BufferGeometry;
} {
  const positions: number[] = [];
  const aParams: number[] = []; // baseRadius, angle, stationX, depth
  const aRing: number[] = []; // ringT(0..1), seed, stationIndex

  stations.forEach((st, si) => {
    for (let r = 0; r < st.count; r++) {
      // tightly packed concentric rings
      const baseR = st.radius * (0.12 + (r / st.count) * 0.92);
      for (let s = 0; s < RING_SEGMENTS; s++) {
        const a0 = (s / RING_SEGMENTS) * Math.PI * 2;
        const a1 = ((s + 1) / RING_SEGMENTS) * Math.PI * 2;
        for (const a of [a0, a1]) {
          positions.push(0, Math.cos(a) * baseR, Math.sin(a) * baseR);
          aParams.push(baseR, a, st.x, st.depth);
          aRing.push(r / st.count, st.seed + r * 3.17, si);
        }
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("aParams", new THREE.Float32BufferAttribute(aParams, 4));
  geometry.setAttribute("aRing", new THREE.Float32BufferAttribute(aRing, 3));
  return { geometry };
}

/** Very fine point shimmer scattered on the rings (high-frequency sparkle). */
export function buildPointGeometry(stations: RingStation[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const aParams: number[] = [];
  const aRnd: number[] = [];
  stations.forEach((st) => {
    const n = Math.floor(140 * (1 - st.depth * 0.55));
    for (let i = 0; i < n; i++) {
      const rIdx = Math.floor(Math.random() * st.count);
      const ringR = st.radius * (0.12 + (rIdx / st.count) * 0.92);
      const a = Math.random() * Math.PI * 2;
      positions.push(0, Math.cos(a) * ringR, Math.sin(a) * ringR);
      aParams.push(ringR, a, st.x, st.depth);
      aRnd.push(Math.random(), Math.random());
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("aParams", new THREE.Float32BufferAttribute(aParams, 4));
  g.setAttribute("aRnd", new THREE.Float32BufferAttribute(aRnd, 2));
  return g;
}

/**
 * Filament strands rendered as continuous thin LINE segments (not points),
 * evoking the fine luminous threads winding between rings in the reference.
 * Each strand is emitted as consecutive line segments (vertex pairs).
 */
export function buildFilamentGeometry(ringCount: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const aParams: number[] = []; // t along filament, radius, angleOffset, baseX
  const aRnd: number[] = []; // rnd, depth
  const STREAMS = 320;
  const PER = 40; // segments per strand → smooth continuous line
  const span = ringCount * 5.0; // AXIS_SPACING
  for (let f = 0; f < STREAMS; f++) {
    const angle = Math.random() * Math.PI * 2;
    const swirl = (Math.random() - 0.5) * 3.0;
    const radBase = 0.5 + Math.random() * 4.6;
    const depth = Math.random();
    const rnd = Math.random();
    // spread strand base positions across the whole belt (not the center)
    const baseX = (Math.random() - 0.5) * span;
    const push = (t: number) => {
      positions.push(0, 0, 0); // computed in shader
      aParams.push(t, radBase, angle + swirl * t, baseX);
      aRnd.push(rnd, depth);
    };
    for (let p = 0; p < PER; p++) {
      // one segment = two vertices (p, p+1)
      push(p / PER);
      push((p + 1) / PER);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("aParams", new THREE.Float32BufferAttribute(aParams, 4));
  g.setAttribute("aRnd", new THREE.Float32BufferAttribute(aRnd, 2));
  return g;
}

/** Central wireframe cylinder — the tunnel core. */
export function buildCylinder(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(2.8, 2.8, 6.4, 96, 44, true);
  geo.rotateZ(Math.PI / 2); // lay it along the X axis
  return geo;
}
