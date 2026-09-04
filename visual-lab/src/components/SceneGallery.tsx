import { ArrowRight, AudioWaveform, CircleDot, Mic2, Orbit, Sprout } from 'lucide-react'
import type { SceneId } from '../visual-scenes'

interface SceneGalleryProps {
  onOpen: (sceneId: SceneId) => void
  onOpenListening: () => void
}

const galleryScenes: Array<{
  id: SceneId
  number: string
  name: string
  english: string
  source: string
  preview: string
  icon: typeof Orbit
  summary: string
  mappings: string[]
  accent: string
}> = [
  {
    id: 'orbital',
    number: '01',
    name: '轨道共振',
    english: 'ORBITAL RESONANCE',
    source: 'space web.html',
    preview: './previews/orbital.png',
    icon: Orbit,
    summary: '粒子星云沿多层轨道缓慢旋转，低频让空间产生呼吸式膨胀。',
    mappings: ['低频 · 径向呼吸', '高频 · 粒子闪烁', '音量 · 旋转速度'],
    accent: '#9fc8c7',
  },
  {
    id: 'mandala',
    number: '02',
    name: '曼陀罗流',
    english: 'MANDALA FLOW',
    source: 'space web2.html',
    preview: './previews/mandala.png',
    icon: AudioWaveform,
    summary: '放射状丝流从明亮核心向外舒展，节拍与频段共同塑造涡旋。',
    mappings: ['节拍 · 核心闪光', '中频 · 丝流扰动', '高频 · 末端火花'],
    accent: '#7ba9eb',
  },
  {
    id: 'saturn',
    number: '03',
    name: '版画土星',
    english: 'SATURN LITHOGRAPH',
    source: 'space web3.html',
    preview: './previews/saturn.png',
    icon: CircleDot,
    summary: '具有版画颗粒感的行星与密集星环，声音推动环带尺度和纹理流速。',
    mappings: ['音量 · 星环尺度', '中频 · 环纹密度', '低频 · 空间漂移'],
    accent: '#e1b77f',
  },
]

export function SceneGallery({ onOpen, onOpenListening }: SceneGalleryProps) {
  return (
    <main className="gallery-shell">
      <header className="gallery-header">
        <div className="brand-lockup">
          <span className="brand-mark"><i /><i /><i /></span>
          <div>
            <strong>声景视觉实验室</strong>
            <span>SOUNDSCAPE VISUAL LAB</span>
          </div>
        </div>
        <div className="gallery-header-actions">
          <button type="button" onClick={onOpenListening}>VISUAL LISTENING ENGINE</button>
          <div className="gallery-status"><i /> 3 VISUAL STUDIES · READY</div>
        </div>
      </header>

      <section className="gallery-intro">
        <div className="eyebrow"><span>VISUAL INDEX</span><i /></div>
        <h1>选择一种声音的形状</h1>
        <p>三个旧 VJ 已整理为独立实时场景。点击任意预览即可进入，上传音频或打开麦克风后，所有场景共享同一套声音分析参数。</p>
      </section>

      <section className="scene-gallery" aria-label="三个视觉效果">
        {galleryScenes.map((scene) => {
          const Icon = scene.icon
          return (
            <article className="scene-card" key={scene.id} style={{ '--scene-accent': scene.accent } as React.CSSProperties}>
              <button className="scene-preview" type="button" onClick={() => onOpen(scene.id)} aria-label={`打开${scene.name}实时效果`}>
                <img src={scene.preview} alt={`${scene.name}实时场景预览`} />
                <span className="preview-number">{scene.number}</span>
                <span className="preview-action">打开实时效果 <ArrowRight size={16} /></span>
              </button>
              <div className="scene-card-copy">
                <div className="scene-card-title">
                  <span className="scene-card-icon"><Icon size={17} /></span>
                  <div>
                    <h2>{scene.name}</h2>
                    <span>{scene.english}</span>
                  </div>
                </div>
                <p>{scene.summary}</p>
                <ul>
                  {scene.mappings.map((mapping) => <li key={mapping}>{mapping}</li>)}
                </ul>
                <footer>
                  <span>{scene.source}</span>
                  <button type="button" onClick={() => onOpen(scene.id)}>进入场景 <ArrowRight size={14} /></button>
                </footer>
              </div>
            </article>
          )
        })}
      </section>

      <aside className="memory-tree-entry">
        <span className="memory-icon"><Sprout size={20} /></span>
        <div>
          <span>RECORDING PROTOTYPE</span>
          <strong>记忆之树</strong>
          <p><Mic2 size={13} /> 用一段录音从种子开始生成专属声音树。</p>
        </div>
        <button type="button" onClick={() => onOpen('memory-tree')}>打开录音实验 <ArrowRight size={15} /></button>
      </aside>
    </main>
  )
}
