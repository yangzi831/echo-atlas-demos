import type { City, ListeningPact } from '../types/sound';
export type TranscriptSentence = {id:string;text:string;begin:number;end:number|null;final:boolean;startedAt?:string;endedAt?:string};
export type RecordingSession = {
 id:string; startedAt:string; endedAt?:string; timeZone:string; clockSource:'host-first-frame-estimate';
 sampleRate:8000; samples:number; status:'recording'|'complete'|'interrupted';
 asrStatus:'recording'|'done'|'interrupted'; analysisStatus:'pending'|'done'|'error';
 pact:ListeningPact; city:City; summary:string; updatedAt:string;
};
export type MemoryTiming = {
 sessionId:string; sessionStartedAt:string; timeZone:string; clockSource:RecordingSession['clockSource'];
 startSample:number;endSample:number;sampleRate:number;startedAt:string;endedAt:string;
 sentenceIds:string[];transcript:TranscriptSentence[];
};
export function absoluteTime(startedAt:string,offsetMs:number) {return new Date(Date.parse(startedAt)+offsetMs).toISOString();}
export function wallTime(value:string,timeZone?:string){return new Date(value).toLocaleTimeString('zh-CN',{timeZone,hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});}
