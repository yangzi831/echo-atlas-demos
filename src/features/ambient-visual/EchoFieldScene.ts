import * as THREE from 'three';
import type { SoundMemory } from '../../types/sound';
import type { EchoFieldInput } from './types';

const TAU = Math.PI * 2;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0) / 4294967295;
};

const fieldVertex = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uCentroid;
  uniform float uActivity;
  uniform float uTransient;
  attribute float aSeed;
  attribute float aDepth;
  varying float vDepth;
  varying float vSeed;
  void main() {
    float angle = aSeed * 6.2831853 + uTime * (0.018 + aDepth * 0.025);
    float radius = 8.0 + aDepth * 24.0 + sin(aSeed * 31.0 + uTime * 0.22) * (1.1 + uEnergy * 3.0);
    float braid = sin(angle * 3.0 + aSeed * 19.0 - uTime * 0.13) * (2.0 + uActivity * 9.0);
    float vertical = sin(angle * 2.0 + aSeed * 13.0) * (1.4 + uCentroid * 5.0);
    vec3 pos = vec3(cos(angle) * radius + braid, vertical + sin(aSeed * 47.0) * 3.0, sin(angle) * radius * 0.54);
    pos.x += sin(uTime * 0.19 + aSeed * 23.0) * uActivity * 2.0;
    pos.y += cos(uTime * 0.27 + aSeed * 17.0) * uTransient * 2.8;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vDepth = aDepth;
    vSeed = aSeed;
    gl_PointSize = (0.75 + (1.0 - aDepth) * 1.35 + uTransient * step(0.78, fract(aSeed * 91.0)) * 2.6) * (58.0 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fieldFragment = `
  uniform float uEnergy;
  uniform float uWarmth;
  varying float vDepth;
  varying float vSeed;
  void main() {
    float distanceFromCenter = length(gl_PointCoord - 0.5);
    if (distanceFromCenter > 0.5) discard;
    float halo = pow(1.0 - distanceFromCenter * 2.0, 1.4);
    vec3 ice = vec3(0.66, 0.9, 0.92);
    vec3 blue = vec3(0.08, 0.34, 0.48);
    vec3 gold = vec3(0.72, 0.57, 0.32);
    vec3 color = mix(ice, blue, smoothstep(0.1, 0.9, vDepth));
    color = mix(color, gold, uWarmth * step(0.94, fract(vSeed * 17.0)));
    float alpha = halo * (0.12 + (1.0 - vDepth) * 0.44 + uEnergy * 0.22);
    gl_FragColor = vec4(color, alpha);
  }
`;

const makeRing = (radius: number, opacity: number, color: number) => {
  const points: number[] = [];
  const count = 96;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * TAU;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.54, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.LineLoop(geometry, material);
};

export class EchoFieldScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
  private renderer!: THREE.WebGLRenderer;
  private particleMaterial!: THREE.ShaderMaterial;
  private particles!: THREE.Points;
  private nodePoints?: THREE.Points;
  private nodeGroup = new THREE.Group();
  private input: EchoFieldInput = { mode: 'listen-setup' };
  private reducedMotion = false;
  private width = 1;
  private height = 1;

  mount(container: HTMLElement) {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.camera.position.set(0, 0, 54);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x02070b, 0);
    this.renderer.domElement.className = 'ambient-field-webgl';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.buildParticles(window.innerWidth < 720 ? 8500 : 27000);
    this.scene.add(this.nodeGroup);
    this.updateInput(this.input);
  }

  private buildParticles(count: number) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const depths = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const seed = (index * 0.6180339887) % 1;
      const depth = Math.pow((index + 0.5) / count, 0.72);
      positions[index * 3] = 0;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = 0;
      seeds[index] = seed;
      depths[index] = depth;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1));
    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: fieldVertex,
      fragmentShader: fieldFragment,
      uniforms: { uTime: { value: 0 }, uEnergy: { value: 0.18 }, uCentroid: { value: 0.35 }, uActivity: { value: 0.24 }, uTransient: { value: 0 }, uWarmth: { value: 0.24 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geometry, this.particleMaterial);
    this.particles.rotation.x = -0.11;
    this.scene.add(this.particles);
  }

  private updateNodes(memories: SoundMemory[]) {
    this.nodeGroup.traverse((object) => {
      if (object === this.nodeGroup) return;
      const renderable = object as THREE.Mesh;
      renderable.geometry?.dispose();
      const material = renderable.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    });
    this.nodeGroup.clear();
    const visibleMemories = memories.slice(0, 28);
    const positions: number[] = [];
    visibleMemories.forEach((memory, index) => {
      const seed = hash(memory.id);
      const angle = seed * TAU + index * 0.11;
      const radius = 11 + (index % 5) * 4.3 + hash(`${memory.id}:radius`) * 12;
      const x = Math.cos(angle) * radius + Math.sin(seed * 19) * 3;
      const y = Math.sin(angle) * radius * 0.48 + (hash(`${memory.id}:y`) - 0.5) * 6;
      const z = Math.sin(angle) * 7;
      positions.push(x, y, z);
      const ring = makeRing(1.8 + (memory.id === this.input.activeMemoryId ? 1.2 : 0), memory.id === this.input.activeMemoryId ? 0.3 : 0.09, memory.id === this.input.activeMemoryId ? 0xaceff0 : memory.aiJudgement?.reviewStatus === 'pending' ? 0xb99b59 : 0x83c5ce);
      ring.position.set(x, y, z);
      ring.rotation.x = 0.24 + hash(`${memory.id}:tilt`) * 0.5;
      ring.rotation.y = hash(`${memory.id}:tilt-y`) * 0.8;
      this.nodeGroup.add(ring);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xdffbf5, size: 0.72, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false });
    this.nodePoints = new THREE.Points(geometry, material);
    this.nodeGroup.add(this.nodePoints);
  }

  updateInput(input: EchoFieldInput) {
    this.input = input;
    this.updateNodes(input.memories ?? []);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(width, height, false);
  }

  render(delta: number, elapsed: number) {
    if (!this.renderer) return;
    const features = this.input.audioFeatures;
    const rms = clamp(features?.rms ?? 0);
    const peak = clamp(features?.peak ?? 0);
    const centroid = clamp((features?.frequencyCentroid ?? 1800) / 9000);
    const activity = clamp(features?.activityDensity ?? 0.18);
    const transient = clamp(features?.transientDensity ?? 0);
    const continuity = clamp(features?.continuity ?? 0.38);
    const setupEnergy = this.input.mode === 'listen-setup' || this.input.mode === 'memories' || this.input.mode === 'recall-idle' ? 0.2 : 0.12;
    const energy = setupEnergy + rms * 0.72 + peak * 0.12;
    this.particleMaterial.uniforms.uTime.value = elapsed;
    this.particleMaterial.uniforms.uEnergy.value += (energy - this.particleMaterial.uniforms.uEnergy.value) * 0.08;
    this.particleMaterial.uniforms.uCentroid.value += (centroid - this.particleMaterial.uniforms.uCentroid.value) * 0.08;
    this.particleMaterial.uniforms.uActivity.value += ((activity + continuity * 0.3) - this.particleMaterial.uniforms.uActivity.value) * 0.08;
    this.particleMaterial.uniforms.uTransient.value += ((transient + peak * 0.25) - this.particleMaterial.uniforms.uTransient.value) * 0.12;
    this.particleMaterial.uniforms.uWarmth.value = this.input.mode === 'memories' ? 0.45 : this.input.mode.startsWith('recall') ? 0.34 : 0.2;
    if (!this.reducedMotion) {
      this.particles.rotation.z -= delta * (0.012 + activity * 0.035);
      this.particles.rotation.y += delta * 0.004;
      this.nodeGroup.rotation.z -= delta * 0.004;
      this.nodeGroup.rotation.x += (Math.sin(elapsed * 0.17) * 0.025 - this.nodeGroup.rotation.x) * 0.02;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((object) => {
      const renderable = object as THREE.Mesh;
      renderable.geometry?.dispose();
      const material = renderable.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    });
    this.scene.clear();
    this.renderer?.renderLists.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
  }
}
