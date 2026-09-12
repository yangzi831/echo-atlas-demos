import { createSoundMemory } from './capture';
import { silentFeatures } from './listeningAudio';
import { absoluteTime, type RecordingSession, type TranscriptSentence } from './transcriptTypes';
import type { SemanticMatch } from './semanticListener';
export function timedCapture(session:RecordingSession,blob:Blob,startSample:number,endSample:number,match:SemanticMatch,sentences:TranscriptSentence[],model:string){
 const transcript=sentences.filter(s=>s.end!==null&&s.end>startSample/8&&s.begin<endSample/8);
 const startedAt=absoluteTime(session.startedAt,startSample/8),endedAt=absoluteTime(session.startedAt,endSample/8);
 const memory=createSoundMemory({city:session.city,coordinate:session.city.center,placeName:session.city.localName+'（未定位）',recordedAt:startedAt,duration:(endSample-startSample)/8000,audioUrl:URL.createObjectURL(blob),note:transcript.map(s=>s.text).join('\n'),title:match.title,visibility:'private',locationPrivacy:'approximate',features:silentFeatures,captureSource:'echo-device',tags:['共同聆听','语义命中']});
 memory.duration=(endSample-startSample)/8000;
 memory.timing={sessionId:session.id,sessionStartedAt:session.startedAt,timeZone:session.timeZone,clockSource:session.clockSource,startSample,endSample,sampleRate:8000,startedAt,endedAt,sentenceIds:match.evidenceIds,transcript};
 memory.aiJudgement={source:'matched-intention',reason:match.reason,confidence:match.confidence,reviewStatus:'pending',decidedAt:new Date().toISOString()};memory.aiDescription=`${model} 依据连续转写、前后文和你的记忆约定选择。`;
 return {memory,audioBlob:blob};
}
