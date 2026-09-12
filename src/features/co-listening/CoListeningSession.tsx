import { useEffect, useRef, useState } from 'react';
import { EarLink } from '../../services/secondEar/bluetooth';
import { ContinuousRecording } from '../../services/recordingArchive';
import { saveSentence } from '../../services/recordingArchive';
import { ContinuousTranscript } from '../../services/continuousTranscript';
import { SemanticListener, type SemanticMatch } from '../../services/semanticListener';
import { absoluteTime, wallTime, type TranscriptSentence, type RecordingSession } from '../../services/transcriptTypes';
import { measurePCM, silentFeatures } from '../../services/listeningAudio';
import { EchoFieldCanvas } from '../ambient-visual/EchoFieldCanvas';
import { JourneySteps } from '../../components/JourneySteps';
import { createSoundMemory } from '../../services/capture';
import type { CapturedMemoryAssets } from '../../services/captureStorage';
import type { City, ListeningPact, SoundMemory } from '../../types/sound';

type Props = {deviceSelection:Promise<any>;city:City;pact:ListeningPact;onCreate:(capture:CapturedMemoryAssets)=>Promise<void>;onExit:(destination:'listen'|'memories')=>void};
type Stage='starting'|'recording'|'stopping'|'review'|'error';
type Moment=CapturedMemoryAssets&{offset:number;saving?:boolean;error?:string};
const clock=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;

export function CoListeningSession({deviceSelection,city,pact,onCreate,onExit}:Props){
 const [stage,setStage]=useState<Stage>('starting');const [duration,setDuration]=useState(0);
 const [features,setFeatures]=useState(silentFeatures);const [status,setStatus]=useState('等待语音转写，随后结合前后文理解。');
 const [asrError,setASRError]=useState('');const [semanticError,setSemanticError]=useState('');
 const [asrStatus,setASRStatus]=useState('等待蓝牙音频');const [error,setError]=useState('');
 const [moments,setMoments]=useState<Moment[]>([]);const [focus,setFocus]=useState<string>();const [feedback,setFeedback]=useState('');
 const [sentences,setSentences]=useState<TranscriptSentence[]>([]);const [sessionInfo,setSessionInfo]=useState<RecordingSession>();
 const recorder=useRef<ContinuousRecording | undefined>(undefined);const asr=useRef<ContinuousTranscript | undefined>(undefined);const semantic=useRef<SemanticListener | undefined>(undefined);
 const linkRef=useRef<EarLink | undefined>(undefined);const alive=useRef(true);const sentenceMap=useRef(new Map<string,TranscriptSentence>());
 const momentsRef=useRef<Moment[]>([]);const featureRef=useRef(silentFeatures);const lastMark=useRef(-10);
 const stopTimeout=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);const playerRef=useRef<HTMLAudioElement>(null);
 const persistQueue=useRef(new Map<string,Promise<void>>());
 const update=(id:string,patch:Partial<Moment>)=>{momentsRef.current=momentsRef.current.map(m=>m.memory.id===id?{...m,...patch}:m);if(alive.current)setMoments([...momentsRef.current]);};
 const commit=async(moment:Moment)=>{
  const id=moment.memory.id,previous=persistQueue.current.get(id)??Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>onCreate({memory:moment.memory,audioBlob:moment.audioBlob}));persistQueue.current.set(id,next);
  try{await next;update(id,{saving:false,error:undefined});}catch{update(id,{saving:false,error:'保存失败，片段可从完整录音恢复，请重试。'});throw Error('记忆保存失败');}
 };
 const captureRange=async(startSample:number,endSample:number,match?:SemanticMatch,model?:string,evidence?:TranscriptSentence[])=>{
  const r=recorder.current;if(!r||endSample<=startSample)throw Error('候选时间范围没有对应的已接收音频，未创建记忆');
  const blob=await r.range(startSample,endSample);const s=r.session;
  const transcript=(evidence??[...sentenceMap.current.values()]).filter(t=>t.final&&t.end!==null&&t.end>startSample/8&&t.begin<endSample/8);
  const startedAt=absoluteTime(s.startedAt,startSample/8),endedAt=absoluteTime(s.startedAt,endSample/8);
  const reason=match?.reason??'你主动选择留下刚刚发生的十秒。';
  const memory=createSoundMemory({city,coordinate:city.center,placeName:city.localName+'（未定位）',recordedAt:startedAt,duration:(endSample-startSample)/8000,audioUrl:URL.createObjectURL(blob),note:transcript.map(t=>t.text).join('\n')||reason,title:match?.title??'我选择的这一刻',visibility:'private',locationPrivacy:'approximate',features:featureRef.current,captureSource:'echo-device',tags:['共同聆听',match?'语义命中':'主动快门']});
  memory.duration=(endSample-startSample)/8000;
  memory.timing={sessionId:s.id,sessionStartedAt:s.startedAt,timeZone:s.timeZone,clockSource:s.clockSource,startSample,endSample,sampleRate:8000,startedAt,endedAt,sentenceIds:match?.evidenceIds??transcript.map(t=>t.id),transcript};
  memory.aiJudgement={source:match?'matched-intention':'human-manual',reason,confidence:match?.confidence??1,reviewStatus:match?'pending':'accepted',decidedAt:new Date().toISOString()};
  memory.aiDescription=match?`${model} 依据连续转写、前后文和你的记忆约定选择。`:'你主动选择的原始蓝牙录音片段。';
  const moment:Moment={memory,audioBlob:blob,offset:startSample/8000,saving:true};
  momentsRef.current=[moment,...momentsRef.current];if(alive.current)setMoments([...momentsRef.current]);await commit(moment);
 };
 const manual=async()=>{const n=recorder.current?.session.samples??0;if(n/8000-lastMark.current<2||!n)return;lastMark.current=n/8000;try{await captureRange(Math.max(0,n-80000),n);}catch(e){setError(e instanceof Error?e.message:'快门保存失败');}};
 const review=async(moment:Moment,reviewStatus:NonNullable<SoundMemory['aiJudgement']>['reviewStatus'],humanFeedback?:string)=>{
  const next={...moment,saving:true,memory:{...moment.memory,aiJudgement:{...moment.memory.aiJudgement!,reviewStatus,humanFeedback:humanFeedback??moment.memory.aiJudgement?.humanFeedback,decidedAt:new Date().toISOString()}}};
  update(moment.memory.id,next);try{await commit(next);setFeedback('');}catch{}
 };
 useEffect(()=>{
  alive.current=true;let disposed=false,closing=false,gotFrame=false,lastFeature=0,deviceOffset=0;let startup:ReturnType<typeof setTimeout>;let transcriptWrites=Promise.resolve();
  const startPipeline=(firstFrame:Uint8Array)=>{
   const now=Date.now();const session:RecordingSession={id:crypto.randomUUID(),startedAt:new Date(now-firstFrame.length/16).toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,clockSource:'host-first-frame-estimate',sampleRate:8000,samples:0,status:'recording',asrStatus:'recording',analysisStatus:'pending',pact,city,summary:'',updatedAt:new Date(now).toISOString()};
   const r=new ContinuousRecording(session);recorder.current=r;setSessionInfo({...session});
   semantic.current=new SemanticListener(pact,async(match,context,model)=>{
    const first=context.find(s=>s.id===match.startId)!,last=context.find(s=>s.id===match.endId)!;
    await captureRange(Math.floor(first.begin*8),Math.min(r.session.samples,Math.ceil(last.end!*8)),match,model,context);
   },(message,failed)=>{if(!disposed){setStatus(message);setSemanticError(failed?message:'');}},summary=>r.update({summary}));
   asr.current=new ContinuousTranscript(sentence=>{
    sentence={...sentence,startedAt:absoluteTime(session.startedAt,sentence.begin),endedAt:sentence.end===null?undefined:absoluteTime(session.startedAt,sentence.end)};
    const old=sentenceMap.current.get(sentence.id);if(old?.final&&!sentence.final)return;
    sentenceMap.current.set(sentence.id,sentence);if(!disposed)setSentences([...sentenceMap.current.values()].sort((a,b)=>a.begin-b.begin));
    if(sentence.final&&sentence.end!==null){transcriptWrites=transcriptWrites.then(()=>saveSentence(session.id,sentence)).then(()=>semantic.current?.add(sentence)).catch(e=>{if(!disposed)setError('转写保存失败：'+String(e));});}
   },(message,failed)=>{if(!disposed){setASRStatus(message);setASRError(failed?message:'');}if(failed)void r.update({asrStatus:'interrupted'}).catch(()=>{});});
  };
  const finish=async(interrupted=false)=>{
   if(closing||disposed)return;closing=true;clearTimeout(startup);clearTimeout(stopTimeout.current);setStage('stopping');linkRef.current?.disconnect();
   const r=recorder.current;if(!r){setStage('error');return;}
   try{
    await r.update({status:interrupted?'interrupted':'complete',endedAt:absoluteTime(r.session.startedAt,r.session.samples/8)});setASRStatus('音频已保存，等待最后一句转写…');
    await asr.current?.finish();await transcriptWrites;setStatus('正在完成最后一批上下文分析…');await semantic.current?.finish();await Promise.allSettled(persistQueue.current.values());
    await r.update({asrStatus:asr.current?.succeeded?'done':'interrupted',analysisStatus:semantic.current?.succeeded?'done':'error'});
    if(!disposed){setSessionInfo({...r.session});setStage('review');}
   }catch(e){if(!disposed){setError(e instanceof Error?e.message:'收尾失败，已写入的数据仍保留。');setStage('review');}}
  };
  const start=async()=>{
   try{
    const device=await deviceSelection;if(disposed)return;if(device.error)throw Error(device.error);
    const link=new EarLink({
     status:(message,failed)=>{if(disposed||closing)return;if(failed){setError(message);void finish(true);}else if(!gotFrame)setASRStatus(message);},
     state:state=>{if(!disposed&&!closing&&state==='disconnected'){setError('蓝牙已断开，已接收的录音和文字仍保留。');void finish(true);}},
     progress:()=>{},
     save:async()=>{if(!recorder.current)throw Error('设备上有待处理的快照，请先在原 Demo 保存，再开始持续共听。');await recorder.current.flush();},
     liveStart:meta=>{deviceOffset=Number((meta as {acked?:number}).acked??0)*320;},
     liveFrame:pcm=>{
      if(disposed||closing)return;if(!gotFrame){gotFrame=true;clearTimeout(startup);startPipeline(pcm);setStage('recording');}
      const r=recorder.current!;r.append(pcm);asr.current?.feed(pcm);
      const elapsed=r.session.samples/8000;if(elapsed-lastFeature>=.24){lastFeature=elapsed;const frame=measurePCM(pcm,featureRef.current);featureRef.current=frame;setFeatures(frame);setDuration(elapsed);}
     },
     liveEnd:async(meta,failed)=>{const expected=(meta as {samples?:number}).samples;const mismatch=expected!==undefined&&recorder.current&&expected-deviceOffset!==recorder.current.session.samples;if(mismatch)setError('设备结束样本数与接收数量不一致，已标记为中断并保留收到的音频。');if(!disposed)await finish(!!failed||!!mismatch);},
    });link.auto=false;linkRef.current=link;link.startLive();await link.connect(device);if(disposed){link.disconnect();return;}
    startup=setTimeout(()=>{if(!gotFrame){setError('设备未返回声音，请检查连接与持续录音固件。');void finish(true);}},15000);
   }catch(e){if(!disposed){setError(e instanceof Error?e.message:'无法连接设备');setStage('error');}}
  };
  void start();
  const beforeUnload=(e:BeforeUnloadEvent)=>{if(!closing){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);
  return()=>{disposed=true;alive.current=false;clearTimeout(startup);clearTimeout(stopTimeout.current);linkRef.current?.disconnect();asr.current?.dispose();semantic.current?.dispose();if(!closing&&recorder.current)void recorder.current.update({status:'interrupted',asrStatus:'interrupted',analysisStatus:'error'}).catch(()=>{});window.removeEventListener('beforeunload',beforeUnload);};
  // One recorder and timestamp origin per user-started session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const stop=()=>{setStage('stopping');linkRef.current?.stopLive();stopTimeout.current=setTimeout(()=>linkRef.current?.disconnect(),12000);};
 const selected=moments.find(m=>m.memory.id===focus);const busy=moments.some(m=>m.saving);const kept=moments.filter(m=>m.memory.aiJudgement?.reviewStatus!=='rejected');
 const seek=(sentence:TranscriptSentence)=>{const audio=playerRef.current;if(!audio||!selected?.memory.timing)return;audio.currentTime=Math.max(0,sentence.begin/1000-selected.memory.timing.startSample/8000);void audio.play().catch(()=>{});};
 return <section className="shared-listening" aria-label="持续语义共听">
  <EchoFieldCanvas input={{mode:stage==='recording'?'listen-live':'listen-decision',audioFeatures:features,memories:kept.map(m=>m.memory),activeMemoryId:focus}}/><JourneySteps active={stage==='review'?3:2}/>
  <header className="shared-header"><div><p className="panel-kicker">02 / 持续语义共听</p><h1>{stage==='starting'?'把你的耳朵接进来。':stage==='review'?'听过的话，成为有来处的记忆。':'听懂前后文，再决定留下。'}</h1><p>{pact.freeformIntention||pact.selectedCriteria.join('、')}</p>{sessionInfo&&<small className="recording-origin">{new Date(sessionInfo.startedAt).toLocaleDateString('zh-CN')} · {wallTime(sessionInfo.startedAt,sessionInfo.timeZone)} 开始 · {sessionInfo.timeZone}<br/>电脑首帧时间估计起点，句子位置按原音频对齐</small>}</div><div className="session-clock"><b>{clock(duration)}</b><span>{stage==='recording'?'● 持续收音':stage==='stopping'?'正在完成转写与理解':stage==='review'?'已结束':'等待设备'} · 命中 {kept.length}</span></div></header>
  <div className="pipeline-status"><span>01 完整录音持续保存</span><span>02 {asrStatus}</span><span>03 {status}</span></div>
  <div className="shared-layout semantic-layout"><aside className="listening-journal"><p className="panel-kicker">符合约定的时刻</p>{moments.length===0?<p className="journal-empty">先听完前后文。<br/>未命中也会保留完整录音和转写，<br/>不会用音量变化代替理解。</p>:moments.map(m=><button key={m.memory.id} className={focus===m.memory.id?'is-active':''} onClick={()=>{setFocus(m.memory.id);setFeedback('');}}><time>{wallTime(m.memory.recordedAt,sessionInfo?.timeZone)}</time><span>{m.memory.title}<small>{m.saving?'保存中':m.memory.aiJudgement?.reviewStatus==='rejected'?'已撤回':m.memory.aiJudgement?.reviewStatus==='pending'?'等待确认':'共同留下'}</small></span></button>)}</aside>
  <div className="live-transcript"><p className="panel-kicker">逐句转写 · 点击记忆中的原文可回听</p>{!sentences.length&&<p className="transcript-empty">说话后，文字和发生时间会出现在这里。<br/>ASR 识别语音，GPT 理解它与约定的关系。</p>}{sentences.slice(-60).map(s=><p key={s.id} className={s.final?'sentence-final':'sentence-draft'}><time>{sessionInfo?wallTime(absoluteTime(sessionInfo.startedAt,s.begin),sessionInfo.timeZone):clock(s.begin/1000)}</time><span>{s.text}{!s.final&&<small> 识别中…</small>}</span></p>)}</div>
  <aside className="moment-inspector">{selected?<><p className="panel-kicker">{selected.memory.aiJudgement?.source==='human-manual'?'你选择的瞬间':'符合约定的上下文'}</p><h2>{selected.memory.title}</h2><p>{selected.memory.aiJudgement?.reason}</p><small>{selected.memory.timing&&`${wallTime(selected.memory.timing.startedAt,sessionInfo?.timeZone)} — ${wallTime(selected.memory.timing.endedAt,sessionInfo?.timeZone)}`}<br/>{selected.memory.aiDescription}</small><audio ref={playerRef} controls src={selected.memory.audioUrl}/><div className="evidence-transcript">{selected.memory.timing?.transcript.map(s=><button key={s.id} onClick={()=>seek(s)}><time>{clock(s.begin/1000)}</time>{s.text}</button>)}</div><div className="moment-actions"><button disabled={selected.saving} onClick={()=>void review(selected,'accepted')}>确认留下</button><button disabled={selected.saving} onClick={()=>void review(selected,selected.memory.aiJudgement?.reviewStatus==='rejected'?'pending':'rejected')}>{selected.memory.aiJudgement?.reviewStatus==='rejected'?'恢复待确认':'撤回'}</button></div><label>对你来说，它是什么？<textarea value={feedback} maxLength={600} onChange={e=>setFeedback(e.target.value)}/></label><button disabled={!feedback.trim()||selected.saving} onClick={()=>void review(selected,'corrected',feedback)}>补上我的理解</button>{selected.error&&<p role="alert">{selected.error}<button onClick={()=>void commit(selected).catch(()=>{})}>重试保存</button></p>}</>:<><p className="panel-kicker">我们的约定</p><h2>让值得记住的话，<br/>留在这里。</h2><p>连续语音转写，结合此前摘要与最近两分钟上下文，对照你想记住的内容。</p>{pact.avoid&&<p>不希望留下：{pact.avoid}</p>}<small>音频经本站后端发送至 Fun-ASR 转写；文字与约定通过 ApiMux 交给 GPT 分析。完整录音和带时间的转写保存在本机。</small></>}</aside></div>
  {asrError&&<p className="session-error" role="alert">转写：{asrError}<br/>请先在齿轮设置中检查配置。结束共听后，在「留下 → 完整录音」中重新转写并分析，恢复这段录音的文字。</p>}
  {semanticError&&<p className="session-error" role="alert">语义分析：{semanticError}<button onClick={()=>void semantic.current?.retry()}>重试语义分析</button></p>}
  {error&&<p className="session-error" role="alert">{error}</p>}
  <footer className="shared-controls">{stage==='recording'||stage==='stopping'?<><button className="shutter-button" disabled={stage!=='recording'} onClick={()=>void manual()}>◉ 手动留下最近十秒</button><button disabled={stage==='stopping'} onClick={stop}>{stage==='stopping'?'等待尾句与最后一次理解…':'结束共听'}</button></>:<button disabled={busy} onClick={()=>onExit(stage==='review'?'memories':'listen')}>{busy?'记忆保存中…':stage==='review'?'查看记忆与完整录音 →':'返回约定'}</button>}<span>实际日期 + 音频时间范围 + 原文证据 + AI 判断时间，分别保存</span></footer>
 </section>;
}
