import {Parser,wavHeader,decodeADPCM,SERVICE as LEGACY_SERVICE,COMMAND,STREAM,crc32} from './recorder-protocol.js';
export const SERVICE='8f3a0011-5b9e-4b22-8c18-534150524543';
const META='8f3a0012-5b9e-4b22-8c18-534150524543', DATA='8f3a0013-5b9e-4b22-8c18-534150524543', CONTROL='8f3a0014-5b9e-4b22-8c18-534150524543';
export function parseMeta(v){
 if(![20,40].includes(v.byteLength)||![0x31304553,0x32304553,0x33304553,0x34304553,0x35304553].includes(v.getUint32(0,true)))throw Error('设备协议不兼容');
 const m={push:[0x34304553,0x35304553].includes(v.getUint32(0,true)),sampleRate:[0x33304553,0x34304553,0x35304553].includes(v.getUint32(0,true))?8000:16000,compressed:v.getUint32(0,true)!==0x31304553,boot:v.getUint32(4,true),id:v.getUint32(8,true),bytes:v.getUint32(12,true),crc:v.getUint32(16,true)};
 if(v.getUint32(0,true)===0x35304553){if(v.byteLength!==40)throw Error('持续录音元数据长度无效');Object.assign(m,{liveCapable:true,liveState:v.getUint32(20,true),produced:v.getUint32(24,true),acked:v.getUint32(28,true),samples:v.getUint32(32,true)});if(m.liveState>3||m.acked>m.produced||m.produced-m.acked>250)throw Error('持续录音队列无效');}
 if(m.bytes>(m.compressed?m.sampleRate/320*10*164:320000)||m.bytes%(m.compressed?164:2))throw Error('设备录音长度无效');return m;
}
export class RecorderReceiver{
 constructor(onComplete,onProgress){this.parser=new Parser();this.onComplete=onComplete;this.onProgress=onProgress;this.current=null;}
 feed(bytes){for(const f of this.parser.feed(bytes)){
  if(f.kind===1)continue;
  if(f.kind===5){this.current=null;throw Error('设备中止录音，此次录音未上传');}
  if(f.kind===2){if(this.current)throw Error('上一段录音尚未结束');if(f.sequence!==0||String(f.payload)!=='128,62,0,0,16,1')throw Error('设备音频格式不兼容');this.current={session:f.session,seq:1,parts:[],bytes:0};continue;}
  const r=this.current;if(!r)continue;
  if(f.session!==r.session||f.sequence!==r.seq++)throw Error('蓝牙音频丢包，请重新录制');
  if(f.kind===3||f.kind===6){const p=f.kind===6?decodeADPCM(f.payload):f.payload;if(!p.length||p.length%2)throw Error('音频长度无效');r.parts.push(p);r.bytes+=p.length;if(r.bytes>32*1024*1024-44)throw Error('录音超过网站单次 32MB 限制');this.onProgress(r.bytes,0);}
  else if(f.kind===4){if(f.payload.length!==4||new DataView(f.payload.buffer,f.payload.byteOffset,4).getUint32(0,true)!==r.bytes)throw Error('录音长度校验失败');this.current=null;this.onComplete(new Blob([wavHeader(r.bytes),...r.parts],{type:'audio/wav'}));}
 }}
}
export class EarLink{
 constructor({status,progress,save,state,liveStart,liveFrame,liveEnd}){Object.assign(this,{status,progress,save,state,liveStart,liveFrame,liveEnd});this.device=null;this.connected=false;this.busy=false;this.auto=true;this.stopped=false;this.attempt=0;this.generation=0;}
 async choose(){this.stopped=false;const device=await navigator.bluetooth.requestDevice({filters:[{services:[SERVICE]},{services:[LEGACY_SERVICE]}],optionalServices:[SERVICE,LEGACY_SERVICE]});await this.connect(device);}
 async restore(){const id=localStorage.getItem('second-ear-device');if(!id)return;if(!navigator.bluetooth?.getDevices){this.status('此浏览器刷新后需要点击连接并选择 SecondEar；页面保持打开时会尝试断线重连。');return;}const devices=await navigator.bluetooth.getDevices();const d=devices.find(x=>x.id===id);if(d){this.stopped=false;await this.connect(d);}else this.status('请点击连接，重新授权 SecondEar；已保存的录音仍在档案中。');}
 async connect(device){
  if(this.busy||this.connected)return;this.busy=true;clearTimeout(this.timer);this.generation++;this.device=device;this.state('connecting');this.status('正在连接设备…');
  try{
   device.removeEventListener('gattserverdisconnected',this.onDisconnect);this.onDisconnect=()=>this.lost();device.addEventListener('gattserverdisconnected',this.onDisconnect);
   const server=await device.gatt.connect();let service;
   try{service=await server.getPrimaryService(SERVICE)}catch{service=await server.getPrimaryService(LEGACY_SERVICE)}
   this.connected=true;this.attempt=0;localStorage.setItem('second-ear-device',device.id);
   if(service.uuid===SERVICE){this.meta=await service.getCharacteristic(META);this.data=await service.getCharacteristic(DATA);this.control=await service.getCharacteristic(CONTROL);this.state('secondear');this.status('SecondEar 已连接。按设备 OK，保存刚刚过去的十秒。');this.poll();}
   else{
    this.command=await service.getCharacteristic(COMMAND);this.stream=await service.getCharacteristic(STREAM);this.lastFrame=Date.now();
    this.receiver=new RecorderReceiver(blob=>this.save(blob).catch(e=>this.status(e.message,true)),(b,t)=>{this.lastFrame=Date.now();this.progress(b,t)});
    this.notify=e=>{try{this.lastFrame=Date.now();const v=e.target.value;this.receiver.feed(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));}catch(err){this.status(err.message,true);this.disconnect();}};
    this.stream.addEventListener('characteristicvaluechanged',this.notify);await this.stream.startNotifications();this.state('connected');this.status('Passport Recorder 已连接。按住确定键录音，松开自动保存。');this.heartbeat();
   }
  }catch(e){this.lastError=e.message;this.connected=false;device.gatt?.disconnect();this.state('disconnected');throw e;}finally{this.busy=false;}
 }
 async heartbeat(){if(!this.connected||!this.command)return;try{if(Date.now()-this.lastFrame>6000)throw Error('设备响应超时');await this.command.writeValueWithResponse(new TextEncoder().encode('PR1\n'));this.timer=setTimeout(()=>this.heartbeat(),500);}catch(e){this.status(e.message,true);this.device?.gatt?.disconnect();}}
 shutter(){if(!this.connected||!this.meta)throw Error('请连接 SecondEar 设备');this.wantCapture=true;this.status('已请求设备留下刚刚过去的十秒…');}
 async operation(op,m,offset=0){const b=new Uint8Array(13),v=new DataView(b.buffer);b[0]=op;v.setUint32(1,m.boot,true);v.setUint32(5,m.id,true);v.setUint32(9,offset,true);await this.control.writeValueWithResponse(b);}
 async receivePush(m,pcm){
  const generation=this.generation;let offset=0,last=performance.now(),retries=0;
  const characteristic=this.data;
  const listener=e=>{const v=e.target.value;if(v.byteLength<=8||v.getUint32(0,true)!==m.id)return;const at=v.getUint32(4,true);if(at!==offset||offset+v.byteLength-8>m.bytes)return;pcm.set(new Uint8Array(v.buffer,v.byteOffset+8,v.byteLength-8),offset);offset+=v.byteLength-8;last=performance.now();this.progress(offset/164*640,m.bytes/164*640,m.sampleRate);};
  characteristic.addEventListener('characteristicvaluechanged',listener);
  try{await characteristic.startNotifications();await this.operation(4,m);
   while(offset<m.bytes){if(!this.connected||generation!==this.generation)throw Error('接收中断，录音仍保留在设备');await new Promise(r=>setTimeout(r,40));if(performance.now()-last>1500){if(++retries>5)throw Error('蓝牙补传超时，录音保留在设备');await this.operation(4,m,offset);last=performance.now();}}
  }finally{characteristic.removeEventListener('characteristicvaluechanged',listener);if(this.connected)await characteristic.stopNotifications().catch(()=>{});}
  return offset;
 }
 startLive(){this.wantLive=true;this.status('正在开始持续录音…');}
 stopLive(){this.wantStop=true;this.status('正在停止并保存最后一段…');}
 async receiveLive(initial){
  this.wantLive=false;
  const generation=this.generation,characteristic=this.data;let m=initial,next=m.acked,queue=[],last=performance.now(),lastMeta=0,retries=0,savedSamples=0,segments=0,repairs=0;
  this.state('live');this.liveStart?.(initial);
  const listener=e=>{const v=e.target.value;if(v.byteLength!==178||v.getUint32(0,true)!==m.id)return;const bytes=new Uint8Array(v.buffer,v.byteOffset,174),at=v.getUint32(4,true)/164,count=v.getUint16(8,true);if(at!==next||count<1||count>320||crc32(bytes)!==v.getUint32(174,true))return;const pcm=decodeADPCM(bytes.slice(10,174)).slice(0,count*2);queue.push({pcm,count});this.liveFrame?.(pcm);next++;last=performance.now();retries=0;};
  const flush=async count=>{const batch=queue.slice(0,count),samples=batch.reduce((n,b)=>n+b.count,0);await this.save(new Blob([wavHeader(samples*2,8000),...batch.map(b=>b.pcm)],{type:'audio/wav'}),{session:`${m.boot}-${m.id}`,offset:(next-queue.length)*320});await this.operation(7,m,next-queue.length+count);queue.splice(0,count);savedSamples+=samples;segments++;};
  characteristic.addEventListener('characteristicvaluechanged',listener);
  try{await characteristic.startNotifications();await this.operation(8,m,next);
   for(;;){
    if(!this.connected||generation!==this.generation)throw Error('蓝牙已断开，设备已停止持续录音；重连后接收剩余声音。');
    if(this.wantStop){this.wantStop=false;await this.operation(6,m);lastMeta=0;}
    if(performance.now()-lastMeta>500){m=parseMeta(await this.meta.readValue());lastMeta=performance.now();if(m.boot!==initial.boot||m.id!==initial.id)throw Error('设备录音会话已改变');}
    if(queue.length>=125)await flush(125);
    if(m.liveState!==1 && next>=m.produced){if(queue.length)await flush(queue.length);else await this.operation(7,m,next);await this.liveEnd?.(m);this.status(m.liveState===3?'蓝牙或保存速度不足，设备已停止，已接收声音已分段保存。':`持续录音已结束，本次接收 ${(savedSamples/8000).toFixed(2)} 秒，保存 ${segments} 段，补传 ${repairs} 次。`);break;}
    this.progress((savedSamples+queue.reduce((n,b)=>n+b.count,0))*2,0,8000);
    this.status(`持续录音中 · 已分段暂存 ${(savedSamples/8000).toFixed(1)} 秒 · 缓冲 ${queue.length} 帧`);
    if(performance.now()-last>1500 && next<m.produced){if(++retries>5)throw Error('蓝牙持续接收超时');repairs++;await this.operation(8,m,next);last=performance.now();}
    await new Promise(r=>setTimeout(r,40));
   }
  }catch(e){this.liveEnd?.(m,true);if(this.connected){await this.operation(6,m).catch(()=>{});if(queue.length)await flush(queue.length).catch(()=>{});}throw e;}
  finally{characteristic.removeEventListener('characteristicvaluechanged',listener);if(this.connected&&generation===this.generation){await characteristic.stopNotifications().catch(()=>{});this.state('secondear');}}
 }
 async poll(){
  if(!this.connected||!this.meta)return;
  const generation=this.generation;
  try{
   const m=parseMeta(await this.meta.readValue());
   if(m.liveState){await this.receiveLive(m);}
   else if(this.wantLive){this.wantLive=false;if(!m.liveCapable)throw Error('设备需要更新持续录音固件');if(m.bytes)throw Error('请等待上一段录音保存后再开始');await this.operation(5,m);}
   if(this.wantCapture){this.wantCapture=false;await this.operation(3,m);}
   if(m.bytes){const started=performance.now();const pcm=new Uint8Array(m.bytes);let offset=0;this.status('发现一段新的声音，正在从设备接收…');
    if(m.push)offset=await this.receivePush(m,pcm);
    while(offset<m.bytes&&this.connected&&generation===this.generation){await this.operation(1,m,offset);const v=await this.data.readValue();if(v.byteLength<=4||v.getUint32(0,true)!==offset||offset+v.byteLength-4>m.bytes)throw Error('蓝牙分片校验失败，重连后可重试');pcm.set(new Uint8Array(v.buffer,v.byteOffset+4,v.byteLength-4),offset);offset+=v.byteLength-4;this.progress(m.compressed?offset/164*640:offset,m.compressed?m.bytes/164*640:m.bytes,m.sampleRate);}
    if(offset!==m.bytes)throw Error('接收中断，录音仍保留在设备');
    if(crc32(pcm)!==m.crc)throw Error('录音校验失败，未上传；将重新接收');
    // save resolves only after IndexedDB has committed, so acknowledging is safe even if HTTP is offline.
    const parts=m.compressed?Array.from({length:m.bytes/164},(_,i)=>decodeADPCM(pcm.slice(i*164,(i+1)*164))):[pcm];
    await this.save(new Blob([wavHeader(m.compressed?m.bytes/164*640:m.bytes,m.sampleRate),...parts],{type:'audio/wav'}));await this.operation(2,m);
    const seconds=(performance.now()-started)/1000,duration=(m.compressed?m.bytes/164*320:m.bytes/2)/m.sampleRate;const result={bytes:m.bytes,seconds,duration,kbps:m.bytes*8/seconds/1000,realtimeFactor:duration/seconds,sampleRate:m.sampleRate};if(typeof localStorage!=="undefined")localStorage.setItem("second-ear-benchmark",JSON.stringify(result));this.status(`蓝牙接收完成 · ${result.kbps.toFixed(1)} kbps · ${duration.toFixed(1)} 秒音频耗时 ${seconds.toFixed(2)} 秒 · ${result.realtimeFactor.toFixed(2)} 倍实时速度`);
   }
  }catch(e){this.status(e.message,true);}
  if(this.connected&&generation===this.generation)this.timer=setTimeout(()=>this.poll(),1500);
 }
 lost(){this.generation++;clearTimeout(this.timer);this.connected=false;this.receiver=null;this.state('disconnected');this.meta=null;this.command=null;if(this.stream&&this.notify)this.stream.removeEventListener('characteristicvaluechanged',this.notify);this.stream=null;
  if(!this.stopped&&this.auto&&this.attempt<5){const wait=Math.min(15000,1000*2**this.attempt++);this.status('蓝牙已断开，正在等待自动重连…'+(this.lastError?' '+this.lastError:''));this.timer=setTimeout(()=>this.connect(this.device).catch(e=>{this.status(e.message,true);this.lost()}),wait);}
 }
 disconnect(){this.stopped=true;clearTimeout(this.timer);this.device?.gatt?.disconnect();this.lost();}
}
