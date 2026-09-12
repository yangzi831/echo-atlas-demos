import { wavHeader } from './secondEar/recorder-protocol';
import type { RecordingSession, TranscriptSentence } from './transcriptTypes';
const NAME='echo-atlas-recordings';
function openDB(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>{r.result.createObjectStore('sessions',{keyPath:'id'});r.result.createObjectStore('chunks',{keyPath:['sessionId','offset']});r.result.createObjectStore('sentences',{keyPath:['sessionId','id']});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function write(stores:string[],action:(tx:IDBTransaction)=>void){const db=await openDB();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error??new Error('本机录音存储失败'));action(tx);});}finally{db.close();}}
async function read<T>(store:string,query? :IDBValidKey|IDBKeyRange){const db=await openDB();try{return await new Promise<T[]>((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll(query);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function saveSession(session:RecordingSession){await write(['sessions'],tx=>tx.objectStore('sessions').put(session));}
export async function listRecordingSessions(){return(await read<RecordingSession>('sessions')).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));}
export async function getRecordingSession(id:string){return(await read<RecordingSession>('sessions',id))[0];}
export async function saveSentence(sessionId:string,sentence:TranscriptSentence){if(!sentence.final||sentence.end===null)return;await write(['sentences'],tx=>tx.objectStore('sentences').put({...sentence,sessionId}));}
export async function readTranscript(sessionId:string){return(await read<TranscriptSentence>('sentences',IDBKeyRange.bound([sessionId,''],[sessionId,'\uffff']))).sort((a,b)=>a.begin-b.begin);}
export async function audioRange(id:string,startSample:number,endSample:number){
 if(!Number.isInteger(startSample)||!Number.isInteger(endSample)||startSample<0||endSample<=startSample)throw new Error('无效的录音范围');
 const chunks=await read<{offset:number;pcm:Blob}>('chunks',IDBKeyRange.bound([id,Math.max(0,startSample-16000)],[id,endSample]));
 const parts:Blob[]=[];let covered=startSample;
 for(const c of chunks.sort((a,b)=>a.offset-b.offset)){
  const end=c.offset+c.pcm.size/2;if(end<=covered)continue;if(c.offset>=endSample)break;
  if(c.offset>covered)throw new Error('该时间段存在音频缺口，未生成错误片段');
  const stop=Math.min(end,endSample);parts.push(c.pcm.slice((covered-c.offset)*2,(stop-c.offset)*2));covered=stop;
 }
 if(covered!==endSample)throw new Error('音频尚未完整写入，请稍后重试');
 return new Blob([wavHeader((endSample-startSample)*2,8000),...parts],{type:'audio/wav'});
}
/** Write every second, serially. BLE acknowledgements await flush(). */
export class ContinuousRecording {
 readonly session:RecordingSession;
 private parts:Uint8Array<ArrayBuffer>[]=[];private pendingSamples=0;private offset=0;private chain:Promise<void>;
 constructor(session:RecordingSession){this.session=session;this.chain=saveSession(session);}
 append(pcm:Uint8Array){this.parts.push(new Uint8Array(pcm));this.pendingSamples+=pcm.length/2;this.session.samples+=pcm.length/2;if(this.pendingSamples>=8000)void this.flush().catch(()=>{});}
 flush(){
  if(!this.pendingSamples)return this.chain;
  const pcm=new Blob(this.parts),offset=this.offset;this.offset+=this.pendingSamples;this.parts=[];this.pendingSamples=0;
  const snapshot={...this.session,updatedAt:new Date().toISOString()};
  this.chain=this.chain.then(()=>write(['chunks','sessions'],tx=>{tx.objectStore('chunks').put({sessionId:snapshot.id,offset,pcm});tx.objectStore('sessions').put(snapshot);}));
  return this.chain;
 }
 async update(patch:Partial<RecordingSession>){await this.flush();Object.assign(this.session,patch,{updatedAt:new Date().toISOString()});const snapshot={...this.session};this.chain=this.chain.then(()=>saveSession(snapshot));await this.chain;}
 async range(start:number,end:number){await this.flush();return audioRange(this.session.id,start,end);}
}
export async function replaceTranscript(sessionId:string,sentences:TranscriptSentence[]){
 await write(['sentences'],tx=>{const store=tx.objectStore('sentences');store.delete(IDBKeyRange.bound([sessionId,''],[sessionId,'\uffff']));for(const s of sentences)if(s.final&&s.end!==null)store.put({...s,sessionId});});
}
