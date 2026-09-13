import {build} from 'esbuild';
await build({entryPoints:['server/main.ts'],outfile:'relay-dist/server.cjs',bundle:true,platform:'node',format:'cjs',target:'node22',external:['bufferutil','utf-8-validate'],sourcemap:false});
