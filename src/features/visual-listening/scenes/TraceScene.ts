import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BaseThreeScene, seededRandom } from './BaseThreeScene';
import type { ReactiveVisualFeatures } from './types';

const vertexShader = `
  uniform float uTime;
  uniform float uPhase;
  uniform float uBass;
  uniform float uHigh;
  uniform float uVolume;
  uniform float uResidue;
  attribute float aSize;
  attribute float aKind;
  attribute float aRandom;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    vec3 pos = position;
    if (aKind < 0.5) {
      float radius = length(pos.xz);
      float angle = atan(pos.z, pos.x) - uPhase / (sqrt(radius) * 0.16 + 0.8);
      float breath = sin(radius * 0.04 - uTime * 1.6 + aRandom * 5.0);
      float expanded = radius + breath * uBass * 18.0 + uVolume * 4.0;
      pos.x = cos(angle) * expanded;
      pos.z = sin(angle) * expanded;
      pos.y += sin(angle * 3.0 + uTime + aRandom * 8.0) * (0.8 + uBass * 5.0);
    } else {
      pos += normalize(pos + vec3(0.001)) * sin(uTime * 4.0 + aRandom * 18.0) * uBass * 1.5;
    }
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float sparkle = step(0.84, aRandom) * uHigh;
    gl_PointSize = (aSize + sparkle * 2.8) * (330.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
    vAlpha = (0.2 + aRandom * 0.5) * (0.6 + uVolume * 0.9) * uResidue;
    vHeat = smoothstep(-30.0, 45.0, pos.y) + sparkle;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float glow = pow(1.0 - d * 2.0, 1.35);
    vec3 cold = vec3(0.46, 0.86, 0.91);
    vec3 warm = vec3(0.94, 0.78, 0.52);
    vec3 color = mix(cold, warm, clamp(vHeat * 0.48, 0.0, 1.0));
    gl_FragColor = vec4(color, glow * vAlpha);
  }
`;

export class TraceScene extends BaseThreeScene {
  private material!: THREE.ShaderMaterial;
  private particles!: THREE.Points;
  private controls!: OrbitControls;
  private phase = 0;

  protected createCamera() {
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1800);
    camera.position.set(0, 72, 295);
    return camera;
  }

  protected build() {
    this.scene.fog = new THREE.FogExp2('#030708', 0.0019);
    const random = seededRandom(this.profile.seed);
    const count = 52000;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const kinds = new Float32Array(count);
    const randoms = new Float32Array(count);
    const clusterRadius = 17 + this.profile.loudness * 24;
    const clusterCenter = new THREE.Vector3(-68 + this.profile.age * 44, this.profile.centroid * 18, 42);
    const clusterCount = 6500 + Math.floor(this.profile.rhythm * 6500);

    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      if (index < clusterCount) {
        const direction = new THREE.Vector3().randomDirection();
        const radius = Math.cbrt(random()) * clusterRadius;
        positions[offset] = clusterCenter.x + direction.x * radius;
        positions[offset + 1] = clusterCenter.y + direction.y * radius;
        positions[offset + 2] = clusterCenter.z + direction.z * radius;
        kinds[index] = 1;
      } else {
        const selector = random();
        const radius = selector < 0.34 ? 34 + random() * 48 : selector < 0.78 ? 90 + random() * 98 : 205 + random() * 165;
        const angle = random() * Math.PI * 2;
        positions[offset] = Math.cos(angle) * radius;
        positions[offset + 1] = (random() - 0.5) * (650 / radius);
        positions[offset + 2] = Math.sin(angle) * radius;
      }
      sizes[index] = 0.32 + random() * (1.05 + this.profile.centroid * 0.5);
      randoms[index] = random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uPhase: { value: 0 }, uBass: { value: 0 },
        uHigh: { value: 0 }, uVolume: { value: 0 }, uResidue: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geometry, this.material);
    this.scene.add(this.particles);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 86;
    this.controls.maxDistance = 540;
  }

  update = (delta: number, elapsed: number, audio: ReactiveVisualFeatures, residue: number) => {
    this.phase += delta * (0.2 + audio.volume * 0.85 + this.profile.rhythm * 0.08);
    this.material.uniforms.uTime.value = elapsed;
    this.material.uniforms.uPhase.value = this.phase;
    this.material.uniforms.uBass.value = audio.bass;
    this.material.uniforms.uHigh.value = audio.high;
    this.material.uniforms.uVolume.value = audio.volume;
    this.material.uniforms.uResidue.value = residue;
    this.particles.rotation.z = Math.sin(elapsed * 0.08) * 0.035;
    this.controls.update();
    this.render();
  };

  protected disposeExtras() {
    this.controls.dispose();
  }
}
