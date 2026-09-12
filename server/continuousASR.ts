import { requestSettings } from './requestSettings';
import type { HttpServer } from 'vite';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

/** Same Fun-ASR wire protocol as the local SecondEar demo, mounted on this site. */
export function attachContinuousASR(server: HttpServer | null, env: Record<string,string>) {
 if (!server) return;
 const wss = new WebSocketServer({noServer:true,maxPayload:32000});
 const sessions = new Set<() => void>();
 server.on('upgrade',(req,socket,head)=>{
  if (req.url?.split('?')[0] !== '/api/echo-asr') return;
  let validOrigin=false;try{validOrigin=!!req.headers.origin&&new URL(req.headers.origin).host===req.headers.host;}catch{}
  if(!validOrigin||sessions.size>=3){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,client=>{
   const emit=(data:unknown)=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(data));};
   const pendingClose=()=>client.close();sessions.add(pendingClose);
   const initTimer=setTimeout(()=>client.close(),10000);
   client.once('close',()=>{clearTimeout(initTimer);sessions.delete(pendingClose);});
   client.once('error',()=>client.close());
   client.once('message',(raw,binary)=>{
   clearTimeout(initTimer);sessions.delete(pendingClose);
   let config:Record<string,string>;let source='server';
   try{const m=JSON.parse(raw.toString());if(binary||m.type!=='start')throw new Error();config=requestSettings(m.credentials,env,'asr');source=m.credentials?.source==='browser'||m.credentials?.asrKey?'browser':'server';}catch{emit({type:'error',message:'转写配置无效。'});client.close();return;}
   if(!config.DASHSCOPE_API_KEY){emit({type:'error',message:'缺少 DashScope 转写密钥，请在 API 设置中填写；录音仍会保存。'});client.close();return;}
   const region=config.DASHSCOPE_REGION||'beijing';
   if(!['beijing','singapore'].includes(region)){emit({type:'error',message:'转写地域配置无效。'});client.close();return;}
   const workspace=config.DASHSCOPE_WORKSPACE_ID;
   if(workspace&&!/^[a-zA-Z0-9-]+$/.test(workspace)){client.close();return;}
   const host=config.DASHSCOPE_USE_WORKSPACE_DOMAIN==='true'&&workspace?`${workspace}.${region==='beijing'?'cn-beijing':'ap-southeast-1'}.maas.aliyuncs.com`:region==='beijing'?'dashscope.aliyuncs.com':'dashscope-intl.aliyuncs.com';
   const upstream=new WebSocket(`wss://${host}/api-ws/v1/inference`,{headers:{Authorization:`Bearer ${config.DASHSCOPE_API_KEY}`},handshakeTimeout:12000});
   const task=randomUUID();let ready=false,done=false,closed=false,finishing=false,last=Date.now(),samples=0;
   let timer:ReturnType<typeof setTimeout>;
   const close=()=>{if(closed)return;closed=true;clearTimeout(timer);clearInterval(watch);sessions.delete(close);upstream.close();client.close();};
   const fail=(message='连续转写中断，原录音仍会保存，可在结束后重新转写。')=>{if(closed)return;emit({type:'error',message});close();};
   const watch=setInterval(()=>{if(Date.now()-last>30000)fail();},5000);
   sessions.add(close);timer=setTimeout(()=>fail('转写连接超时，原录音仍会保存。'),15000);
   upstream.on('open',()=>upstream.send(JSON.stringify({header:{action:'run-task',task_id:task,streaming:'duplex'},payload:{task_group:'audio',task:'asr',function:'recognition',model:'fun-asr-realtime',parameters:{format:'pcm',sample_rate:16000},input:{}}})));
   upstream.on('message',raw=>{
    let m;try{m=JSON.parse(raw.toString());}catch{return fail();}
    const event=m.header?.event;
    if(event==='task-started'){ready=true;clearTimeout(timer);emit({type:'ready',model:'fun-asr-realtime',source});}
    if(event==='result-generated'){
     const s=m.payload?.output?.sentence;
     if(s&&!s.heartbeat&&typeof s.text==='string'&&s.text.trim()){
      const begin=Number(s.begin_time),end=s.end_time==null?null:Number(s.end_time);
      if(!Number.isFinite(begin)||begin<0||end!==null&&(!Number.isFinite(end)||end<begin)){return fail('转写返回的时间信息无效，未建立错误音频定位。');}
      emit({type:'sentence',id:String(s.sentence_id??begin),text:s.text,begin,end,final:!!s.sentence_end});
     }
    }
    if(event==='task-finished'){done=true;emit({type:'done',samples});close();}
    if(event==='task-failed')fail('转写服务拒绝任务，请检查 DashScope 密钥、地域及 Fun-ASR 权限；原录音仍会保存。');
   });
   upstream.on('unexpected-response',(_request,response)=>{response.resume();fail(response.statusCode===401||response.statusCode===403?'转写鉴权失败，请检查 DashScope 密钥、所属地域和工作空间。':'转写服务连接被拒绝，请检查地域、配额及网络。');});
   upstream.on('error',()=>fail('无法连接转写服务，请检查网络及转写地域；原录音仍会保存。'));upstream.on('close',()=>{if(!done)fail();});
   client.on('message',(raw,binary)=>{
    last=Date.now();if(!ready||finishing)return fail();
    if(binary){
     const input=Buffer.isBuffer(raw)?raw:Buffer.from(raw as ArrayBuffer);
     if(!input.length||input.length%2||upstream.bufferedAmount>640000)return fail('转写链路积压，原录音继续保存。');
     // 8 kHz PCM -> 16 kHz PCM; duplicates samples, preserving exact duration.
     const pcm=Buffer.alloc(input.length*2);
     for(let i=0;i<input.length/2;i++){const sample=input.readInt16LE(i*2);pcm.writeInt16LE(sample,i*4);pcm.writeInt16LE(sample,i*4+2);}
     samples+=input.length/2;upstream.send(pcm);
    }else{
     let m;try{m=JSON.parse(raw.toString());}catch{return fail();}
     if(m.type!=='finish')return fail();finishing=true;
     upstream.send(JSON.stringify({header:{action:'finish-task',task_id:task,streaming:'duplex'},payload:{input:{}}}));
     timer=setTimeout(()=>fail('最后一句转写超时，原录音仍可重新转写。'),22000);
    }
   });
   client.on('close',close);client.on('error',close);
   });
  });
 });
 server.once('close',()=>{sessions.forEach(close=>close());wss.close();});
}
