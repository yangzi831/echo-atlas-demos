# Echo Atlas Visual Listening Engine

Standalone React + TypeScript visual lab for Echo Atlas sound memories. It accepts data through props and has no dependency on the product store, router, map, Recall UI, authentication, or database.

The root page is a visual index with real screenshots for the three historical VJ scenes. Click a card to open the live WebGL version, or open the Visual Listening Engine from the header. Public engine imports come from `src/visual-engine/index.ts` (or the root barrel `src/index.ts`).

## Visual index and direct links

- `?scene=orbital` — Orbital Resonance, migrated from `space web.html`
- `?scene=mandala` — Mandala Flow, migrated from `space web2.html`
- `?scene=saturn` — Saturn Lithograph, migrated from `space web3.html`
- `?scene=memory-tree` — recording-driven Memory Tree prototype
- `?engine=listening` — deterministic Visual Listening Engine added after the original VJ migration

The preview images live in `public/previews/`. The three WebGL scenes share `src/audio-engine/AudioEngine.ts`; they do not create separate AudioContexts.

## Public components

### Static or lightly animated imprint

```tsx
import { VisualImprintPreview } from './visual-engine'

<VisualImprintPreview
  memory={memory}
  preset="trace"
  animated={false}
/>
```

`animated={false}` renders a deterministic SVG with no `requestAnimationFrame`, AudioContext, or WebGL context. This is the intended Feed, My Atlas, Map detail, and Recall-result path. `animated={true}` adds lightweight SVG/CSS motion, still without creating an audio graph.

### Listening and soundscape view

```tsx
import { VisualListeningView, type VisualSession } from './visual-engine'

const session: VisualSession = {
  mode: 'soundscape',
  memories: [uBahn, rain, wind, spati],
  activeMemoryId: rain.id,
  preset: 'field',
}

<VisualListeningView
  session={session}
  onActiveMemoryChange={setActiveMemoryId}
  onProgressChange={(progress, memoryId) => console.log(progress, memoryId)}
/>
```

The component includes a small transport by default. Pass `controls={false}` for a product-owned transport. It also supports an imperative ref with `play()`, `pause()`, `toggle()`, and `seek(progress, memoryId?)`.

## Minimal data contract

`SoundMemory` requires only `id`. `audio`, metadata, aggregate `soundFeatures`, and stored `visualImprint` frames are optional. Missing features use restrained documented defaults so the view remains renderable; defaults are not presented as measured analysis.

```ts
interface VisualSession {
  mode: 'single' | 'soundscape'
  memories: SoundMemory[]
  activeMemoryId?: string
  preset?: 'field' | 'trace' | 'archive' | 'growth'
}
```

For the strongest stable identity, persist `memory.visualImprint.frames`, an array of downsampled `SoundFeatureFrame` values. `analyzeAudioBuffer(audioBuffer)` creates these frames in the browser or an ingestion step. `createVisualImprint(memory)` then produces the same `EchoForm` on every open. The seed selects deterministic fine texture and palette; RMS, band balance, centroid, onsets, silence, rhythm, and duration determine the core spine, width, nodes, gaps, and branches.

## Presets kept

- **TRACE**: the clearest direct reading of the directional Echo Form, event nodes, and residue.
- **FIELD**: translates the form into particles, pressure, and orbital motion while retaining the spine as its attractor.
- **ARCHIVE**: layers the same form as time strata and memory sediment.
- **GROWTH**: grows roots/mycelium from measured or stored onset and high-frequency structure.

Orbital, Mandala, Saturn, and Memory Tree remain isolated prototype scenes rather than public Visual Listening Engine modes. They are still directly runnable from the visual index for comparison and future art direction. The deterministic engine remains separately available through `?engine=listening`.

## Audio analysis: measurements and proxies

`VisualAudioEngine` creates one lazy AudioContext per mounted listening view. All memory tracks share it. Each track has its own analyser before its mix gain, and the shared mix has a master analyser. This preserves per-memory motion plus master soundscape response.

Direct browser measurements:

- normalized time-domain RMS
- low (35–220 Hz), mid (220–2400 Hz), and high (2400–12000 Hz) FFT-bin energy
- magnitude-weighted spectral centroid, normalized against 12 kHz
- normalized playback progress from media `currentTime / duration`

Lightweight proxies (not AI inference and not studio metrics):

- `loudness`: perceptually curved normalized RMS, not LUFS
- `transient`: positive RMS change plus positive spectral flux
- `onset`: thresholded transient proxy with a short refractory interval
- `rhythmDensity`: recent onset-proxy count over a four-second window
- `pulse`: attack/release envelope driven by onset proxy

Analysis values use separate attack/release smoothing. The demo WAV files are small procedural fixtures for local verification, not field recordings or training data.

## Soundscape behavior

All memories keep independent `EchoForm`, seed, analysis, progress, mix gain, palette, and motion. Changing `activeMemoryId` interpolates spatial position, scale, opacity, and audio gain over time. It does not remount the canvas or cut to a new page. Hover increases a form's visual presence; clicking a form requests focus through `onActiveMemoryChange`.

Future spatial-audio and solo controls can use the exported `VisualAudioEngine` and imperative component handle without changing the session contract.

## Performance and lifecycle

- Static previews are SVG and create no animation loop unless `animated` is requested.
- The immersive view uses one Canvas 2D surface and one animation loop.
- DPR is capped at 1.8 desktop and 1.35 on compact/low-memory devices.
- FIELD uses 210 particles per memory desktop and 90 compact, calculated deterministically without retained particle objects.
- `prefers-reduced-motion` removes form motion and throttles redraws to about 5–6 fps.
- Canvas 2D is the deliberate fallback-friendly renderer; the engine does not require WebGL.
- AudioContext is lazy and begins only after play. RAF, ResizeObserver, media listeners, nodes, media elements, and AudioContext are cleaned up on unmount.
- Soundscape focus gains use `setTargetAtTime` to avoid clicks and abrupt takeover.

## Development

Requires Node.js 20 or newer.

```bash
npm ci
npm run typecheck
npm run build
npm run dev
```

To continue on another computer without mixing this work into the main branch:

```bash
git clone --branch codex/visual-lab --single-branch https://github.com/yangzi831/echo-atlas-demos.git
cd echo-atlas-demos/visual-lab
npm ci
npm run dev
```

There is currently no unit-test runner in this isolated lab. TypeScript strict unused checks, the Vite production build, and browser smoke checks are the available project checks.

## Moving into Echo Atlas

Move or package these paths:

- `src/visual-engine/`
- the relevant `.visual-*` and `.visual-imprint-*` CSS blocks from `src/styles.css`

The engine's runtime peer requirement is React. The public engine does not import Three.js or lucide-react. Those packages remain in this lab only because the historical prototype source files are intentionally retained.
