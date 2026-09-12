# Echo Atlas

**A living sound atlas where people and AI decide what is worth remembering.**

**一套让人与 AI 共同聆听、共同判断、共同形成记忆的声音系统。**

## 🎧 Live Demo

### [Open Echo Atlas →](https://yangzi831.github.io/echo-atlas-demos/)

公开 Demo 由 `main` 自动部署，包含最新的 `LISTEN / 共听`、`MEMORIES / 记忆`、`RECALL / 召回` 与 `ATLAS / 地图` 体验。

Echo Atlas 不只是城市声音地图，而是一套声音记忆系统。它让 AI 在用户意识到以前注意周围的声音，判断哪些瞬间值得留下，并把保存原因交还给人确认、拒绝或纠正。

每条 Sound Memory 同时保存声音、地点、时间、图片、文字与 Visual Imprint。用户可以直接用浏览器共同聆听或主动录音，随后在个人记忆档案、Recall、地图和 Visual Listening 中重新找到它。

## Why Echo Atlas

视觉地图保存位置，但很多关于一个地方的感受来自声音。

雨、地铁、市场、脚步和夜晚街道，这些非常普通的声音也构成了城市和个人记忆。Echo Atlas 将地点、时间、声音与人的叙述放在同一张地图上，让不同时间的人通过同一个地方相遇。

## Experience

**01 · Listen Together**

选择今天希望 AI 留意的声音，建立一份 Listening Pact。SecondEar 持续收音，Fun-ASR 持续转写，GPT 结合前后文判断是否符合记忆意图。

**02 · Capture**

用户可以主动记录这一刻，也可以在 AI 注意到变化时要求它保留当前声音。录音会生成 Visual Imprint，并保存地点、时间、图片和一句话。

**03 · Memories**

在共同留下、等待确认和存在分歧之间查看记忆，同时保留原有 Map、Timeline 和 List 视图。

**04 · Recall**

用一句模糊的感受召回声音。Recall 会根据地点、时间、tags、moods、note 和声音特征解释为什么找到这些记录。

**05 · Atlas & Listening**

地图继续承载 Global Earth、City Map、Explore 和 Following；所有入口共享 Listening Session，并可以进入 Visual Listening。

## Product Structure

- **LISTEN / 共听** — 默认首页。用户与 AI 约定要留意什么，随后进入真实麦克风驱动的共同聆听状态。
- **MEMORIES / 记忆** — 当前用户的 Sound Memories，以及 AI 保存原因、判断来源和人的反馈。
- **RECALL / 召回** — 通过模糊感受检索并解释相关记忆，进入播放、Sound Detail 或 Visual Listening。
- **ATLAS / 地图** — 保留 Global Earth、City Map、Explore 和 Following。地图是声音记忆的地理查看方式，而不是默认入口。

Capture 和 Co-listening 创建的数据都直接进入统一的 `SoundMemory` state。可见性决定它出现的位置：private 只进入 MEMORIES；followers 进入 MEMORIES 与 Following；public 同时进入 MEMORIES、Explore、Following 和 Global Earth。

AI 共听产生的判断元数据包括保存原因、匹配的记忆意图、判断来源、置信度和人的接受/拒绝/纠正状态。旧的 seed memories 不会被伪装成真实的 AI 历史。

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

Echo Agent 与共听判断引擎的目标不是生成一段介绍文案，而是理解用户希望注意什么，观察真实声音变化，判断是否值得留下，并操作地图、时间和声音集合，组织一条 listening journey。

> “I left Berlin a year ago. Sometimes I still miss it.”

Echo 会找到相关地点与时间，让地图进入 Berlin，并组织一段可以依次聆听的声音漫游。

**AI guides. People leave the memories.**

当前本地共听版以连续转写和 GPT 上下文判断筛选记忆。每条候选保存对应句子、原音频时间范围与判断原因；声学特征只驱动画面。完整录音持续保存在浏览器中，支持下载与恢复转写。发生时间和 AI 判断时间分别记录，详见四阶段实现说明。

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

## 四阶段共听流程

本地版已接入「约定 → 持续录音与转写 → GPT 按上下文选择原声范围 → 确认与重返」。实现范围、AI 数据边界和测试记录见 [四阶段实现说明](docs/journey-implementation.md)。

## Local Development

```bash
npm ci
npm run dev
```

建议使用 Node.js 22。页面顶部导航末尾的齿轮可打开「API 设置」，填写个人 ApiMux 和 DashScope 密钥，保存后刷新或重启浏览器无需再次输入。配置保存在当前站点的 localStorage；切换浏览器、域名或端口需要重新配置，清除浏览器站点数据也会删除配置。支持在设置中清除本地配置，空字段回退服务端默认值。密钥输入默认遮挡，但本地存储并非加密保险箱，请在自己的设备上使用。

个人密钥仅随对应的 AI 请求或转写 WebSocket 首帧发送给本站后端，不写入服务器环境文件，不进入 GPT 提示词。个人 ApiMux 密钥固定转发至 `https://apimux.top`。分析设置对下一次请求生效，转写设置对下一次聆听生效。也可复制 `.env.example` 为 `.env.local` 配置服务端默认密钥。

完整共听需要桌面 Chrome 和兼容的 SecondEar 蓝牙设备。GitHub Pages 仅提供静态前端，即使填写密钥也仍需要部署配套后端；本地 `npm run dev` 已包含后端。

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

Echo Atlas 是一个 hackathon prototype，当前已形成 Listen Together → Capture → Memories → Recall → Atlas → Listening 的完整前端闭环。Demo 支持浏览器真实录音、声音特征与 Visual Imprint、AI 共听判断、人的确认与纠正、位置与时间记录、IndexedDB 本地持久化，以及统一的 Listening / Visual Listening 体验；公共内容仍以透明标注来源的策展 seed data 为主。

AI 共听体验现已进入 `main`，GitHub Pages 会在 `main` 更新后自动构建并发布。

## Future

- Real user sound storage
- Richer historical sound archives
- Weather and contextual layers
- Cross-time listening
- Personal sound atlas
