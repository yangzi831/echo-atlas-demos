import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BaseThreeScene } from './BaseThreeScene'

const vertexShader = `
  uniform float uTime;
  uniform float uPhase;
  uniform float uBass;
  uniform float uHigh;
  uniform float uVolume;
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
    vAlpha = (0.25 + aRandom * 0.55) * (0.65 + uVolume * 0.8);
    vHeat = smoothstep(-30.0, 45.0, pos.y) + sparkle;
  }
`

const fragmentShader = `
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float glow = pow(1.0 - d * 2.0, 1.35);
    vec3 cold = vec3(0.55, 0.82, 0.92);
    vec3 warm = vec3(1.0, 0.66, 0.38);
    vec3 color = mix(cold, warm, clamp(vHeat * 0.55, 0.0, 1.0));
    gl_FragColor = vec4(color, glow * vAlpha);
  }
`

export class OrbitalResonanceScene extends BaseThreeScene {
  private material!: THREE.ShaderMaterial
  private particles!: THREE.Points
  private controls!: OrbitControls
  private phase = 0

  protected createCamera() {
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1800)
    camera.position.set(0, 75, 300)
    return camera
  }

  protected build() {
    this.scene.background = new THREE.Color('#050707')
    this.scene.fog = new THREE.FogExp2('#050707', 0.0019)
    const count = 72000
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const kinds = new Float32Array(count)
    const randoms = new Float32Array(count)
    const planets = [
      { center: new THREE.Vector3(-82, 0, 48), radius: 33, count: 10000 },
      { center: new THREE.Vector3(72, 14, -80), radius: 18, count: 4200 },
      { center: new THREE.Vector3(22, -8, 54), radius: 10, count: 1800 },
    ]
    let planetIndex = 0
    let emitted = 0
    for (let i = 0; i < count; i += 1) {
      const offset = i * 3
      const planet = planets[planetIndex]
      if (planet) {
        const direction = new THREE.Vector3().randomDirection()
        const radius = Math.cbrt(Math.random()) * planet.radius
        positions[offset] = planet.center.x + direction.x * radius
        positions[offset + 1] = planet.center.y + direction.y * radius
        positions[offset + 2] = planet.center.z + direction.z * radius
        kinds[i] = 1
        emitted += 1
        if (emitted >= planet.count) { planetIndex += 1; emitted = 0 }
      } else {
        const selector = Math.random()
        const radius = selector < 0.3 ? 35 + Math.random() * 45 : selector < 0.75 ? 90 + Math.random() * 95 : 200 + Math.random() * 170
        const angle = Math.random() * Math.PI * 2
        positions[offset] = Math.cos(angle) * radius
        positions[offset + 1] = (Math.random() - 0.5) * (650 / radius)
        positions[offset + 2] = Math.sin(angle) * radius
      }
      sizes[i] = 0.35 + Math.random() * 1.3
      randoms[i] = Math.random()
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1))
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uBass: { value: 0 }, uHigh: { value: 0 }, uVolume: { value: 0 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.particles = new THREE.Points(geometry, this.material)
    this.scene.add(this.particles)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 80
    this.controls.maxDistance = 560
  }

  update = (delta: number, elapsed: number, audio: import('../audio-engine').AudioFeatures) => {
    this.phase += delta * (0.24 + audio.volume * 0.9)
    this.material.uniforms.uTime.value = elapsed
    this.material.uniforms.uPhase.value = this.phase
    this.material.uniforms.uBass.value = audio.bass
    this.material.uniforms.uHigh.value = audio.high
    this.material.uniforms.uVolume.value = audio.volume
    this.particles.rotation.z = Math.sin(elapsed * 0.08) * 0.035
    this.controls.update()
    this.render()
  }

  protected disposeExtras() {
    this.controls.dispose()
  }
}
