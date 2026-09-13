import test from 'node:test';import assert from 'node:assert/strict';
import {EarLink} from '../src/services/secondEar/bluetooth.js';
function metadata(state){const v=new DataView(new ArrayBuffer(40));[0x35304553,1,2,0,0,state,0,0,0,0].forEach((n,i)=>v.setUint32(i*4,n,true));return v;}
test('开始聆听时先恢复旧尾段，再发起新的持续录制，不触发本次结束',async()=>{
 const calls=[];let reads=0;const link=new EarLink({status:()=>{},state:()=>{},save:async()=>{},recover:async()=>{},liveEnd:()=>calls.push('end')});link.connected=true;link.wantLive=true;
 link.meta={readValue:async()=>metadata(reads++===0?2:0)};
 link.receiveLive=async(meta,recovering,starting)=>{if(starting){assert.equal(meta.liveState,0);assert.equal(recovering,false);link.wantLive=false;calls.push('start');return;}assert.equal(meta.liveState,2);assert.equal(recovering,true);assert.equal(link.wantLive,true);calls.push('recover');};
 link.operation=async op=>calls.push(op);
 try{await link.poll();assert.deepEqual(calls,['recover','start']);assert.equal(link.wantLive,false);}finally{clearTimeout(link.timer);}
});
test('旧录音恢复失败时不启动新录制，不清除开始请求',async()=>{
 const calls=[];const link=new EarLink({status:(m,failed)=>{if(failed)calls.push(m);},state:()=>{},save:async()=>{},recover:async()=>{}});link.connected=true;link.wantLive=true;link.meta={readValue:async()=>metadata(2)};
 link.receiveLive=async()=>{throw Error('存储失败');};link.operation=async()=>calls.push('start');
 try{await link.poll();assert.deepEqual(calls,['存储失败']);assert.equal(link.wantLive,true);}finally{clearTimeout(link.timer);}
});
test('活动录音保持接收，不重新发起或结束',async()=>{
 let live=false;const link=new EarLink({status:()=>{},state:()=>{},save:async()=>{}});link.connected=true;link.wantLive=true;link.meta={readValue:async()=>metadata(1)};
 link.receiveLive=async(m,recovering)=>{assert.equal(m.liveState,1);assert.equal(recovering,undefined);live=true;};link.operation=async()=>assert.fail('不应重新启动活动录音');
 try{await link.poll();assert.equal(live,true);}finally{clearTimeout(link.timer);}
});

import {parseMeta} from '../src/services/secondEar/bluetooth.js';
import {crc32} from '../src/services/secondEar/recorder-protocol.js';
function packet(index,count=320){const bytes=new Uint8Array(178),v=new DataView(bytes.buffer);v.setUint32(0,2,true);v.setUint32(4,index*164,true);v.setUint16(8,count,true);v.setInt16(10,100+index,true);v.setUint32(174,crc32(bytes.subarray(0,174)),true);return v;}
function liveFixture({indices=[],frames=indices.length,samples=frames*320,onSave}={}){
 let listener,state=1,acked=0;const calls=[],seen=[],saved=[];
 const view=()=>{const v=metadata(state);v.setUint32(24,frames,true);v.setUint32(28,acked,true);v.setUint32(32,samples,true);return v;};
 const emit=(index,count)=>listener({target:{value:packet(index,count)}});
 const link=new EarLink({status:()=>{},state:()=>{},progress:()=>{},save:async(blob,info)=>{saved.push({blob,info});await onSave?.({emit,calls,saved});},liveFrame:(pcm,info)=>seen.push({pcm,info}),liveEnd:async()=>calls.push('end')});
 link.connected=true;link.wantStop=true;link.meta={readValue:async()=>view()};
 link.data={addEventListener:(_n,fn)=>listener=fn,removeEventListener:()=>{},startNotifications:async()=>{},stopNotifications:async()=>{}};
 link.operation=async(op,_m,offset)=>{calls.push([op,offset]);if(op===8)for(const i of indices)emit(i,i===frames-1&&samples%320?samples%320:320);if(op===6)state=2;if(op===7)acked=offset;};
 return {link,seen,calls,saved,run:()=>link.receiveLive(parseMeta(view()))};
}
test('实时丢帧不请求补传，静音缺口保留后续音频时间位置',async()=>{
 const f=liveFixture({indices:[0,2],frames:3});await f.run();
 assert.equal(f.calls.filter(c=>c[0]===8).length,1);assert.equal(f.seen.length,3);assert.equal(f.seen[1].info.gap,true);assert.ok(f.seen[1].pcm.every(n=>n===0));assert.equal(f.seen[2].info.gap,false);
 assert.equal(f.saved[0].blob.size,44+3*640);assert.ok(f.calls.some(c=>c[0]===7&&c[1]===3));
});
test('突发积压一批提交确认，不限制为每次 25 帧',async()=>{
 const f=liveFixture({indices:Array.from({length:100},(_,i)=>i)});await f.run();assert.equal(f.calls.find(c=>c[0]===7)[1],100);assert.equal(f.saved[0].blob.size,64000+44);
});
test('落盘期间新到帧不会被提前确认',async()=>{
 let released=false;const f=liveFixture({indices:Array.from({length:10},(_,i)=>i),frames:12,onSave:async({emit,calls,saved})=>{if(saved.length===1){emit(10);emit(11);assert.equal(calls.some(c=>c[0]===7),false);await new Promise(r=>setTimeout(r,10));released=true;}}});await f.run();assert.equal(released,true);assert.deepEqual(f.calls.filter(c=>c[0]===7).map(c=>c[1]),[10,12]);
});
test('丢失最后一帧时按真实样本数补静音，不等待历史补传',async()=>{
 const f=liveFixture({indices:[0],frames:2,samples:420});await f.run();assert.equal(f.seen.length,2);assert.equal(f.seen[1].pcm.length,200);assert.equal(f.seen[1].info.gap,true);assert.equal(f.calls.filter(c=>c[0]===8).length,1);assert.equal(f.saved.reduce((n,b)=>n+b.blob.size-44,0),840);
});
test('保存失败不确认设备数据，结束回调在保存尝试之后',async()=>{
 const f=liveFixture({indices:Array.from({length:10},(_,i)=>i),onSave:async()=>{throw Error('disk failure');}});await assert.rejects(f.run(),/disk failure/);assert.equal(f.calls.some(c=>c[0]===7),false);assert.equal(f.calls.at(-1),'end');
});

test('新录音先订阅再启动，第一帧实时收到且不发补传命令',async()=>{
 const f=liveFixture({frames:1});const order=[];let listener;
 f.link.data.addEventListener=(_n,fn)=>listener=fn;
 f.link.data.startNotifications=async()=>order.push('subscribed');
 const operation=f.link.operation;
 f.link.operation=async(op,m,offset)=>{order.push(op);if(op===5){assert.equal(m.id,1);listener({target:{value:packet(0)}});}await operation(op,m,offset);};
 const initial=parseMeta(metadata(0));initial.id=1;
 await f.link.receiveLive(initial,false,true);
 assert.deepEqual(order.slice(0,2),['subscribed',5]);assert.equal(order.includes(8),false);assert.equal(f.seen.length,1);assert.equal(f.seen[0].info.gap,false);assert.equal(f.saved[0].info.offset,0);
});
