import {useRef} from 'react';
import type {SoundMemory} from '../../types/sound';
import {wallTime} from '../../services/transcriptTypes';
export function TimedTranscript({memory}:{memory:SoundMemory}){
 const player=useRef<HTMLAudioElement>(null);const timing=memory.timing;if(!timing)return null;
 return <div className="timed-memory-transcript"><audio ref={player} controls src={memory.audioUrl}/><div className="evidence-transcript">{timing.transcript.map(s=><button key={s.id} type="button" onClick={()=>{if(player.current){player.current.currentTime=Math.max(0,s.begin/1000-timing.startSample/timing.sampleRate);void player.current.play().catch(()=>{});}}}><time>{s.startedAt?wallTime(s.startedAt,timing.timeZone):`${(s.begin/1000).toFixed(1)}s`}</time>{s.text}</button>)}</div></div>;
}
