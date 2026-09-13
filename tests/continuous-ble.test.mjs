import test from 'node:test';import assert from 'node:assert/strict';
import {EarLink} from '../src/services/secondEar/bluetooth.js';
function metadata(state){const v=new DataView(new ArrayBuffer(40));[0x35304553,1,2,0,0,state,0,0,0,0].forEach((n,i)=>v.setUint32(i*4,n,true));return v;}
test('开始聆听时先恢复旧尾段，再发起新的持续录制，不触发本次结束',async()=>{
 const calls=[];let reads=0;const link=new EarLink({status:()=>{},state:()=>{},save:async()=>{},recover:async()=>{},liveEnd:()=>calls.push('end')});link.connected=true;link.wantLive=true;
 link.meta={readValue:async()=>metadata(reads++===0?2:0)};
 link.receiveLive=async(meta,recovering)=>{assert.equal(meta.liveState,2);assert.equal(recovering,true);assert.equal(link.wantLive,true);calls.push('recover');};
 link.operation=async op=>calls.push(op);
 try{await link.poll();assert.deepEqual(calls,['recover',5]);assert.equal(link.wantLive,false);}finally{clearTimeout(link.timer);}
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
