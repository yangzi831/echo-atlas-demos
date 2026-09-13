import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'vite';
test('提前连接 ASR：ready 前按序缓存，ready 后立即传音频和草稿，结束与取消释放连接',async()=>{
 const server=await createServer({server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true},appType:'custom'});const original=globalThis.WebSocket;let socket,client;
 class Socket{sent=[];bufferedAmount=0;closed=false;constructor(){socket=this;}send(data){this.sent.push(data);}close(){this.closed=true;}message(data){this.onmessage({data:JSON.stringify(data)});}}
 globalThis.WebSocket=Socket;
 try{const {ContinuousTranscript}=await server.ssrLoadModule('/src/services/continuousTranscript.ts');const sentences=[];client=new ContinuousTranscript(s=>sentences.push(s),()=>{});socket.onopen();
 client.feed(new Uint8Array([1,2]));client.feed(new Uint8Array([3,4]));assert.equal(socket.sent.length,1);
 socket.message({type:'ready'});assert.deepEqual(socket.sent.slice(1).map(x=>[...x]),[[1,2],[3,4]]);
 client.feed(new Uint8Array([5,6]));assert.deepEqual([...socket.sent.at(-1)],[5,6]);
 socket.message({type:'sentence',id:'0',begin:0,end:null,text:'正在说',final:false});assert.equal(sentences[0].text,'正在说');assert.equal(sentences[0].final,false);
 const completion=client.finish();assert.equal(JSON.parse(socket.sent.at(-1)).type,'finish');socket.message({type:'done'});await completion;assert.equal(client.succeeded,true);assert.equal(socket.closed,true);
 client=new ContinuousTranscript(()=>{},()=>{});client.dispose();assert.equal(socket.closed,true);
 }finally{client?.dispose();globalThis.WebSocket=original;await server.close();}
});
