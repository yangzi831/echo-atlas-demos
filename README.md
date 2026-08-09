# Echo Atlas / 城市回声档案

Echo Atlas 是一张连接城市、声音和时间的 AI 声景地图。第一阶段以前端原型验证上海声景探索、时间筛选、声音详情、Echo Agent 策展路线与上传声音流程。

## 运行

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run build
```

## 当前能力

- Vite + React + TypeScript
- 普通 CSS 与 CSS Variables
- 上海声音地图组件 `ShanghaiMap`
- MapLibre dark map style
- deck.gl 声音节点、hover/click 与 flyTo 交互
- 8 个以上 mock 声音节点
- 时间丝带筛选：`1990s`、`2010s`、`2026`、`Future Archive`
- 声音详情面板与波形动画
- Echo Agent mock 策展路线
- 上传声音 mock 流程

## 地图实现

- `src/services/maplibre.ts`：MapLibre 初始化与 CARTO dark raster style。
- `src/features/map/ShanghaiMap.tsx`：deck.gl 声音节点 layer、hover/click 与地图镜头移动。
- `src/data/soundNodes.ts`：城市与声音节点真实经纬度 mock 数据。
