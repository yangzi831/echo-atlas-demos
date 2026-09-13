import { attachContinuousASR } from './server/continuousASR';
import { echoAI } from './server/echoAI';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/echo-atlas-demos/',
  plugins: [react(), {
    name: 'echo-ai-server',
    configureServer(server) { const env = {...loadEnv(mode, process.cwd(), ''), ...process.env} as Record<string, string>; server.middlewares.use(echoAI(env)); attachContinuousASR(server.httpServer, env); },
    configurePreviewServer(server) { const env = {...loadEnv(mode, process.cwd(), ''), ...process.env} as Record<string, string>; server.middlewares.use(echoAI(env)); attachContinuousASR(server.httpServer, env); },
  }],
  resolve: {
    dedupe: ['three'],
  },
  optimizeDeps: {
    exclude: ['@sparkjsdev/spark'],
  },
}));
