import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BaseThreeScene, seededRandom } from './BaseThreeScene';
import type { ReactiveVisualFeatures } from './types';

const fieldVertex = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uResidue;
  attribute vec3 aParams;
  varying float vRadius;
  varying float vSpark;
  varying float vResidue;
  void main() {
    float radius = aParams.x;
    float angle = aParams.y;
    float seed = aParams.z;
    float normalized = radius / 76.0;
    float flow = sin(seed * 0.19 + radius * 0.16 + uTime * (0.32 + uHigh * 0.8));
    float spiral = angle + radius * 0.018 + flow * (0.1 + uMid * 0.32) - uTime * 0.035;
    float pulse = 1.0 + sin(radius * 0.11 - uTime * 2.0) * uBass * 0.12;
    vec3 pos = vec3(cos(spiral) * radius * pulse, sin(spiral) * radius * pulse, flow * (2.2 + uMid * 8.0) * normalized);
    pos.xy += vec2(sin(seed), cos(seed * 1.7)) * uHigh * normalized * 1.8;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vRadius = normalized;
    vSpark = step(0.83, fract(seed * 0.618)) * uHigh;
    vResidue = uResidue;
    gl_PointSize = (0.7 + (1.0 - normalized) * 1.4 + vSpark * 3.0) * (60.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const fieldFragment = `
  varying float vRadius;
  varying float vSpark;
  varying float vResidue;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    vec3 core = vec3(0.72, 0.95, 1.0);
    vec3 middle = vec3(0.08, 0.52, 0.9);
    vec3 edge = vec3(0.04, 0.13, 0.2);
    vec3 color = mix(core, middle, smoothstep(0.05, 0.5, vRadius));
    color = mix(color, edge, smoothstep(0.52, 1.0, vRadius));
    color += vec3(0.55, 0.85, 1.0) * vSpark;
    float alpha = pow(1.0 - d * 2.0, 1.25) * (0.25 + (1.0 - vRadius) * 0.45 + vSpark) * vResidue;
    gl_FragColor = vec4(color, alpha);
  }
`;

export class FieldScene extends BaseThreeScene {
  private material!: THREE.ShaderMaterial;
  private points!: THREE.Points;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;

  protected createCamera() {
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
    camera.position.z = 48;
    return camera;
  }

  protected build() {
    this.scene.fog = new THREE.FogExp2('#010407', 0.01);
    const random = seededRandom(this.profile.seed);
    const strands = 610 + Math.floor(this.profile.rhythm * 250);
    const pointsPerStrand = 72;
    const count = strands * pointsPerStrand;
    const positions = new Float32Array(count * 3);
    const params = new Float32Array(count * 3);
    for (let strand = 0; strand < strands; strand += 1) {
      const angle = (strand / strands) * Math.PI * 2;
      for (let point = 0; point < pointsPerStrand; point += 1) {
        const index = strand * pointsPerStrand + point;
        params[index * 3] = Math.pow(point / (pointsPerStrand - 1), 1.18 + this.profile.age * 0.18) * 76;
        params[index * 3 + 1] = angle;
        params[index * 3 + 2] = strand + random();
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aParams', new THREE.BufferAttribute(params, 3));
    this.material = new THREE.ShaderMaterial({
      vertexShader: fieldVertex,
      fragmentShader: fieldFragment,
      uniforms: {
        uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 },
        uHigh: { value: 0 }, uResidue: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.rotation.x = -0.18;
    this.scene.add(this.points);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.55, 0.34);
    this.composer.addPass(this.bloom);
  }

  update = (delta: number, elapsed: number, audio: ReactiveVisualFeatures, residue: number) => {
    this.material.uniforms.uTime.value = elapsed;
    this.material.uniforms.uBass.value = audio.bass;
    this.material.uniforms.uMid.value = audio.mid;
    this.material.uniforms.uHigh.value = audio.high;
    this.material.uniforms.uResidue.value = residue;
    this.points.rotation.z -= delta * (0.033 + audio.volume * 0.15);
    this.points.rotation.x += (-0.18 + this.pointer.y * 0.14 - this.points.rotation.x) * 0.035;
    this.points.rotation.y += (this.pointer.x * 0.14 - this.points.rotation.y) * 0.035;
    this.bloom.strength = (0.66 + audio.beat * 0.72 + audio.volume * 0.3) * residue;
    this.composer.render();
  };

  resize(width: number, height: number, pixelRatio: number) {
    super.resize(width, height, pixelRatio);
    this.composer.setPixelRatio(Math.min(pixelRatio, 1.65));
    this.composer.setSize(width, height);
  }

  protected disposeExtras() {
    this.composer.dispose();
  }
}
