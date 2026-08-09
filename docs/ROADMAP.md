# Echo Atlas Roadmap

## Phase 1: Frontend Prototype

- 建立 Vite React TypeScript 项目。
- 完成 MapLibre + deck.gl 城市声音地图。
- 完成声音节点、时间丝带、详情面板、Echo Agent、上传声音原型。
- 使用 mock 数据验证体验。

## Phase 2: Real Data

- 优化 MapLibre tile source 与地图服务部署策略。
- 将 mock 声音节点迁移为数据库经纬度数据。
- 设计 Supabase 表结构：sounds、locations、echo_messages、agent_routes。
- 接入真实音频 URL 与 metadata。

## Phase 3: AI Sound Archive

- 接入声音元素识别。
- 生成声音标题、标签、情绪与描述。
- 建立 Echo Agent 路线生成能力。
- 支持同地点跨时间对比。

## Phase 4: Public Installation

- 优化大屏投影模式。
- 加入展览现场上传入口。
- 支持地点二维码。
- 输出精选城市声音路线。
