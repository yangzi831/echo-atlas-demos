import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,ws:false},appType:'custom'});
const {ListeningBuffer,measurePCM,silentFeatures}=await server.ssrLoadModule('/src/services/listeningAudio.ts');
const {CoListeningDecisionEngine,createListeningPact}=await server.ssrLoadModule('/src/services/coListeningDecision.ts');
const {recallMetadata}=await server.ssrLoadModule('/src/services/echoAI.ts');
const {echoAI}=await server.ssrLoadModule('/server/echoAI.ts');
test.after(()=>server.close());
test('长时间收音仅保留最近十秒快照，WAV 长度正确',async()=>{
 const ring=new ListeningBuffer();
 for(let i=0;i<4000;i++)ring.append(new Uint8Array(640));
 assert.equal(ring.totalSamples,1280000);
 const snapshot=ring.snapshot();assert.equal(snapshot.duration,10);assert.equal(snapshot.blob.size,160044);
 const header=new DataView(await snapshot.blob.arrayBuffer());assert.equal(header.getUint32(24,true),8000);assert.equal(header.getUint32(40,true),160000);
});
test('频谱测量区分静音和真实 PCM 正弦信号',()=>{
 assert.equal(measurePCM(new Uint8Array(640),silentFeatures).rms,0);
 const pcm=new Uint8Array(640),view=new DataView(pcm.buffer);
 for(let i=0;i<320;i++)view.setInt16(i*2,Math.round(Math.sin(i*2*Math.PI*1000/8000)*12000),true);
 const f=measurePCM(pcm,silentFeatures);assert.ok(f.rms>.1);assert.ok(Math.abs(f.frequencyCentroid-1000)<100);
});
test('前三秒不自动生成片段；冷却期不重复标记',()=>{
 const engine=new CoListeningDecisionEngine(),pact=createListeningPact(['任何我可能错过的意外'],'');
 const frame={rms:.1,peak:.2,spectralCentroid:400,activityDensity:.2,transientDensity:0,continuity:.8,timestamp:1000};
 engine.observe(frame,{elapsedMs:0,pact,hasActiveCandidate:false});
 const loud={...frame,rms:.9,peak:1,spectralCentroid:3000,continuity:0,timestamp:2000};
 assert.equal(engine.observe(loud,{elapsedMs:1000,pact,hasActiveCandidate:false}).shouldOfferMemory,false);
 assert.equal(engine.observe(loud,{elapsedMs:5000,pact,hasActiveCandidate:false,lastDecisionAt:1900}).shouldOfferMemory,false);
});
test('撤回记录不进入 GPT 候选池，音频 URL 不发送',()=>{
 const memory={id:'a',title:'测试',location:{placeName:'河边',city:'上海'},recordedAt:'2026',note:'雨声',tags:[],moods:[],audioUrl:'blob:private'};
 const result=recallMetadata([memory,{...memory,id:'b',aiJudgement:{reviewStatus:'rejected'}}]);
 assert.equal(result.length,1);assert.equal('audioUrl' in result[0],false);
});
test('缺少密钥安全返回 503，非法输入不会调用网关',async()=>{
 const {Readable}=await import('node:stream');
 const invoke=async(body)=>{const req=Readable.from([Buffer.from(JSON.stringify(body))]);Object.assign(req,{method:'POST',url:'/api/echo-ai',headers:{'content-type':'application/json'}});let result;const res={setHeader(){},end(body){result={status:this.statusCode,body:JSON.parse(body)};}};await echoAI({})(req,res,()=>{});return result;};
 assert.equal((await invoke({task:'pact',text:'今天听雨'})).status,503);
 assert.equal((await invoke({task:'bad',text:'test'})).status,400);
});
test('个人密钥仅用于鉴权，不进入 GPT 提示词或响应',async()=>{
 const {Readable}=await import('node:stream');const old=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent={url,options};return Response.json({output_text:JSON.stringify({title:'约定',summary:'一起听雨',criteria:[],ids:[],shouldKeep:false,confidence:1})});};
 try{
 const req=Readable.from([Buffer.from(JSON.stringify({task:'pact',text:'今天听雨',credentials:{apiKey:'fake-personal-key',model:'gpt-5.6-sol'}}))]);
 Object.assign(req,{method:'POST',url:'/api/echo-ai',headers:{'content-type':'application/json'}});
 let response;const res={setHeader(){},end(body){response={status:this.statusCode,body};}};
 await echoAI({OPENAI_API_KEY:'fake-server-key'})(req,res,()=>{});
 assert.equal(response.status,200);assert.equal(sent.options.headers.Authorization,'Bearer fake-personal-key');
 assert.equal(sent.options.body.includes('fake-personal-key'),false);assert.equal(sent.options.body.includes('credentials'),false);assert.equal(response.body.includes('fake-personal-key'),false);
 }finally{globalThis.fetch=old;}
});
