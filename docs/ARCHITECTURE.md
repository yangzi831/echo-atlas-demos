# Echo Atlas Architecture

## 技术栈

- Vite
- React
- TypeScript
- 普通 CSS
- CSS Variables
- `@amap/amap-jsapi-loader`

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

`src/services/amap.ts` 封装高德地图加载。`ShanghaiMap` 检查 `import.meta.env.VITE_AMAP_KEY`：

- 有 Key：加载高德地图 JS API 2.0。
- 无 Key 或加载失败：显示艺术化上海地图 fallback。

当前声音节点使用百分比定位，方便 fallback 和真实地图接入前保持一致的展示。接入真实高德覆盖物时，可用 `coordinate` 字段创建 Marker、CircleMarker 或自定义 Overlay。

## 可替换边界

- mock 数据未来替换为 Supabase 查询结果。
- Echo Agent mock 路线未来替换为 Gemini 或其他模型服务。
- 上传流程未来替换为音频对象存储、声音识别和 metadata 保存。
