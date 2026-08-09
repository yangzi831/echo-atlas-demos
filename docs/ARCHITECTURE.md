# Echo Atlas Architecture

## 技术栈

- Vite
- React
- TypeScript
- 普通 CSS
- CSS Variables
- MapLibre GL JS
- deck.gl

## 前端结构

```text
src/
  components/
  features/map/
  features/sound/
  features/timeline/
  features/echoes/
  features/agent/
  data/
  types/
  services/
  styles/
```

## 数据流

`src/data/soundNodes.ts` 提供第一阶段 mock 数据。`App.tsx` 持有当前时间、选中声音、Agent 高亮路线和弹窗开关状态。地图、详情、时间丝带、Agent、上传原型都通过 props 组合。

## 地图接入

`src/services/maplibre.ts` 封装 MapLibre 初始化和 CARTO dark raster style，不需要地图 API Key。`ShanghaiMap` 使用 `coordinate` 经纬度字段生成 deck.gl `ScatterplotLayer`：

- glow layer 负责呼吸光晕。
- core layer 负责节点拾取、hover tooltip 和 click。
- 城市切换与节点点击使用 MapLibre `flyTo`。
- React 仍负责声音详情、时间筛选、Agent 高亮和上传弹窗状态。

## 可替换边界

- mock 数据未来替换为 Supabase 查询结果。
- Echo Agent mock 路线未来替换为 Gemini 或其他模型服务。
- 上传流程未来替换为音频对象存储、声音识别和 metadata 保存。
