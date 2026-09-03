import * as THREE from 'three';
import { BaseThreeScene, seededRandom } from './BaseThreeScene';
import type { ReactiveVisualFeatures } from './types';

const ringVertex = `
  uniform float uTime;
  uniform float uBass;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float angle = atan(pos.y, pos.x);
    pos.z += sin(angle * 12.0 + uTime * 1.8) * uBass * 0.16;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const ringFragment = `
  uniform float uTime;
  uniform float uMid;
  uniform float uHigh;
  uniform float uResidue;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 centered = vUv - 0.5;
    float radius = length(centered) * 2.0;
    float angle = atan(centered.y, centered.x);
    float grain = hash(floor(vUv * 800.0) + floor(uTime * 2.0));
    float tracks = smoothstep(0.28, 0.78, sin(radius * (460.0 + uMid * 80.0)) * 0.5 + 0.5);
    float cut = smoothstep(0.012, 0.03, abs(radius - 0.55));
    float edge = smoothstep(0.98, 0.9, radius) * smoothstep(0.42, 0.48, radius);
    float shimmer = step(0.985 - uHigh * 0.02, hash(vec2(angle * 30.0, floor(uTime * 7.0))));
    vec3 ink = vec3(0.035, 0.08, 0.09);
    vec3 paper = vec3(0.74, 0.91, 0.88);
    vec3 color = mix(ink, paper, tracks * 0.78 + grain * 0.12 + shimmer);
    gl_FragColor = vec4(color, edge * cut * (0.58 + tracks * 0.34) * uResidue);
  }
`;

export class ArchiveScene extends BaseThreeScene {
  private core!: THREE.Mesh;
  private ring!: THREE.Mesh;
  private archiveDust!: THREE.Points;
  private ringMaterial!: THREE.ShaderMaterial;
  private targetRotation = new THREE.Vector2(0.35, 0.15);

  protected createCamera() {
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 320);
    camera.position.set(0, 4, 34);
    return camera;
  }

  protected build() {
    this.renderer.toneMappingExposure = 0.88;
    const coreGeometry = new THREE.SphereGeometry(5.3 + this.profile.loudness * 1.3, 72, 72);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: '#c7d4cf', roughness: 0.88, metalness: 0.04,
      emissive: '#174146', emissiveIntensity: 0.14 + this.profile.centroid * 0.18,
      transparent: true,
    });
    this.core = new THREE.Mesh(coreGeometry, coreMaterial);
    this.scene.add(this.core);

    this.ringMaterial = new THREE.ShaderMaterial({
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      uniforms: {
        uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 },
        uHigh: { value: 0 }, uResidue: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(7.2, 17.5 + this.profile.rhythm * 2.5, 220, 24), this.ringMaterial);
    this.ring.rotation.x = Math.PI / 2;
    this.scene.add(this.ring);

    const random = seededRandom(this.profile.seed);
    const count = 16000;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - 0.5) * 150;
      positions[index * 3 + 1] = (random() - 0.5) * 105;
      positions[index * 3 + 2] = -35 - random() * 125;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.archiveDust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
      color: '#9dd8d2', size: 0.1, transparent: true, opacity: 0.28, depthWrite: false,
    }));
    this.scene.add(this.archiveDust);

    this.scene.add(new THREE.AmbientLight('#d7e3dd', 0.16));
    const key = new THREE.DirectionalLight('#e8f5ec', 2.7);
    key.position.set(14, 12, 10);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#4ca8b1', 0.72);
    rim.position.set(-12, -5, -8);
    this.scene.add(rim);
    this.scene.rotation.set(0.35, 0.15, -0.45);
  }

  update = (delta: number, elapsed: number, audio: ReactiveVisualFeatures, residue: number) => {
    this.ringMaterial.uniforms.uTime.value = elapsed;
    this.ringMaterial.uniforms.uBass.value = audio.bass;
    this.ringMaterial.uniforms.uMid.value = audio.mid;
    this.ringMaterial.uniforms.uHigh.value = audio.high;
    this.ringMaterial.uniforms.uResidue.value = residue;
    this.core.rotation.y += delta * (0.07 + audio.mid * 0.12);
    this.ring.rotation.z -= delta * (0.07 + audio.volume * 0.32);
    const scale = 1 + audio.volume * 0.14 + audio.beat * 0.08;
    this.ring.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    this.archiveDust.rotation.y -= delta * (0.01 + audio.bass * 0.025);
    this.targetRotation.set(0.35 - this.pointer.y * 0.055, 0.15 + this.pointer.x * 0.055);
    this.scene.rotation.x += (this.targetRotation.x - this.scene.rotation.x) * 0.04;
    this.scene.rotation.y += (this.targetRotation.y - this.scene.rotation.y) * 0.04;
    (this.archiveDust.material as THREE.PointsMaterial).opacity = (0.2 + audio.volume * 0.34) * residue;
    (this.core.material as THREE.MeshStandardMaterial).opacity = residue;
    this.render();
  };
}
