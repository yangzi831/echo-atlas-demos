# AI Hearing Layer（AI 听觉层）

AI Hearing Layer 是 Echo Atlas 的底层听觉能力：它把麦克风或上传的音频转换成可解释的声学特征，再交给可替换的语义模型，最后增强项目唯一的 `src/types/sound.ts` Sound Memory。

```text
Microphone / Audio File
          ↓
AI Hearing Layer
          ↓
Sound Understanding
          ↓
Sound Memory
          ↓
Echo Atlas Map / Recall / Visual Listening
```

## 模块边界

- `audioAnalyzer.ts`：浏览器端 Web Audio API 特征提取（duration、amplitude、energy、rhythm、frequency profile、texture），以及 `MicrophoneRecorder` 的 MediaRecorder 封装。
- `soundUnderstanding.ts`：统一的 adapter 调用入口，默认使用本地 `MockSoundUnderstandingAdapter`。
- `memoryExtractor.ts`：把理解结果与地点、时间、音频 URL 组合成中间草稿。
- `integrate.ts`：把理解结果增量挂到现有 `SoundMemory.aiUnderstanding`，不改变地图与播放契约。
- `adapters/`：模型边界。Mock 可立即运行；Whisper 和通用 Audio Model 通过注入 endpoint 接入未来服务，不在前端硬编码密钥或模型。
- `types.ts`：模型 adapter 与中间草稿契约；最终 `SoundUnderstanding` 复用主项目类型。

## 最小使用示例

```ts
import {
  extractSoundMemory,
  mockAdapter,
  understandSound,
} from './src/ai-hearing';

const understanding = await understandSound(uploadedFile, mockAdapter);
const memory = extractSoundMemory(understanding, {
  audio: URL.createObjectURL(uploadedFile),
  recordedAt: new Date().toISOString(),
  location: { city: 'Shanghai', latitude: 31.23, longitude: 121.47 },
});
```

麦克风录音：

```ts
const recorder = new MicrophoneRecorder();
await recorder.start();
const { blob } = await recorder.stop();
const understanding = await understandSound(blob);
```

## 设计取舍

当前 mock adapter 只做可解释、确定性的 demo 输出；它不会假装拥有完整环境语义理解。真实模型可以通过 `SoundUnderstandingAdapter` 替换，保留同一条产品管线。这个边界吸收了 Ocean Listen 的“分析报告 + agent workflow”、Mubai Ears 的“频谱到特征转换”、Whisper 的语音转写边界，以及 MOSS-Audio 对 speech / music / environmental sound 的统一入口思路，但没有复制这些项目的 CLI 或模型实现。

## Echo Atlas 接入

本模块通过增量字段接入，不改动现有地图、播放和记忆展示契约：

```text
Capture Page
  ↓ 用户录音 / 上传
AI Hearing Layer
  ↓ understandSound(audio, adapter)
Existing Sound Memory
  ↓ attachSoundUnderstanding(memory, understanding)
Existing Echo Atlas Memory Database
  ↓ 同一条 SoundMemory，包含可选 aiUnderstanding
Map Visualization
  ↓
Visual Listening Engine
```

Recall 已可读取 `location.city`、`aiUnderstanding.mood`、`tags`、`texture`、`detectedEvents`；本阶段不实现完整 LLM search。

## 验证

```bash
npm run build
```

项目当前没有独立测试脚本；`npm run build` 会执行严格 TypeScript 检查和 Vite 构建。浏览器中验证录音时需要 HTTPS 或 `localhost` 权限。
