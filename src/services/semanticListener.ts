import { requestEcho } from './echoAI';
import type { ListeningPact } from '../types/sound';
import type { TranscriptSentence } from './transcriptTypes';
export type SemanticMatch={title:string;reason:string;startId:string;endId:string;evidenceIds:string[];confidence:number};
export type SemanticResult={matches:SemanticMatch[];contextSummary:string;waitForMore:boolean;model:string};
/** Serial batches, a rolling two-minute context, and an earlier-context summary. */
export class SemanticListener {
 private sentences:TranscriptSentence[]=[];private processed=new Map<string,string>();private timer?:ReturnType<typeof setTimeout>;private running?:Promise<void>;
 private controller?:AbortController;private disposed=false;private ending=false;private failed=false;private waiting=false;private summary='';private selected:Array<{begin:number;end:number;title:string}>=[];
 constructor(private pact:ListeningPact,private onMatch:(match:SemanticMatch,sentences:TranscriptSentence[],model:string)=>Promise<void>,private status:(message:string,error?:boolean)=>void,private onSummary:(summary:string,hasMatches:boolean)=>Promise<void>,private request:typeof requestEcho=requestEcho){ }
 private signature(s:TranscriptSentence){return `${s.text}:${s.begin}:${s.end}`;}
 private pending(){return this.sentences.filter(s=>this.processed.get(s.id)!==this.signature(s));}
 add(sentence:TranscriptSentence){if(!sentence.final||sentence.end===null||this.disposed)return;const old=this.sentences.find(s=>s.id===sentence.id);if(old&&this.signature(old)===this.signature(sentence))return;this.sentences=this.sentences.filter(s=>s.id!==sentence.id).concat(sentence).sort((a,b)=>a.begin-b.begin);this.failed=false;if(!this.running&&!this.timer&&!this.ending)this.timer=setTimeout(()=>{this.timer=undefined;void this.run();},4000);}
 private async run(force=false):Promise<void>{
  if(this.running)return this.running;if(this.disposed)return;
  const batch:TranscriptSentence[]=[];let batchChars=0;
  for(const sentence of this.pending()){if(batch.length>=20||batch.length>0&&batchChars+sentence.text.length>6000)break;batch.push(sentence);batchChars+=sentence.text.length;}
  if(!batch.length&&!force)return;
  const last=batch[batch.length-1]??this.sentences[this.sentences.length-1];if(!last)return;
  // Process oldest pending sentences first; model latency never silently drops a backlog.
  const lastIndex=this.sentences.findIndex(s=>s.id===last.id);
  const context=this.sentences.slice(0,lastIndex+1).filter(s=>s.end!>=last.end!-120000).slice(-60);
  while(context.length>batch.length&&context.reduce((sum,s)=>sum+s.text.length,0)>12000)context.shift();
  const controller=new AbortController();this.controller=controller;
  this.running=(async()=>{
   this.status('GPT 正在结合前后文与记忆约定理解…');
   try{
    const result=await this.request({task:'context',text:this.pact.freeformIntention||this.pact.selectedCriteria.join('、'),criteria:this.pact.selectedCriteria,avoid:this.pact.avoid||'',earlierSummary:this.summary,sentences:context,alreadySelected:this.selected.slice(-30),ending:this.ending&&lastIndex===this.sentences.length-1},controller.signal);
    const data=result as SemanticResult;if(!Array.isArray(data.matches)||typeof data.contextSummary!=='string')throw Error('语义响应格式异常');
    for(const match of data.matches){
     const first=context.find(s=>s.id===match.startId),last=context.find(s=>s.id===match.endId);
     if(!first||!last||last.end===null)throw new Error('无法对应原文时间范围');
     if(this.selected.some(s=>Math.max(0,Math.min(s.end,last.end!)-Math.max(s.begin,first.begin))/Math.max(1,Math.min(s.end-s.begin,last.end!-first.begin))>.5))continue;
     await this.onMatch(match,context,data.model);this.selected.push({begin:first.begin,end:last.end,title:match.title});
    }
    this.summary=data.contextSummary;await this.onSummary(this.summary,data.matches.length>0);batch.forEach(s=>this.processed.set(s.id,this.signature(s)));this.failed=false;this.waiting=data.waitForMore;
    this.status(data.matches.length?'已按语义命中留下候选片段。':data.waitForMore?'这句话还需要后文，继续听…':'这批内容未命中约定，继续记录与理解。');
   }catch(error){if(!this.disposed){this.failed=true;this.status(error instanceof Error?error.message:'分析中断，录音与转写仍在。',true);}}
  })().finally(()=>{this.running=undefined;if(!this.disposed&&!this.ending&&!this.failed&&this.pending().length)this.timer=setTimeout(()=>{this.timer=undefined;void this.run();},1000);});
  return this.running;
 }
 async finish(){this.ending=true;clearTimeout(this.timer);await this.running;while(!this.disposed&&!this.failed&&this.pending().length)await this.run();if(!this.disposed&&!this.failed&&this.waiting)await this.run(true);}
 async retry(){this.failed=false;await this.running;if(this.ending)await this.finish();else await this.run(this.waiting);}
 dispose(){this.disposed=true;clearTimeout(this.timer);this.controller?.abort();}
 get succeeded(){return !this.failed&&this.pending().length===0;}
}
