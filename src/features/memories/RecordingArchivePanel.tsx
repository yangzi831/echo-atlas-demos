import { useEffect, useRef, useState } from 'react';
import { audioRange, listRecordingSessions, readTranscript, replaceTranscript, saveSession } from '../../services/recordingArchive';
import { ContinuousTranscript } from '../../services/continuousTranscript';
import { SemanticListener } from '../../services/semanticListener';
import { timedCapture } from '../../services/timedMemory';
import { absoluteTime, wallTime, type RecordingSession, type TranscriptSentence } from '../../services/transcriptTypes';
import type { CapturedMemoryAssets } from '../../services/captureStorage';
import type { SoundMemory } from '../../types/sound';
export function RecordingArchivePanel({onCreate,memories}:{onCreate:(capture:CapturedMemoryAssets)=>Promise<void>;memories:SoundMemory[]}){
 const [sessions,setSessions]=useState<RecordingSession[]>([]);const [selected,setSelected]=useState<RecordingSession>();const [sentences,setSentences]=useState<TranscriptSentence[]>([]);const [audio,setAudio]=useState('');const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);
 const player=useRef<HTMLAudioElement>(null);const active=useRef(true);const generation=useRef(0);const replay=useRef<ContinuousTranscript | undefined>(undefined);const analyser=useRef<SemanticListener | undefined>(undefined);
 const refresh=()=>listRecordingSessions().then(s=>{if(active.current)setSessions(s);}).catch(()=>{if(active.current)setStatus('无法读取本机录音档案');});
 useEffect(()=>{active.current=true;void refresh();return()=>{active.current=false;generation.current++;replay.current?.dispose();analyser.current?.dispose();};},[]);
 useEffect(()=>()=>{if(audio)URL.revokeObjectURL(audio);},[audio]);
 const open=async(s:RecordingSession)=>{const token=++generation.current;setStatus('读取录音与时间轴…');setSelected(s);setAudio('');setSentences([]);try{const [blob,text]=await Promise.all([audioRange(s.id,0,s.samples),readTranscript(s.id)]);if(active.current&&generation.current===token){setAudio(URL.createObjectURL(blob));setSentences(text);setStatus('');}}catch(e){if(active.current&&generation.current===token)setStatus(e instanceof Error?e.message:'无法读取完整录音');}};
 const recover=async()=>{
  if(!selected||busy)return;setBusy(true);const s={...selected};const token=generation.current;
  const fresh=new Map<string,TranscriptSentence>();let failed=false;
  try{
   setStatus('按原始音频顺序重新转写，速度与原录音时长相近…');
   const stt=new ContinuousTranscript(sentence=>{sentence={...sentence,startedAt:absoluteTime(s.startedAt,sentence.begin),endedAt:sentence.end===null?undefined:absoluteTime(s.startedAt,sentence.end)};const old=fresh.get(sentence.id);if(old?.final&&!sentence.final)return;fresh.set(sentence.id,sentence);if(active.current)setSentences([...fresh.values()].sort((a,b)=>a.begin-b.begin));},(message,error)=>{if(error)failed=true;if(active.current)setStatus(message);});replay.current=stt;
   for(let offset=0;offset<s.samples;offset+=1600){if(!active.current||generation.current!==token||failed)throw Error('重新转写已中断，旧的确定文字仍保留');const clip=await audioRange(s.id,offset,Math.min(s.samples,offset+1600));stt.feed(new Uint8Array(await clip.slice(44).arrayBuffer()));await new Promise(r=>setTimeout(r,200));}
   await stt.finish();if(!stt.succeeded)throw Error('重新转写未完成，旧文字未覆盖');
   const text=[...fresh.values()].filter(t=>t.final&&t.end!==null).sort((a,b)=>a.begin-b.begin);await replaceTranscript(s.id,text);s.asrStatus='done';await saveSession(s);
   const semantic=new SemanticListener(s.pact,async(match,context,model)=>{
    const start=Math.floor(context.find(t=>t.id===match.startId)!.begin*8),end=Math.min(s.samples,Math.ceil(context.find(t=>t.id===match.endId)!.end!*8));
    if(memories.some(m=>m.timing?.sessionId===s.id&&Math.max(0,Math.min(m.timing.endSample,end)-Math.max(m.timing.startSample,start))/Math.max(1,Math.min(m.timing.endSample-m.timing.startSample,end-start))>.5))return;
    await onCreate(timedCapture(s,await audioRange(s.id,start,end),start,end,match,context,model));
   },message=>{if(active.current)setStatus(message);},async(summary)=>{s.summary=summary;await saveSession(s);});analyser.current=semantic;
   for(const sentence of text)semantic.add(sentence);await semantic.finish();s.analysisStatus=semantic.succeeded?'done':'error';await saveSession(s);if(active.current){setSelected(s);setStatus(semantic.succeeded?'连续转写与意图分析已完成。':'转写完成，语义分析未完成，可重试。');await refresh();}
  }catch(e){if(active.current)setStatus(e instanceof Error?e.message:'恢复失败，原录音仍保留');}
  finally{replay.current?.dispose();analyser.current?.dispose();if(active.current)setBusy(false);}
 };
 return <section className="recording-archive"><header><div><p className="panel-kicker">完整录音 / 时间档案</p><h2>没有命中的话，也有原始记录。</h2></div><button disabled={busy} onClick={()=>void refresh()}>刷新</button></header>{sessions.length===0?<p>开始一次持续共听，这里会保存完整录音、发生时间和逐句转写。</p>:<div className="recording-archive-grid"><nav>{sessions.map(s=><button key={s.id} disabled={busy} onClick={()=>void open(s)} className={selected?.id===s.id?'is-active':''}><strong>{new Date(s.startedAt).toLocaleDateString('zh-CN')} {wallTime(s.startedAt,s.timeZone)}</strong><span>{(s.samples/8000).toFixed(1)} 秒 · {s.status==='complete'?'完整接收':s.status==='interrupted'?'接收中断':'录音中或异常退出'} · {s.asrStatus==='done'?'转写完成':'转写未完成'}</span><small>{s.pact.freeformIntention||s.pact.selectedCriteria.join('、')}</small></button>)}</nav><div>{selected&&<><p>{selected.timeZone} · 首帧接收时间估计起点；音频内部按样本对齐</p>{audio&&<><audio ref={player} src={audio} controls/><a href={audio} download={`EchoAtlas-${selected.startedAt.replace(/[:.]/g,'-')}.wav`}>下载完整录音</a></>}<button disabled={busy||!audio} onClick={()=>void recover()}>{busy?'正在重放与恢复…':'重新转写并按原约定分析'}</button><div className="archive-sentences">{sentences.map(s=><button key={s.id} onClick={()=>{if(player.current){player.current.currentTime=s.begin/1000;void player.current.play().catch(()=>{});}}}><time>{wallTime(absoluteTime(selected.startedAt,s.begin),selected.timeZone)} — {s.end===null?'…':wallTime(absoluteTime(selected.startedAt,s.end),selected.timeZone)}</time><span>{s.text}{!s.final?'（识别中）':''}</span></button>)}</div></>}</div></div>}{status&&<p role="status">{status}</p>}</section>;
}
