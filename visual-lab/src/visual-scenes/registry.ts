import { MemoryTreeScene } from '../MemoryTree'
import { MandalaFlowScene } from './MandalaFlowScene'
import { OrbitalResonanceScene } from './OrbitalResonanceScene'
import { SaturnLithographScene } from './SaturnLithographScene'
import type { SceneDefinition, SceneId } from './types'

export const SCENES: SceneDefinition[] = [
  {
    id: 'orbital',
    number: '01',
    name: '轨道共振',
    source: 'space web.html',
    description: 'ORBITAL RESONANCE',
    create: () => new OrbitalResonanceScene(),
  },
  {
    id: 'mandala',
    number: '02',
    name: '曼陀罗流',
    source: 'space web2.html',
    description: 'MANDALA FLOW',
    create: () => new MandalaFlowScene(),
  },
  {
    id: 'saturn',
    number: '03',
    name: '版画土星',
    source: 'space web3.html',
    description: 'SATURN LITHOGRAPH',
    create: () => new SaturnLithographScene(),
  },
  {
    id: 'memory-tree',
    number: '04',
    name: '记忆之树',
    source: 'NEW PROTOTYPE',
    description: 'MEMORY TREE',
    create: () => new MemoryTreeScene(),
  },
]

export const getScene = (id: SceneId) => SCENES.find((scene) => scene.id === id) ?? SCENES[0]
