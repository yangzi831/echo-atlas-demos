import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { AudioFeatures } from '../audio-engine'
import { BaseThreeScene } from './BaseThreeScene'

const mandalaVertex = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  attribute vec3 aParams;
  varying float vRadius;
  varying float vSpark;
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
    gl_PointSize = (0.7 + (1.0 - normalized) * 1.4 + vSpark * 3.0) * (60.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`

const mandalaFragment = `
  varying float vRadius;
  varying float vSpark;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    vec3 core = vec3(0.72, 0.95, 1.0);
    vec3 middle = vec3(0.08, 0.42, 0.95);
    vec3 edge = vec3(0.05, 0.08, 0.18);
    vec3 color = mix(core, middle, smoothstep(0.05, 0.5, vRadius));
    color = mix(color, edge, smoothstep(0.52, 1.0, vRadius));
    color += vec3(0.55, 0.85, 1.0) * vSpark;
    float alpha = pow(1.0 - d * 2.0, 1.25) * (0.28 + (1.0 - vRadius) * 0.48 + vSpark);
    gl_FragColor = vec4(color, alpha);
  }
`

export class MandalaFlowScene extends BaseThreeScene {
  private material!: THREE.ShaderMaterial
  private points!: THREE.Points
  private composer!: EffectComposer
  private bloom!: UnrealBloomPass

  protected createCamera() {
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600)
    camera.position.z = 48
    return camera
  }

  protected build() {
    this.scene.background = new THREE.Color('#010306')
    this.scene.fog = new THREE.FogExp2('#010306', 0.01)
    const strands = 820
    const pointsPerStrand = 82
    const count = strands * pointsPerStrand
    const positions = new Float32Array(count * 3)
    const params = new Float32Array(count * 3)
    for (let strand = 0; strand < strands; strand += 1) {
      const angle = (strand / strands) * Math.PI * 2
      for (let point = 0; point < pointsPerStrand; point += 1) {
        const index = strand * pointsPerStrand + point
        const radius = Math.pow(point / (pointsPerStrand - 1), 1.22) * 76
        params[index * 3] = radius
        params[index * 3 + 1] = angle
        params[index * 3 + 2] = strand + Math.random()
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aParams', new THREE.BufferAttribute(params, 3))
    this.material = new THREE.ShaderMaterial({
      vertexShader: mandalaVertex,
      fragmentShader: mandalaFragment,
      uniforms: { uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(geometry, this.material)
    this.points.rotation.x = -0.18
    this.scene.add(this.points)
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.82, 0.55, 0.32)
    this.composer.addPass(this.bloom)
  }

  update = (_delta: number, elapsed: number, audio: AudioFeatures) => {
    this.material.uniforms.uTime.value = elapsed
    this.material.uniforms.uBass.value = audio.bass
    this.material.uniforms.uMid.value = audio.mid
    this.material.uniforms.uHigh.value = audio.high
    this.points.rotation.z -= 0.0007 + audio.volume * 0.0025
    this.points.rotation.x += (-0.18 + this.pointer.y * 0.14 - this.points.rotation.x) * 0.035
    this.points.rotation.y += (this.pointer.x * 0.14 - this.points.rotation.y) * 0.035
    this.bloom.strength = 0.76 + audio.beat * 0.85 + audio.volume * 0.32
    this.composer.render()
  }

  resize(width: number, height: number, pixelRatio: number) {
    super.resize(width, height, pixelRatio)
    this.composer.setPixelRatio(Math.min(pixelRatio, 1.8))
    this.composer.setSize(width, height)
  }

  protected disposeExtras() {
    this.composer.dispose()
  }
}
