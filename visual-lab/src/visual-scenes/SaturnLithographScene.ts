import * as THREE from 'three'
import type { AudioFeatures } from '../audio-engine'
import { BaseThreeScene } from './BaseThreeScene'

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
`

const ringFragment = `
  uniform float uTime;
  uniform float uMid;
  uniform float uHigh;
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
    vec3 ink = vec3(0.09, 0.085, 0.075);
    vec3 paper = vec3(0.9, 0.86, 0.76);
    vec3 color = mix(ink, paper, tracks * 0.82 + grain * 0.13 + shimmer);
    gl_FragColor = vec4(color, edge * cut * (0.62 + tracks * 0.34));
  }
`

export class SaturnLithographScene extends BaseThreeScene {
  private planet!: THREE.Mesh
  private ring!: THREE.Mesh
  private nebula!: THREE.Points
  private ringMaterial!: THREE.ShaderMaterial
  private targetRotation = new THREE.Vector2(0.35, 0.15)

  protected createCamera() {
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 320)
    camera.position.set(0, 4, 34)
    return camera
  }

  protected build() {
    this.scene.background = new THREE.Color('#141311')
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMappingExposure = 0.9
    const planetGeometry = new THREE.SphereGeometry(6, 96, 96)
    const planetMaterial = new THREE.MeshStandardMaterial({ color: '#d7d0c0', roughness: 0.88, metalness: 0.04 })
    this.planet = new THREE.Mesh(planetGeometry, planetMaterial)
    this.planet.castShadow = true
    this.planet.receiveShadow = true
    this.scene.add(this.planet)

    this.ringMaterial = new THREE.ShaderMaterial({
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      uniforms: { uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.ring = new THREE.Mesh(new THREE.RingGeometry(7.5, 18, 256, 28), this.ringMaterial)
    this.ring.rotation.x = Math.PI / 2
    this.scene.add(this.ring)

    const count = 18000
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 150
      positions[index * 3 + 1] = (Math.random() - 0.5) * 105
      positions[index * 3 + 2] = -35 - Math.random() * 125
    }
    const nebulaGeometry = new THREE.BufferGeometry()
    nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.nebula = new THREE.Points(nebulaGeometry, new THREE.PointsMaterial({ color: '#c8d8d0', size: 0.11, transparent: true, opacity: 0.32, depthWrite: false }))
    this.scene.add(this.nebula)

    this.scene.add(new THREE.AmbientLight('#f2ead9', 0.12))
    const key = new THREE.DirectionalLight('#fff7e7', 3.2)
    key.position.set(14, 12, 10)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight('#82a7b3', 0.65)
    rim.position.set(-12, -5, -8)
    this.scene.add(rim)
    this.scene.rotation.set(0.35, 0.15, -0.45)
  }

  update = (delta: number, elapsed: number, audio: AudioFeatures) => {
    this.ringMaterial.uniforms.uTime.value = elapsed
    this.ringMaterial.uniforms.uBass.value = audio.bass
    this.ringMaterial.uniforms.uMid.value = audio.mid
    this.ringMaterial.uniforms.uHigh.value = audio.high
    this.planet.rotation.y += delta * (0.08 + audio.mid * 0.12)
    this.ring.rotation.z -= delta * (0.08 + audio.volume * 0.34)
    const scale = 1 + audio.volume * 0.16 + audio.beat * 0.08
    this.ring.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1)
    this.nebula.rotation.y -= delta * (0.01 + audio.bass * 0.025)
    this.targetRotation.set(0.35 - this.pointer.y * 0.055, 0.15 + this.pointer.x * 0.055)
    this.scene.rotation.x += (this.targetRotation.x - this.scene.rotation.x) * 0.04
    this.scene.rotation.y += (this.targetRotation.y - this.scene.rotation.y) * 0.04
    ;(this.nebula.material as THREE.PointsMaterial).opacity = 0.24 + audio.volume * 0.34
    this.render()
  }
}
