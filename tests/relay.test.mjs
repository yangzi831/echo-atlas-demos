import test from 'node:test';import assert from 'node:assert/strict';import {createServer as viteServer} from 'vite';import {createServer,request} from 'node:http';import {WebSocket,WebSocketServer} from 'ws';
const vite=await viteServer({server:{middlewareMode:true,ws:false},cacheDir:'node_modules/.vite-tests/relay.test',optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});test.after(()=>vite.close());
const {createRelay}=await vite.ssrLoadModule('/server/relay.ts');
const {attachContinuousASR}=await vite.ssrLoadModule('/server/continuousASR.ts');
const origin='https://yangzi831.github.io';
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve(s.address().port)));
const send=(port,method,path,headers={},body)=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,method,path,headers},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end(body);});
test('转发服务允许 Pages 预检，拒绝未知来源、任意代理和缺少密钥',async()=>{
 const relay=createRelay(),port=await listen(relay);
 try{
 const headers={Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'};
 const pre=await send(port,'OPTIONS','/api/echo-ai',headers);assert.equal(pre.status,204);assert.equal(pre.headers['access-control-allow-origin'],origin);
 assert.equal((await send(port,'OPTIONS','/api/echo-ai',{...headers,Origin:'https://other.invalid'})).status,403);
 assert.equal((await send(port,'OPTIONS','/api/arbitrary',headers)).status,403);
 const missing=await send(port,'POST','/api/echo-ai',{Origin:origin,'Content-Type':'application/json'},JSON.stringify({task:'pact',text:'记住观点',credentials:{source:'browser'}}));assert.equal(missing.status,503);assert.equal(missing.headers['access-control-allow-origin'],origin);
 const health=await send(port,'GET','/health',{Origin:origin});assert.equal(health.status,200);assert.equal(health.headers['access-control-allow-origin'],origin);
 }finally{await new Promise(r=>relay.close(r));}
});
test('跨域 AI 请求携带个人密钥，提示词不包含密钥',async()=>{
 const relay=createRelay(),port=await listen(relay);const old=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent={url,options};return Response.json({output_text:JSON.stringify({title:'观点',summary:'记录重要观点',criteria:[],ids:[],shouldKeep:false,confidence:1})});};
 try{
 const r=await send(port,'POST','/api/echo-ai',{Origin:origin,'Content-Type':'application/json'},JSON.stringify({task:'pact',text:'记住观点',credentials:{source:'browser',apiKey:'test-personal'}}));
 assert.equal(r.status,200);assert.equal(sent.url,'https://apimux.top/v1/responses');assert.equal(sent.options.headers.Authorization,'Bearer test-personal');assert.equal(sent.options.body.includes('test-personal'),false);assert.equal(r.body.includes('test-personal'),false);
 }finally{globalThis.fetch=old;await new Promise(r=>relay.close(r));}
});
test('跨域 WebSocket 首帧鉴权，PCM 升采样且句子时间不变',async()=>{
 const upstream=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>upstream.once('listening',r));let connection,received;
 upstream.on('connection',ws=>ws.on('message',(raw,binary)=>{if(binary){received=Buffer.from(raw);ws.send(JSON.stringify({header:{event:'result-generated'},payload:{output:{sentence:{sentence_id:7,text:'重要观点',begin_time:120,end_time:920,sentence_end:true}}}}));}else{const data=JSON.parse(raw.toString());ws.send(JSON.stringify({header:{event:data.header.action==='run-task'?'task-started':'task-finished'}}));}}));
 const relay=createServer();attachContinuousASR(relay,{ALLOWED_ORIGINS:origin},(url,options)=>{connection={url,options};return new WebSocket(`ws://127.0.0.1:${upstream.address().port}`);});const port=await listen(relay);
 try{await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/api/echo-asr`,{origin});const timeout=setTimeout(()=>{ws.terminate();reject(Error('timeout'));},4000);ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'start',credentials:{source:'browser',asrKey:'asr-personal',region:'beijing'}})));ws.on('message',raw=>{try{const m=JSON.parse(raw.toString());if(m.type==='ready')ws.send(Buffer.from([1,0,254,255]));if(m.type==='sentence'){assert.equal(m.begin,120);assert.equal(m.end,920);assert.equal(m.id,'7');ws.send(JSON.stringify({type:'finish'}));}if(m.type==='error')throw Error(m.message);if(m.type==='done'){clearTimeout(timeout);ws.close();resolve();}}catch(e){clearTimeout(timeout);ws.terminate();reject(e);}});});assert.equal(connection.options.headers.Authorization,'Bearer asr-personal');assert.equal(connection.url.includes('asr-personal'),false);assert.deepEqual([...received],[1,0,1,0,254,255,254,255]);
 }finally{await new Promise(r=>relay.close(r));for(const ws of upstream.clients)ws.terminate();await new Promise(r=>upstream.close(r));}
});
