import { MemoryPreviewPlayer } from '../../services/memoryPreviewPlayer';
import { liveCaption } from '../../services/liveCaption';
import { useEffect, useRef, useState } from 'react';
import { EarLink } from '../../services/secondEar/bluetooth';
import { ContinuousRecording } from '../../services/recordingArchive';
import { saveSentence } from '../../services/recordingArchive';
import { ContinuousTranscript } from '../../services/continuousTranscript';
import { SemanticListener, type SemanticMatch } from '../../services/semanticListener';
import { absoluteTime, wallTime, type TranscriptSentence, type RecordingSession } from '../../services/transcriptTypes';
import { measurePCM, silentFeatures } from '../../services/listeningAudio';
import { StellarSceneHost } from '../stellar-scenes/StellarSceneHost';
import { createSoundMemory } from '../../services/capture';
import type { CapturedMemoryAssets } from '../../services/captureStorage';
import type { City, ListeningPact, SoundMemory } from '../../types/sound';

type Props = {deviceSelection:Promise<any>;city:City;pact:ListeningPact;onCreate:(capture:CapturedMemoryAssets)=>Promise<void>;onExit:(destination:'listen'|'memories')=>void};
type Stage='starting'|'recording'|'stopping'|'review'|'error';
type Moment=CapturedMemoryAssets&{offset:number;saving?:boolean;error?:string};
const clock=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;

export function CoListeningSession({deviceSelection,city,pact,onCreate,onExit}:Props){
 const [deviceName,setDeviceName]=useState('');const [deviceConnected,setDeviceConnected]=useState(false);
 const [deviceConfig,setDeviceConfig]=useState<{sampleRate:number;compressed:boolean}>();
 const [stage,setStage]=useState<Stage>('starting');const [duration,setDuration]=useState(0);
 const [features,setFeatures]=useState(silentFeatures);const [status,setStatus]=useState('等待语音转写，随后结合前后文理解。');
 const [contextSummary,setContextSummary]=useState('');const [summaryHasMatches,setSummaryHasMatches]=useState(false);
 const [asrError,setASRError]=useState('');const [semanticError,setSemanticError]=useState('');
 const [asrStatus,setASRStatus]=useState('等待蓝牙音频');const [error,setError]=useState('');
 const [moments,setMoments]=useState<Moment[]>([]);const [focus,setFocus]=useState<string>();const [feedback,setFeedback]=useState('');
 const [sentences,setSentences]=useState<TranscriptSentence[]>([]);const [sessionInfo,setSessionInfo]=useState<RecordingSession>();
 const recorder=useRef<ContinuousRecording | undefined>(undefined);const asr=useRef<ContinuousTranscript | undefined>(undefined);const semantic=useRef<SemanticListener | undefined>(undefined);
 const linkRef=useRef<EarLink | undefined>(undefined);const alive=useRef(true);const sentenceMap=useRef(new Map<string,TranscriptSentence>());
 const momentsRef=useRef<Moment[]>([]);const featureRef=useRef(silentFeatures);const lastMark=useRef(-10);
 const stopTimeout=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);const playerRef=useRef<HTMLAudioElement>(null);
 const previewController=useRef<MemoryPreviewPlayer | undefined>(undefined);
 useEffect(()=>{if(playerRef.current)previewController.current=new MemoryPreviewPlayer(playerRef.current);return()=>{previewController.current?.dispose();previewController.current=undefined;};},[]);
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
  momentsRef.current=[moment,...momentsRef.current];if(alive.current){setMoments([...momentsRef.current]);setFocus(current=>current??memory.id);}await commit(moment);
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
   },(message,failed)=>{if(!disposed){setStatus(message);setSemanticError(failed?message:'');}},async (summary,hasMatches)=>{if(!disposed){setContextSummary(summary);setSummaryHasMatches(hasMatches);}await r.update({summary});});
   asr.current=new ContinuousTranscript(sentence=>{
    sentence={...sentence,startedAt:absoluteTime(session.startedAt,sentence.begin),endedAt:sentence.end===null?undefined:absoluteTime(session.startedAt,sentence.end)};
    const old=sentenceMap.current.get(sentence.id);if(old?.final&&!sentence.final)return;
    sentenceMap.current.set(sentence.id,sentence);if(!disposed)setSentences([...sentenceMap.current.values()].sort((a,b)=>a.begin-b.begin));
    if(sentence.final&&sentence.end!==null){transcriptWrites=transcriptWrites.then(()=>saveSentence(session.id,sentence)).then(()=>semantic.current?.add(sentence)).catch(e=>{if(!disposed)setError('转写保存失败：'+String(e));});}
   },(message,failed)=>{if(!disposed){setASRStatus(message);setASRError(failed?message:'');}if(failed)void r.update({asrStatus:'interrupted'}).catch(()=>{});});
  };
  const finish=async(interrupted=false)=>{
   if(closing||disposed)return;closing=true;clearTimeout(startup);clearTimeout(stopTimeout.current);setStage('stopping');setDeviceConnected(false);linkRef.current?.disconnect();
   const r=recorder.current;if(!r){setStage('error');return;}
   try{
    await r.update({status:interrupted?'interrupted':'complete',endedAt:absoluteTime(r.session.startedAt,r.session.samples/8)});setASRStatus('音频已保存，等待最后一句转写…');
    await asr.current?.finish();await transcriptWrites;setStatus('正在完成最后一批上下文分析…');await semantic.current?.finish();await Promise.allSettled(persistQueue.current.values());
    await r.update({asrStatus:asr.current?.succeeded?'done':'interrupted',analysisStatus:semantic.current?.succeeded?'done':'error'});
    if(!disposed){setSessionInfo({...r.session});setASRStatus(asr.current?.succeeded?'转写已完成':'转写未完成，已收到的文字保留');setStatus(semantic.current?.succeeded?'本次分析已完成':'分析未完成，可重试');setStage('review');}
   }catch(e){if(!disposed){setError(e instanceof Error?e.message:'收尾失败，已写入的数据仍保留。');setStage('review');}}
  };
  const start=async()=>{
   try{
    const device=await deviceSelection;if(disposed)return;if(device.error)throw Error(device.error);setDeviceName(device.name||'蓝牙设备');
    const link=new EarLink({
     status:(message,failed)=>{if(disposed||closing)return;if(failed){setError(message);void finish(true);}else if(!gotFrame)setASRStatus(message);},
     state:state=>{if(!disposed)setDeviceConnected(['connected','live','secondear'].includes(state));if(!disposed&&!closing&&state==='disconnected'){setError('蓝牙已断开，已接收的录音和文字仍保留。');void finish(true);}},
     progress:()=>{},
     save:async()=>{if(!recorder.current)throw Error('设备上有待处理的快照，请先在原 Demo 保存，再开始持续共听。');await recorder.current.flush();},
     liveStart:meta=>{const config=meta as {sampleRate:number;compressed:boolean};if(!disposed)setDeviceConfig({sampleRate:config.sampleRate,compressed:config.compressed});deviceOffset=Number((meta as {acked?:number}).acked??0)*320;},
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
 const [playingPreview,setPlayingPreview]=useState<string>();
 const caption=liveCaption(sentences);
 const previousCaption=sentences.filter(s=>s.final&&s.text.trim()&&caption&&s.begin<caption.begin).sort((a,b)=>a.begin-b.begin).slice(-1)[0];
 const playMoment=(moment:Moment,offset?:number)=>{
  const player=previewController.current;if(!player)return;
  if(offset===undefined&&playingPreview===moment.memory.id){player.pause();return;}
  setFocus(moment.memory.id);setFeedback('');setError('');
  void player.play(moment.memory.id,moment.audioBlob,offset).catch(()=>{setPlayingPreview(undefined);setError('片段暂时无法播放，请重试。');});
 };
 const selected=moments.find(m=>m.memory.id===focus);const busy=moments.some(m=>m.saving);const kept=moments.filter(m=>m.memory.aiJudgement?.reviewStatus!=='rejected');
 const seek=(sentence:TranscriptSentence)=>{if(!selected?.memory.timing)return;playMoment(selected,Math.max(0,sentence.begin/1000-selected.memory.timing.startSample/8000));};
 return <section className="shared-listening floating-session" aria-label="持续语义共听">
  <StellarSceneHost scene="gravity" className="co-listening-visual" playing={stage === 'recording'} audio={{rms:features.rms,peak:features.peak,spectralCentroid:features.frequencyCentroid,activityDensity:features.activityDensity,transient:features.transientDensity,continuity:features.continuity}}/>
  {deviceConnected&&<div className="floating-device" aria-label="已连接的蓝牙设备"><span>● {deviceName}</span>{deviceConfig&&<small>蓝牙已连接 · {deviceConfig.sampleRate/1000} kHz · 单声道<br/>{deviceConfig.compressed?'ADPCM 传输 → PCM 16-bit':'PCM 16-bit'}</small>}</div>}
  <div className="floating-pact"><small>我们的约定</small><p>{pact.freeformIntention||pact.selectedCriteria.join('、')}</p></div>
  <div className="floating-caption" role="log" aria-label="硬件实时转写" aria-live="off">
    {previousCaption&&<p className="caption-previous" key={`previous-${previousCaption.id}`}>{previousCaption.text}</p>}
    {caption&&<p key={caption.id} className={caption.final?'sentence-final':'sentence-draft'}>{caption.text}</p>}
    {caption&&<small className="caption-state">{caption.final?'这句话已说完':'正在听这一句…'}</small>}
    {!caption&&<p className="caption-waiting">{stage==='starting'?'正在连接你的耳朵…':stage==='error'?'连接暂未完成':stage==='review'?'这一段聆听结束了。':'我在听…'}</p>}
  </div>
  <div className={`gpt-activity ${status.startsWith('GPT 正在')&&!semanticError?'is-working':''}`} role="status"><i />{semanticError?'GPT 分析暂时中断':status.startsWith('GPT 正在')?'GPT 正在理解…':stage==='review'?'GPT 本次理解已结束':'GPT 等待下一段话'}</div>
  {contextSummary&&<div className={`listening-context floating-understanding ${summaryHasMatches?'has-match':'is-unmatched'}`} aria-live="polite"><small>AI 的回响</small><p key={contextSummary}>{contextSummary}</p></div>}
  <div className="shared-layout semantic-layout"><aside className="listening-journal"><p className="panel-kicker">AI 想替你记住的</p>{moments.length===0?<p className="journal-empty">还在听，等待值得留下的一刻。</p>:moments.map(m=><div className="memory-preview-row" key={m.memory.id}>
    <button className="memory-preview-title" onClick={()=>{setFocus(m.memory.id);setFeedback('');}}>{m.memory.title}</button>
    <time>{wallTime(m.memory.timing?.startedAt??m.memory.recordedAt,sessionInfo?.timeZone)}{m.memory.timing&&` — ${wallTime(m.memory.timing.endedAt,sessionInfo?.timeZone)}`} · {Math.round(m.memory.duration)} 秒</time>
    <div className="memory-preview-actions"><small>{m.saving?'保存中':m.memory.aiJudgement?.reviewStatus==='rejected'?'已撤回':m.memory.aiJudgement?.reviewStatus==='pending'?'等待确认':'共同留下'}</small><button aria-label={`${playingPreview===m.memory.id?'暂停':'播放'} ${m.memory.title}`} onClick={()=>playMoment(m)}>{playingPreview===m.memory.id?'Ⅱ 暂停':'▷ 播放'}</button></div>
  </div>)}</aside>
  <aside className="moment-inspector"><audio ref={playerRef} controls hidden={!selected} onPlay={()=>setPlayingPreview(previewController.current?.id)} onPause={()=>setPlayingPreview(undefined)} onEnded={()=>setPlayingPreview(undefined)} onError={()=>{setPlayingPreview(undefined);setError('片段加载失败，请重试播放。');}}/>{selected&&<details key={selected.memory.id}><summary>查看片段 · {selected.memory.title}</summary><p className="panel-kicker">{selected.memory.aiJudgement?.source==='human-manual'?'你选择的瞬间':'符合约定的上下文'}</p><h2>{selected.memory.title}</h2><p>{selected.memory.aiJudgement?.reason}</p><small>{selected.memory.timing&&`${wallTime(selected.memory.timing.startedAt,sessionInfo?.timeZone)} — ${wallTime(selected.memory.timing.endedAt,sessionInfo?.timeZone)}`}<br/>{selected.memory.aiDescription}</small><div className="evidence-transcript">{selected.memory.timing?.transcript.map(s=><button key={s.id} onClick={()=>seek(s)}><time>{clock(s.begin/1000)}</time>{s.text}</button>)}</div><div className="moment-actions"><button disabled={selected.saving} onClick={()=>void review(selected,'accepted')}>确认留下</button><button disabled={selected.saving} onClick={()=>void review(selected,selected.memory.aiJudgement?.reviewStatus==='rejected'?'pending':'rejected')}>{selected.memory.aiJudgement?.reviewStatus==='rejected'?'恢复待确认':'撤回'}</button></div><label>对你来说，它是什么？<textarea value={feedback} maxLength={600} onChange={e=>setFeedback(e.target.value)}/></label><button disabled={!feedback.trim()||selected.saving} onClick={()=>void review(selected,'corrected',feedback)}>补上我的理解</button>{selected.error&&<p role="alert">{selected.error}<button onClick={()=>void commit(selected).catch(()=>{})}>重试保存</button></p>}</details>}</aside></div>
  <div className="floating-errors">{asrError&&<p className="session-error" role="alert">转写：{asrError}<br/>请在齿轮设置中检查配置，并在下次开始聆听时使用。当前已收到的音频仍保存在本机。</p>}
  {semanticError&&<p className="session-error" role="alert">语义分析：{semanticError}<button onClick={()=>void semantic.current?.retry()}>重试语义分析</button></p>}
  {error&&<p className="session-error" role="alert">{error}</p>}
  </div>
  <footer className="shared-controls"><span className="floating-status"><i className={stage==='recording'?'is-live':''} />{stage==='recording'?'聆听中':stage==='stopping'?'正在收尾':stage==='review'?'已结束':'等待连接'} · {clock(duration)}</span>{stage==='recording'||stage==='stopping'?<><button className="shutter-button" disabled={stage!=='recording'} onClick={()=>void manual()}>◉ 手动留下最近十秒</button><button disabled={stage==='stopping'} onClick={stop}>{stage==='stopping'?'等待尾句与最后一次理解…':'结束共听'}</button></>:<button disabled={busy} onClick={()=>onExit(stage==='review'?'memories':'listen')}>{busy?'记忆保存中…':stage==='review'?'查看留下的记忆 →':'返回约定'}</button>}</footer>
 </section>;
}
