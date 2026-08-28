import type { AudioFeatures } from '../audio-engine'

const channels: Array<{ key: keyof Pick<AudioFeatures, 'volume' | 'bass' | 'mid' | 'high' | 'beat'>; label: string }> = [
  { key: 'volume', label: 'VOL' },
  { key: 'bass', label: 'LOW' },
  { key: 'mid', label: 'MID' },
  { key: 'high', label: 'HIGH' },
  { key: 'beat', label: 'BEAT' },
]

export function AudioMeter({ features }: { features: AudioFeatures }) {
  return (
    <div className="audio-meter" aria-label="实时音频参数">
      {channels.map(({ key, label }) => (
        <div className="meter-channel" key={key}>
          <span>{label}</span>
          <div className="meter-track" aria-hidden="true">
            <i style={{ transform: `scaleX(${features[key].toFixed(3)})` }} />
          </div>
          <output>{features[key].toFixed(2)}</output>
        </div>
      ))}
      <div className={`signal-state ${features.silent ? 'is-silent' : ''}`}>
        <i />{features.silent ? 'SILENT' : 'SIGNAL'}
      </div>
    </div>
  )
}
