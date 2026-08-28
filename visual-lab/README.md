# 声景视觉实验室

独立的 React + Vite + TypeScript 声音响应视觉项目。项目不使用 iframe 或远程 CDN，Three.js、React 与图标均为本地 npm 依赖。

## 模块边界

- `src/audio-engine/`：唯一的 Web Audio 上下文、上传音频、麦克风、录音与统一特征输出。
- `src/visual-scenes/`：场景接口、共享 Three.js 生命周期、资源释放、场景注册与三个旧 VJ 的模块化实现。
- `src/MemoryTree/`：录音驱动的 Memory Tree 生成器，可独立迁移。
- `src/components/`：输入控制、音频参数表与全屏控制。

统一的 `AudioFeatures` 包含 `volume`、`bass`、`mid`、`high`、`beat` 和 `silent`。场景只消费该数据结构，不直接访问 Web Audio API。

## 旧 VJ 映射

- `space web.html` -> `src/visual-scenes/OrbitalResonanceScene.ts`
- `space web2.html` -> `src/visual-scenes/MandalaFlowScene.ts`
- `space web3.html` -> `src/visual-scenes/SaturnLithographScene.ts`

## 生命周期

`SceneHost` 持有唯一的场景动画循环。场景切换时会取消循环、断开 ResizeObserver 和指针监听器，并释放 geometry、material、texture、post-processing target、controls、renderer 与 WebGL context。

## 换电脑继续开发

视觉实验室发布在 `codex/visual-lab` 分支的 `visual-lab/` 目录，不与主项目源码共用依赖或配置。

```bash
git clone --branch codex/visual-lab --single-branch https://github.com/yangzi831/echo-atlas-demos.git
cd echo-atlas-demos/visual-lab
npm ci
npm run dev
```

要求 Node.js 20 或更高版本。`node_modules`、生产构建、浏览器测试产物和 TypeScript 增量缓存均不会提交。
