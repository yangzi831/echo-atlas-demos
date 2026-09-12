/**
 * Stellar Synth — 上层白线星图构成层
 * ==================================
 * 忠于参考图：多层同心/偏心椭圆轨道环、跨画面连接线、节点星。
 * 轨道差速自转，连接线与节点随音频（mid/high/beat/drone）激活。
 */

import * as THREE from "three";
import type { AudioFrame } from "./config";

const NODES: [number, number, number][] = [
  [-19, -8, 0],
  [5, 8, 0],
  [23, 21, 0],
  [35, -3, 0],
  [-3, 33, 0],
  [-31, 12, 0],
  [13, -23, 0],
  [51, 25, 0],
  [-46, 30, 0],
  [44, -28, 0],
  [-8, -40, 0],
  [62, 8, 0],
  [-58, -14, 0],
  [18, 46, 0],
  [-30, -30, 0],
];

const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 7],
  [0, 4],
  [4, 7],
  [5, 0],
  [0, 6],
  [6, 3],
  [3, 7],
  [5, 2],
  [8, 5],
  [8, 4],
  [9, 3],
  [9, 11],
  [10, 6],
  [10, 14],
  [11, 7],
  [12, 5],
  [12, 8],
  [13, 4],
  [13, 2],
  [14, 0],
  [14, 10],
  [6, 9],
];

interface OrbitLine {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  baseOpacity: number;
}

export class StarChartLayer {
  readonly group: THREE.Group;
  private orbits: OrbitLine[] = [];
  private conMat: THREE.LineBasicMaterial;
  private nodeMat: THREE.PointsMaterial;
  private disposables: { dispose(): void }[] = [];
  /** 节拍冲量包络（0..1），随 beat 触发、随时间衰减，驱动轨道弹跳 */
  private beatEnv = 0;

  constructor(glowTex: THREE.Texture, ink: number) {
    this.group = new THREE.Group();

    const orbitDefs: [number, number, number, number, number][] = [
      [37, 21, -0.22, 0, 0.52],
      [52, 31, 0.16, 0, 0.28],
      [67, 39, -0.58, 2, 0.18],
      [18, 13, 0.12, -8, 0.58],
      [25, 15, -0.45, 24, 0.31],
      [41, 27, 0.67, 8, 0.38],
      [78, 48, 0.34, -4, 0.14],
      [30, 46, -0.9, 6, 0.24],
      [58, 20, 1.1, -14, 0.22],
      [12, 20, 0.5, 18, 0.44],
      [88, 34, -0.15, 10, 0.1],
    ];
    for (const [rx, ry, rot, y, op] of orbitDefs) {
      this.orbits.push(this.makeEllipse(rx, ry, rot, y, op, ink));
    }

    // 连接线
    const seg: number[] = [];
    for (const [a, b] of EDGES) seg.push(...NODES[a], ...NODES[b]);
    const conGeo = new THREE.BufferGeometry();
    conGeo.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    this.conMat = new THREE.LineBasicMaterial({
      color: ink,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });
    const con = new THREE.LineSegments(conGeo, this.conMat);
    this.group.add(con);
    this.disposables.push(conGeo, this.conMat);

    // 节点星
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(NODES.flat(), 3),
    );
    this.nodeMat = new THREE.PointsMaterial({
      map: glowTex,
      size: 2.3,
      color: ink,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.group.add(new THREE.Points(nodeGeo, this.nodeMat));
    this.disposables.push(nodeGeo, this.nodeMat);
  }

  private makeEllipse(
    rx: number,
    ry: number,
    rot: number,
    y: number,
    op: number,
    ink: number,
  ): OrbitLine {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      const x = Math.cos(t) * rx;
      const yy = Math.sin(t) * ry;
      pts.push(
        new THREE.Vector3(
          x * Math.cos(rot) - yy * Math.sin(rot),
          x * Math.sin(rot) + yy * Math.cos(rot) + y,
          0,
        ),
      );
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: ink,
      transparent: true,
      opacity: op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    this.group.add(line);
    this.disposables.push(geo, mat);
    return { line, mat, baseOpacity: op };
  }

  update(dt: number, audio: AudioFrame, hold: number, weight: number): void {
    const mid = audio.mid * weight;
    const high = audio.high * weight;
    const beat = audio.beat * weight;
    // 节拍冲量：beat 抬升包络，随时间快速衰减 —— 驱动轨道随拍弹跳/点亮
    this.beatEnv = Math.max(this.beatEnv - dt * 3.4, beat);
    const bounce = this.beatEnv;
    this.orbits.forEach((o, i) => {
      // 更大动态：基础转速提高，并叠加 mid 驱动的加速
      o.line.rotation.z += dt * (i % 2 ? -1 : 1) * (0.05 + i * 0.006 + mid * 0.06);
      // 随拍弹跳：每圈相位错开，节拍时整体轻微缩放呼吸
      const s = 1 + bounce * (0.05 + (i % 3) * 0.02) + audio.bass * weight * 0.03;
      o.line.scale.setScalar(s);
      o.mat.opacity = 0.12 + i * 0.03 + mid * 0.26 + hold * 0.2 + bounce * 0.32;
    });
    this.conMat.opacity = 0.16 + mid * 0.4 + hold * 0.3 + bounce * 0.28;
    this.nodeMat.size = 2.1 + high * 2.2 + bounce * 3.6;
    this.nodeMat.opacity = 0.58 + high * 0.38 + hold * 0.16 + bounce * 0.24;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
