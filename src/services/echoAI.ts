import {aiSettings} from './apiSettings';
import {apiEndpoint} from './apiEndpoint';
import type {SoundMemory} from '../types/sound';
export type AIResult = {title:string;summary:string;criteria:string[];ids:string[];shouldKeep:boolean;confidence:number;model:string};
export async function requestEcho(input:{task:string;text:string;[key:string]:unknown},signal?:AbortSignal):Promise<any>{
 const credentials=aiSettings();if(!credentials.apiKey.trim())throw Error('请先在齿轮设置中填写 ApiMux API Key。');
 const controller=new AbortController();const abort=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(),55000);
 try{
  let response:Response;
  try{response=await fetch(apiEndpoint('/api/echo-ai'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,credentials}),signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});}
  catch{throw Error(controller.signal.aborted?'AI 请求已取消或超时。':'无法连接云端 AI 转发服务，请检查网络或稍后重试。');}
  let data;try{data=await response.json();}catch{throw Error('云端 AI 转发服务返回异常。');}
  if(!response.ok)throw Error(data.error||'AI 分析暂时不可用。');
  return data;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function askEcho(input:{task:'pact'|'moment'|'recall';text:string;[key:string]:unknown},signal?:AbortSignal):Promise<AIResult>{return requestEcho(input,signal);}
export function recallMetadata(memories: SoundMemory[]) {
 return memories.filter(m=>m.aiJudgement?.reviewStatus !== 'rejected').slice(0,80).map(m=>({id:m.id,title:m.title,place:m.location.placeName,city:m.location.city,recordedAt:m.recordedAt,note:m.note.slice(0,400),reason:m.aiJudgement?.reason.slice(0,600),humanFeedback:m.aiJudgement?.humanFeedback?.slice(0,600),tags:m.tags,moods:m.moods}));
}
