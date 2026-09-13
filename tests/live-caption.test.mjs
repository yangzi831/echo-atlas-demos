import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'vite';
test('字幕持续修订并保留最终句，旧草稿缺失结束标识也不阻挡新转写',async()=>{
 const server=await createServer({server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
 try{const {liveCaption}=await server.ssrLoadModule('/src/services/liveCaption.ts');
 const first={id:'1',begin:0,end:null,final:false,text:'好'};
 const revision={...first,text:'好的，我们一起创作'};
 const next={id:'2',begin:2000,end:null,final:false,text:'下一句话'};
 assert.equal(liveCaption([first]).text,'好');
 assert.equal(liveCaption([revision]).text,'好的，我们一起创作');
 const final={...revision,end:1900,final:true,text:'好的，我们一起创作。'};
 assert.equal(liveCaption([final]).text,'好的，我们一起创作。');
 assert.equal(liveCaption([first,next]).id,'2');
 assert.equal(liveCaption([next,first]).id,'2');
 assert.equal(liveCaption([first,{...next,end:3000,final:true}]).id,'2');
 assert.equal(first.final,false,'显示切换不会伪造句子结束或改变归档证据');
 assert.equal(liveCaption([final,{...next,text:''}]).id,'1');
 assert.equal(liveCaption([]),undefined);
 }finally{await server.close();}
});
