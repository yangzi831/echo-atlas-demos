# Echo Atlas

**A personal and shared sound-memory atlas of places, time and human experience.**

**一张连接地点、时间与人的声音记忆地图。**

## 🎧 Live Demo

### [Open Echo Atlas →](https://yangzi831.github.io/echo-atlas-demos/)

Echo Atlas 不只是城市声音地图，而是一套声音记忆系统。每条 Sound Memory 同时保存声音、地点、时间、图片、文字与 Visual Imprint，并由记录者决定它属于私人档案、关注者动态，还是公共 Atlas。

用户可以从全球声音地球进入不同城市，在真实地图中探索某个街道、某个时间留下的声音；也可以直接用浏览器录音，慢慢建立自己的声音档案，并通过 Recall 重新找到和组织过去的声音。

## Why Echo Atlas

视觉地图保存位置，但很多关于一个地方的感受来自声音。

雨、地铁、市场、脚步和夜晚街道，这些非常普通的声音也构成了城市和个人记忆。Echo Atlas 将地点、时间、声音与人的叙述放在同一张地图上，让不同时间的人通过同一个地方相遇。

## Experience

**01 · Capture**

用浏览器麦克风记录声音，实时生成 Visual Imprint，并保存地点、时间、图片和一句话。

**02 · My Atlas**

用 Map、Timeline 和 List 查看只属于自己的 Sound Memories。

**03 · Explore & Following**

在公共 Atlas 中搜索地点，或在 Following Feed 中听见关注者最近分享的声音。

**04 · Recall**

从我的声音、公共 Atlas 或关注的人中检索相关记录，组成一段 Listening Collection。

**05 · Listening & Visual Listening**

所有入口共享同一个播放器与 Listening Session；TRACE、FIELD 和 ARCHIVE 将真实音频与 SoundMemory 特征转化为持续生长的视觉声景。

## Product Structure

- **My Atlas** — 当前用户的个人声音档案，包含 private、followers 和 public 记录。
- **Explore** — 只显示 `visibility === public` 的公共声音地图。
- **Following** — 展示关注用户以及当前用户分享给 followers/public 的声音动态。
- **Recall** — 按城市、地点、时间、标签、情绪与文字记录检索 Sound Memories。

Capture 创建的数据直接进入统一的 `SoundMemory` state。可见性决定它出现的位置：private 只进入 My Atlas；followers 进入 My Atlas 与 Following；public 同时进入 My Atlas、Explore、Following 和 Global Earth。

## Current Demo

比赛版本目前重点策展了六座城市：

- Shanghai
- Berlin
- Beijing
- Singapore
- Tokyo
- New York

产品本身支持搜索其他城市、街道、地址和地点。这六座城市是当前 Demo 的主要声音种子包，Global Earth 也提供更多可浏览地点作为世界入口。

比赛版的策展 Sound Memories 现在可以直接播放。项目内置了 16 个精简的环境声音样本，覆盖雨、地铁、车站、市场、河流、风、夜间昆虫等场景，并根据记忆内容匹配到六座城市的 hero 与 ambient records。

这些 seed audio 来自 Freesound 的 CC0 录音，用于稳定演示交互与播放闭环，并不声称是对应城市现场采集的原声。每条相关 `SoundMemory` 都保留 source URL 与 attribution；用户通过 Capture 录制的声音则存储在本机浏览器中。

## Demo Views

| Global Listening Field | Dark Satellite City Map |
| --- | --- |
| ![Echo Atlas particle Earth](demos/global-earth-prototype/screenshots/global-earth-desktop.png) | ![Berlin city sound field](docs/experience-pass/city-sound-field.png) |

| Listening Journey | My Sounds on the Atlas |
| --- | --- |
| ![Berlin winter listening journey](docs/experience-pass/berlin-story-mode.png) | ![Personal sounds highlighted on the map](docs/experience-pass/my-sounds-atlas.png) |

## AI / Agent

Echo Agent 的目标不是生成一段介绍文案，而是理解用户想听什么，并操作地图、时间和声音集合，组织一条 listening journey。

> “I left Berlin a year ago. Sometimes I still miss it.”

Echo 会找到相关地点与时间，让地图进入 Berlin，并组织一段可以依次聆听的声音漫游。

**AI guides. People leave the memories.**

## Audio Sources

- Demo seed audio: locally bundled CC0 environmental recordings sourced from Freesound.
- Provenance: source URL、作者与 license attribution 保存在对应 `SoundMemory` 中。
- User captures: 通过 `MediaRecorder` 录制，并使用 IndexedDB 在本机持久化音频 Blob 与可选图片。
- Playback analysis: Web Audio API 为 Listening 与 Visual Listening 提供实时音频特征。

## Tech

- React
- TypeScript
- Vite
- MapLibre GL JS
- deck.gl
- Three.js
- MapTiler Geocoding / map data
- Web Audio API / MediaRecorder
- IndexedDB

## Local Development

```bash
npm install
npm run dev
```

需要完整 MapTiler 地图与地点搜索时，在项目根目录创建 `.env.local`：

```env
VITE_MAPTILER_KEY=
```

不要提交 `.env.local` 或任何真实 API Key。

生产构建：

```bash
npm run build
```

## Status

Echo Atlas 是一个 hackathon prototype，当前已形成 Capture → My Atlas → Explore / Following → Recall → Listening 的完整前端闭环。Demo 支持浏览器真实录音、声音特征与 Visual Imprint、位置与时间记录、IndexedDB 本地持久化，以及统一的 Listening / Visual Listening 体验；公共内容仍以透明标注来源的策展 seed data 为主。

## Future

- Real user sound storage
- Richer historical sound archives
- Weather and contextual layers
- Cross-time listening
- Personal sound atlas
