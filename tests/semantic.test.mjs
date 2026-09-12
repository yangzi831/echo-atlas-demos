import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,ws:false},cacheDir:'node_modules/.vite-tests/semantic.test',optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});test.after(()=>server.close());
const {SemanticListener}=await server.ssrLoadModule('/src/services/semanticListener.ts');
const {validSentences,validateSelection}=await server.ssrLoadModule('/server/semanticSelection.ts');
const {absoluteTime}=await server.ssrLoadModule('/src/services/transcriptTypes.ts');
const fakeRequest=async(input)=>{const r=await fetch('https://test.invalid',{body:JSON.stringify(input)});const data=await r.json();if(!r.ok)throw Error(data.error);return data;};
const pact={id:'test',selectedCriteria:['记住旅行中偶然的交流'],freeformIntention:'记住旅行中偶然的交流',createdAt:'2026-09-13T06:00:00Z'};
const sentence=i=>({id:String(i),text:'测试句子'+i,begin:i*1000,end:(i+1)*1000,final:true});
test('时间以原始录音为基准，不受模型返回时刻影响',()=>{assert.equal(absoluteTime('2026-09-13T06:00:00.000Z',18000),'2026-09-13T06:00:18.000Z');});
test('拒绝虚构证据、倒序时间和重复句子 ID',()=>{
 assert.equal(validSentences({sentences:[sentence(1),sentence(0)]}),false);assert.equal(validSentences({sentences:[sentence(0),sentence(0)]}),false);
 assert.throws(()=>validateSelection({contextSummary:'test',waitForMore:false,matches:[{title:'t',reason:'r',startId:'0',endId:'1',evidenceIds:['unknown'],confidence:.8}]},[sentence(0),sentence(1)]));
});
test('批次串行处理，不丢掉积压的较早句子',async()=>{
 const old=globalThis.fetch,requests=[];let running=0,maxRunning=0;
 globalThis.fetch=async(_url,options)=>{running++;maxRunning=Math.max(maxRunning,running);requests.push(JSON.parse(options.body));await new Promise(r=>setTimeout(r,2));running--;return Response.json({matches:[],contextSummary:'test',waitForMore:false,model:'test'});};
 const listener=new SemanticListener(pact,async()=>{},()=>{},async()=>{},fakeRequest);
 try{for(let i=0;i<45;i++)listener.add(sentence(i));await listener.finish();assert.equal(requests.length,3);assert.equal(requests[0].sentences[0].id,'0');assert.equal(requests[0].sentences.at(-1).id,'19');assert.equal(requests[2].sentences.at(-1).id,'44');assert.equal(maxRunning,1);assert.equal(listener.succeeded,true);}finally{listener.dispose();globalThis.fetch=old;}
});
test('暂不完整的对话在停止时再次分析，并抑制重复片段',async()=>{
 const old=globalThis.fetch,requests=[];let count=0;
 globalThis.fetch=async(_url,options)=>{const input=JSON.parse(options.body);requests.push(input);return Response.json({matches:[{title:'t',reason:'r',startId:'0',endId:'0',evidenceIds:['0'],confidence:.9}],contextSummary:'test',waitForMore:!input.ending,model:'test'});};
 const listener=new SemanticListener(pact,async()=>{count++;},()=>{},async()=>{},fakeRequest);
 try{listener.add(sentence(0));await listener.retry();await listener.finish();assert.equal(requests.length,2);assert.equal(requests[1].ending,true);assert.equal(count,1);}finally{listener.dispose();globalThis.fetch=old;}
});
test('服务失败保留待处理句子，重试后才标记完成',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>++calls===1?Response.json({error:'temporary'},{status:503}):Response.json({matches:[],contextSummary:'test',waitForMore:false,model:'test'});
 const listener=new SemanticListener(pact,async()=>{},()=>{},async()=>{},fakeRequest);
 try{listener.add(sentence(0));await listener.finish();assert.equal(listener.succeeded,false);await listener.retry();assert.equal(listener.succeeded,true);}finally{listener.dispose();globalThis.fetch=old;}
});
test('个人密钥按请求隔离，清空后回退服务端配置',async()=>{
 const {requestSettings}=await server.ssrLoadModule('/server/requestSettings.ts');
 const env={OPENAI_API_KEY:'server-test',BASE_URL:'https://example.invalid',DASHSCOPE_API_KEY:'server-asr',DASHSCOPE_REGION:'singapore'};
 const a=requestSettings({apiKey:'personal-test',model:'gpt-5.6-sol'},env,'ai');
 assert.equal(a.OPENAI_API_KEY,'personal-test');assert.equal(a.BASE_URL,'https://apimux.top');
 assert.equal(env.OPENAI_API_KEY,'server-test');assert.equal(requestSettings({},env,'ai').OPENAI_API_KEY,'server-test');
 assert.equal(requestSettings({asrKey:'personal-asr'},env,'asr').DASHSCOPE_REGION,'beijing');
 assert.throws(()=>requestSettings({asrKey:'key\ninvalid'},env,'asr'));
 assert.throws(()=>requestSettings({region:'unknown'},env,'asr'));
});
test('浏览器配置可重新读取与清除，损坏存储安全回退',async()=>{
 const settings=await server.ssrLoadModule('/src/services/apiSettings.ts');
 const old=globalThis.localStorage;const values=new Map();
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 try{settings.saveApiSettings({...settings.defaultApiSettings,apiKey:'test-only',asrKey:'asr-test'});assert.equal(settings.readApiSettings().apiKey,'test-only');assert.deepEqual(settings.aiSettings(),{source:'browser',apiKey:'test-only',model:''});settings.clearApiSettings();assert.equal(settings.readApiSettings().apiKey,'');values.set('echo-atlas-api-settings-v1','invalid');assert.equal(settings.readApiSettings().asrKey,'');}finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;}
});

test('保存浏览器配置后，空字段不会偷偷使用服务端密钥或模型',async()=>{
 const {requestSettings}=await server.ssrLoadModule('/server/requestSettings.ts');
 const env={OPENAI_API_KEY:'server-key',DASHSCOPE_API_KEY:'server-asr',LLM_MODEL:'server-model',DASHSCOPE_REGION:'singapore'};
 const ai=requestSettings({source:'browser',apiKey:'personal'},env,'ai');assert.equal(ai.OPENAI_API_KEY,'personal');assert.equal(ai.LLM_MODEL,'gpt-5.6-sol');
 assert.equal(requestSettings({source:'browser'},env,'ai').OPENAI_API_KEY,undefined);
 assert.equal(requestSettings({source:'browser'},env,'asr').DASHSCOPE_API_KEY,undefined);
 assert.equal(requestSettings({},env,'asr').DASHSCOPE_API_KEY,'server-asr');
});
