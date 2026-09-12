import { asrEndpoint } from './apiEndpoint';
import { asrSettings } from './apiSettings';
import type {TranscriptSentence} from './transcriptTypes';
export class ContinuousTranscript {
 private socket:WebSocket;private queue:Uint8Array<ArrayBuffer>[]=[];private bytes=0;private ready=false;private ended=false;private done=false;private failed=false;
 private timer:ReturnType<typeof setTimeout>;private resolveEnd?:()=>void;private completion?:Promise<void>;
 constructor(private sentence:(s:TranscriptSentence)=>void,private status:(text:string,failed?:boolean)=>void){
  this.socket=new WebSocket(asrEndpoint());
  this.socket.onopen=()=>this.socket.send(JSON.stringify({type:'start',credentials:asrSettings()}));
  this.timer=setTimeout(()=>this.fail('转写连接超时，音频继续保存。'),16000);
  this.socket.onmessage=event=>{
   let m;try{m=JSON.parse(event.data);}catch{return this.fail('转写响应异常。');}
   if(m.type==='ready'){this.ready=true;clearTimeout(this.timer);this.status('连续转写中 · 浏览器个人配置 / 云端转发');for(const pcm of this.queue)this.socket.send(pcm);this.queue=[];this.bytes=0;if(this.ended)this.sendEnd();}
   if(m.type==='sentence'){
    if(typeof m.id!=='string'||typeof m.text!=='string'||!Number.isFinite(m.begin)||m.begin<0||m.end!==null&&(!Number.isFinite(m.end)||m.end<m.begin))return this.fail('转写时间戳无效。');
    this.sentence({id:m.id,text:m.text,begin:m.begin,end:m.end,final:m.final===true});
   }
   if(m.type==='done'){this.done=true;clearTimeout(this.timer);this.status('转写完成');this.resolveEnd?.();this.socket.close();}
   if(m.type==='error')this.fail(m.message||'转写中断，音频继续保存。');
  };
  this.socket.onerror=()=>this.fail('无法连接云端转写服务，请检查网络或稍后重试；音频继续保存。');
  this.socket.onclose=()=>{if(!this.done&&!this.failed)this.fail('转写连接中断，音频继续保存。');};
 }
 feed(pcm:Uint8Array){if(this.failed||this.ended)return;const copy=new Uint8Array(pcm);if(this.ready){if(this.socket.bufferedAmount>160000)return this.fail('转写积压，音频继续保存。');this.socket.send(copy);}else{this.bytes+=copy.length;if(this.bytes>480000)return this.fail('转写未就绪，音频继续保存。');this.queue.push(copy);}}
 private sendEnd(){this.socket.send(JSON.stringify({type:'finish'}));this.status('等待最后一句转写…');this.timer=setTimeout(()=>this.fail('最后一句转写超时，可从原录音重新转写。'),24000);}
 finish(){if(this.failed||this.done)return Promise.resolve();if(this.completion)return this.completion;this.ended=true;this.completion=new Promise<void>(resolve=>{this.resolveEnd=resolve;});if(this.ready)this.sendEnd();return this.completion;}
 private fail(message:string){if(this.failed||this.done)return;this.failed=true;clearTimeout(this.timer);this.queue=[];this.bytes=0;this.status(message,true);this.resolveEnd?.();this.socket.close();}
 dispose(){this.fail('转写已关闭，已有文字保留。');}
 get succeeded(){return this.done&&!this.failed;}
}
