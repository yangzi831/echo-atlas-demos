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

## 环境变量

复制 `.env.example` 为 `.env.local` 后填写：

```bash
VITE_AMAP_KEY=your_amap_js_api_key
```

没有配置 `VITE_AMAP_KEY` 时，应用会自动显示艺术化上海地图 fallback，不会出现空白地图。

## 当前能力

- Vite + React + TypeScript
- 普通 CSS 与 CSS Variables
- 上海声音地图组件 `ShanghaiMap`
- 高德地图 JS API 2.0 加载服务预留
- 8 个以上 mock 声音节点
- 时间丝带筛选：`1990s`、`2010s`、`2026`、`Future Archive`
- 声音详情面板与波形动画
- Echo Agent mock 策展路线
- 上传声音 mock 流程

## 下一步接入高德地图

主要修改这些文件：

- `src/services/amap.ts`：补充插件、地图样式、控件和错误处理。
- `src/features/map/ShanghaiMap.tsx`：把当前绝对定位节点替换或同步为高德覆盖物。
- `.env.local`：添加真实 `VITE_AMAP_KEY`，不要提交。
- `src/data/soundNodes.ts`：后续可把 mock 坐标替换为真实数据库返回数据。
