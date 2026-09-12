# SecondEar 蓝牙接入

`bluetooth.js` 和 `recorder-protocol.js` 复制自本项目的 `SecondEar_AI_Passport_Arduino/website/public/`（2026-09-13）。保留 UUID、ADPCM 解码、CRC 校验、补传和先暂存后确认逻辑。

接入修改：`receiveLive` 消费持续录音请求，防止恢复已有会话后再次自动启动。`input.ts` 在用户点击中选择设备，并将传输段在 IndexedDB 事务完成后交给协议确认。网页主流程从 `liveFrame` 接收 PCM，只对用户选中或本地检测到的事件建立独立声音记忆。

不要把模拟浏览器测试当作硬件验证。固件协议变化时应核对原始 Demo 和实机。
