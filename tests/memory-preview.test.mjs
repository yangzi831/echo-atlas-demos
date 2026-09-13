import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'vite';
test('片段播放器复用地址、支持定位、取消旧请求，并释放地址',async()=>{
 const server=await createServer({server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
 try{
 const {MemoryPreviewPlayer}=await server.ssrLoadModule('/src/services/memoryPreviewPlayer.ts');
 let writes=0,src='',rejectPending;const audio={currentTime:0,ended:false,paused:true,get src(){return src},set src(v){src=v;writes++},pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},removeAttribute(){src=''},load(){}};
 const player=new MemoryPreviewPlayer(audio),blob=new Blob(['test'],{type:'audio/wav'});
 await player.play('a',blob);const first=audio.src;assert.equal(writes,1);player.pause();await player.play('a',blob);assert.equal(writes,1);
 await player.play('a',blob,2);assert.equal(audio.currentTime,2);assert.equal(writes,1);
 audio.play=()=>new Promise((_,reject)=>{rejectPending=reject});const old=player.play('a',blob);
 audio.play=()=>Promise.resolve();await player.play('b',blob);rejectPending(Object.assign(Error('interrupted'),{name:'AbortError'}));await old;
 assert.equal(player.id,'b');assert.notEqual(audio.src,first);assert.equal(writes,2);
 player.dispose();assert.equal(audio.src,'');assert.equal(player.id,undefined);
 }finally{await server.close();}
});
