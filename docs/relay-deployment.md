# Echo Atlas 云端转发服务

核实日期：2026-09-13。前端保留 GitHub Pages，AI 与连续转写由独立服务转发。这里只描述本次实际部署，不代表真实蓝牙硬件已验收。

## 部署位置

| 项目 | 值 |
| --- | --- |
| 前端 | https://yangzi831.github.io/echo-atlas-demos/ |
| 服务 | https://echo-atlas-api.giraffetree.cn |
| 健康检查 | https://echo-atlas-api.giraffetree.cn/health |
| 服务器 | 39.104.81.6，CentOS 7.9 |
| 程序目录 | `/opt/echo-atlas-api/current` → `releases/20260913-0303` |
| systemd | `echo-atlas-api.service`，专用用户 `echo-atlas-api` |
| Node | `/opt/node-v22.22.2-glibc-217/bin/node`，v22.22.2 |
| 监听地址 | `127.0.0.1:3198`，不对公网开放此端口 |
| Nginx | `/etc/nginx/conf.d/echo-atlas-api.giraffetree.cn.conf` |
| TLS | 复用服务器现有 `*.giraffetree.cn` 证书，本次核实有效期至 2026-11-24 |
| DNS | A，RR `echo-atlas-api` → `39.104.81.6`，TTL 600 |
| AliDNS record_id | `2098849223130400768` |

CentOS 7 已结束维护；本次复用现有服务器，没有升级系统或修改其他站点、数据库、端口规则。

## 数据流与配置

1. 浏览器从当前站点的 localStorage 读取个人 ApiMux / DashScope 密钥。
2. AI 使用 `POST /api/echo-ai`；密钥在 HTTPS 请求体单独字段中传递。服务器从提示词中移除密钥，仅向固定 ApiMux 网关发送鉴权头。
3. 连续转写使用 `wss://echo-atlas-api.giraffetree.cn/api/echo-asr`；密钥通过连接后的首个 JSON 帧传递，不放在 URL 或 WebSocket 子协议中。
4. 服务器连接固定的 DashScope 服务，添加 Authorization，转发 PCM 与逐句结果。音频从 8 kHz 扩展至 16 kHz，句子时间仍相对于原始录音。
5. 录音与转写仍由浏览器 IndexedDB 保存。转发服务没有数据库，不将密钥、请求体、音频或转写写入磁盘；本服务 Nginx 访问日志关闭，请求和响应不使用磁盘缓冲。

生产入口 `server/main.ts` 不加载开发者 `.env.local`，不读取服务器 API 密钥。没有个人密钥时明确报错。服务端不接受任意目标 URL，不是通用开放代理。

CORS 与 WebSocket Origin 允许 `https://yangzi831.github.io`、服务自身、`http://127.0.0.1:5173`、`http://localhost:5173`。不匹配的来源被拒绝。Origin 不是用户身份认证，调用方仍须提供自己的有效供应商密钥。服务设置并发、请求体和请求频率上限，适合当前 Demo。

## 构建与维护

```bash
npm ci
npm test
npm run build
npm run build:relay
```

后端产物为 `relay-dist/server.cjs`，已经打包运行依赖。只上传这个文件，无需服务器安装 npm 依赖，更不要上传 `.env*`、本地录音或 `.git`。

新版本上传到 `/opt/echo-atlas-api/releases/<新版本>/server.cjs`，将 `current` 原子切换到该目录，然后 `systemctl restart echo-atlas-api`。保留前一个健康版本，可回切 `current` 并重启该服务。模板位于 `deploy/`；不要覆盖其他站点配置。修改 Nginx 后必须先 `nginx -t` 再 reload。

前端默认地址在 `src/services/apiEndpoint.ts`；可用公开构建变量 `VITE_ECHO_API_BASE_URL` 改为自建转发地址。新增前端域名时同步设置服务的 `ALLOWED_ORIGINS`，不能只修改前端地址。GitHub Pages 的发布不自动更新独立后端，后端修改需另行部署。

## 验证记录

- 前端与后端构建通过，包含 CORS、跨域密钥隔离、WebSocket PCM 与时间戳的自动测试通过。
- 源站 HTTPS、HTTP 跳转、systemd 服务、浏览器 Origin 预检已通过。
- AliDNS 控制面、阿里 DNS-over-HTTPS 与 Google DNS-over-HTTPS 均返回正确 IP。
- 从 GitHub Pages 的真实浏览器 Origin 发起请求：缺少密钥返回 503；17.93 秒合成音频共 143453 个采样完整转发，返回 80–17840 ms 的句子范围；真实 `gpt-5.6-sol` 返回对应语义命中。详见 [脱敏验证结果](relay-qa/cloud-services.json)。测试使用合成语音，不是现场蓝牙录音。

- 生产构建页面验收：设置密钥并保存，刷新后仍可读取；点击「请 AI 理解这份约定」实际请求专用域名，返回 200，页面无脚本错误。前端 `ContinuousTranscript` 也使用真实云端完成同一合成音频转写；其连接 URL 仅含服务路径，不含密钥。
