import * as THREE from 'three'
import type { AudioFeatures } from '../audio-engine'
import { BaseThreeScene } from '../visual-scenes/BaseThreeScene'
import type { SceneFrameState } from '../visual-scenes/types'

const MAX_SEGMENTS = 900

export class MemoryTreeScene extends BaseThreeScene {
  private branches!: THREE.InstancedMesh
  private tips!: THREE.InstancedMesh
  private seed!: THREE.Mesh
  private dummy = new THREE.Object3D()
  private segmentCount = 0
  private tipCount = 0
  private trunkNodes: THREE.Vector3[] = []
  private trunkDirection = new THREE.Vector3(0, 1, 0)
  private lastBeatAt = -10
  private wasRecording = false
  private treeGroup = new THREE.Group()
  private seedPulse = 0

  protected createCamera() {
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 300)
    camera.position.set(0, 6.8, 26)
    camera.lookAt(0, 7, 0)
    return camera
  }

  protected build() {
    this.scene.background = new THREE.Color('#090c0b')
    this.scene.fog = new THREE.FogExp2('#090c0b', 0.025)
    this.renderer.toneMappingExposure = 1.2
    this.scene.add(this.treeGroup)

    const branchGeometry = new THREE.CylinderGeometry(1, 0.78, 1, 7, 1, false)
    const branchMaterial = new THREE.MeshStandardMaterial({
      color: '#a8c9a9',
      roughness: 0.68,
      metalness: 0.05,
      vertexColors: true,
    })
    this.branches = new THREE.InstancedMesh(branchGeometry, branchMaterial, MAX_SEGMENTS)
    this.branches.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.branches.count = 0
    this.branches.castShadow = true
    this.treeGroup.add(this.branches)

    const tipGeometry = new THREE.IcosahedronGeometry(0.12, 1)
    const tipMaterial = new THREE.MeshBasicMaterial({ color: '#ecf2c3', vertexColors: true })
    this.tips = new THREE.InstancedMesh(tipGeometry, tipMaterial, MAX_SEGMENTS)
    this.tips.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.tips.count = 0
    this.treeGroup.add(this.tips)

    this.seed = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.34, 2),
      new THREE.MeshStandardMaterial({ color: '#dce8bb', emissive: '#6a8d65', emissiveIntensity: 0.55, roughness: 0.5 }),
    )
    this.seed.position.y = 0.25
    this.treeGroup.add(this.seed)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(15, 96),
      new THREE.MeshStandardMaterial({ color: '#101512', roughness: 1, transparent: true, opacity: 0.72 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.03
    floor.receiveShadow = true
    this.scene.add(floor)

    for (let radius = 2.5; radius <= 12.5; radius += 2.5) {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2)
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(128))
      const loop = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color: '#4e6252', transparent: true, opacity: 0.12 }))
      loop.rotation.x = Math.PI / 2
      loop.position.y = 0.01
      this.scene.add(loop)
    }

    const key = new THREE.DirectionalLight('#e5efc9', 2.7)
    key.position.set(-5, 13, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    this.scene.add(key)
    const rim = new THREE.PointLight('#76aeb2', 15, 32)
    rim.position.set(8, 8, -5)
    this.scene.add(rim)
    this.scene.add(new THREE.AmbientLight('#809081', 0.48))
    this.resetTree()
  }

  private resetTree() {
    this.segmentCount = 0
    this.tipCount = 0
    this.branches.count = 0
    this.tips.count = 0
    this.trunkNodes = [new THREE.Vector3(0, 0.42, 0)]
    this.trunkDirection.set(0, 1, 0)
    this.lastBeatAt = -10
    this.treeGroup.rotation.set(0, 0, 0)
  }

  private addSegment(from: THREE.Vector3, to: THREE.Vector3, radius: number, color: THREE.Color, tipScale: number) {
    if (this.segmentCount >= MAX_SEGMENTS) return
    const direction = to.clone().sub(from)
    const length = direction.length()
    this.dummy.position.copy(from).add(to).multiplyScalar(0.5)
    this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
    this.dummy.scale.set(radius, length, radius)
    this.dummy.updateMatrix()
    this.branches.setMatrixAt(this.segmentCount, this.dummy.matrix)
    this.branches.setColorAt(this.segmentCount, color)
    this.segmentCount += 1
    this.branches.count = this.segmentCount
    this.branches.instanceMatrix.needsUpdate = true
    if (this.branches.instanceColor) this.branches.instanceColor.needsUpdate = true

    if (tipScale > 0 && this.tipCount < MAX_SEGMENTS) {
      this.dummy.position.copy(to)
      this.dummy.quaternion.identity()
      this.dummy.scale.setScalar(tipScale)
      this.dummy.updateMatrix()
      this.tips.setMatrixAt(this.tipCount, this.dummy.matrix)
      this.tips.setColorAt(this.tipCount, color.clone().lerp(new THREE.Color('#f3f6c9'), 0.45))
      this.tipCount += 1
      this.tips.count = this.tipCount
      this.tips.instanceMatrix.needsUpdate = true
      if (this.tips.instanceColor) this.tips.instanceColor.needsUpdate = true
    }
  }

  private growTrunk(audio: AudioFeatures, index: number) {
    const from = this.trunkNodes[this.trunkNodes.length - 1]
    const bend = 0.018 + audio.bass * 0.12
    this.trunkDirection.x += Math.sin(index * 0.44) * bend
    this.trunkDirection.z += Math.cos(index * 0.31) * bend * 0.72
    this.trunkDirection.y = 1
    this.trunkDirection.normalize()
    const length = 0.26 + Math.min(index, 120) * 0.0012
    const to = from.clone().addScaledVector(this.trunkDirection, length)
    const radius = Math.max(0.035, 0.145 - index * 0.00065) * (0.72 + audio.volume * 0.65)
    const glow = 0.22 + audio.volume * 0.7
    const color = new THREE.Color('#547762').lerp(new THREE.Color('#d9e7b6'), glow)
    this.addSegment(from, to, radius, color, 0.32 + audio.high * 0.42)
    this.trunkNodes.push(to)
  }

  private growSoundEvent(audio: AudioFeatures, elapsed: number) {
    const usableNodes = this.trunkNodes.slice(Math.floor(this.trunkNodes.length * 0.32))
    if (usableNodes.length === 0) return
    const branchCount = 1 + Math.floor(audio.mid * 2.8)
    for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
      let from = usableNodes[Math.floor(Math.random() * usableNodes.length)].clone()
      const side = branchIndex % 2 === 0 ? 1 : -1
      const direction = new THREE.Vector3(side * (0.7 + Math.random() * 0.5), 0.38 + Math.random() * 0.45, (Math.random() - 0.5) * 1.1).normalize()
      const branchLength = 3 + Math.floor(audio.high * 5)
      for (let step = 0; step < branchLength; step += 1) {
        direction.x += Math.sin(elapsed * 2 + step) * audio.bass * 0.2
        direction.z += Math.cos(elapsed * 1.7 + step) * audio.bass * 0.18
        direction.y += 0.04
        direction.normalize()
        const to = from.clone().addScaledVector(direction, 0.28 - step * 0.015)
        const radius = Math.max(0.018, (0.065 - step * 0.006) * (0.7 + audio.volume * 0.75))
        const color = new THREE.Color('#6f9d79').lerp(new THREE.Color('#f1e6a8'), 0.25 + audio.volume * 0.68)
        this.addSegment(from, to, radius, color, 0.45 + audio.high * 0.9)
        from = to
      }
      if (audio.high > 0.28) {
        const twigCount = 1 + Math.floor(audio.high * 3)
        for (let twig = 0; twig < twigCount; twig += 1) {
          const twigDirection = direction.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), (twig - twigCount / 2) * 0.45)
          const to = from.clone().addScaledVector(twigDirection, 0.22 + audio.high * 0.18)
          this.addSegment(from, to, 0.016 + audio.volume * 0.016, new THREE.Color('#d8dfa5'), 0.72 + audio.high)
        }
      }
    }
  }

  update = (_delta: number, elapsed: number, audio: AudioFeatures, state: SceneFrameState) => {
    if (state.recording && !this.wasRecording) this.resetTree()
    if (state.recording) {
      const targetTrunkSegments = Math.min(520, 1 + Math.floor(state.recordingElapsed * 7.5))
      while (this.trunkNodes.length - 1 < targetTrunkSegments && this.segmentCount < MAX_SEGMENTS) {
        this.growTrunk(audio, this.trunkNodes.length - 1)
      }
      if (audio.beat > 0.2 && elapsed - this.lastBeatAt > 0.24) {
        this.growSoundEvent(audio, elapsed)
        this.lastBeatAt = elapsed
      }
    }
    this.wasRecording = state.recording
    this.seedPulse += 0.035 + audio.bass * 0.16
    const seedScale = 1 + Math.sin(this.seedPulse) * 0.08 + audio.volume * 0.25
    this.seed.scale.setScalar(seedScale)
    const seedMaterial = this.seed.material as THREE.MeshStandardMaterial
    seedMaterial.emissiveIntensity = 0.35 + audio.volume * 1.8
    this.treeGroup.rotation.y += (this.pointer.x * 0.2 - this.treeGroup.rotation.y) * 0.025
    this.treeGroup.rotation.x += (-this.pointer.y * 0.035 - this.treeGroup.rotation.x) * 0.025
    this.tips.rotation.y = Math.sin(elapsed * 0.18) * 0.012
    this.render()
  }
}
