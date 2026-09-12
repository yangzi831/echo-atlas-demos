import type { CaptureFeatureSummary } from './capture';
import { wavHeader } from './secondEar/recorder-protocol';

export const silentFeatures: CaptureFeatureSummary = {rms:0,peak:0,frequencyCentroid:0,activityDensity:0,transientDensity:0,continuity:0};
/** Bounded PCM ring: 12 seconds, regardless of session length. */
export class ListeningBuffer {
 private parts: Uint8Array<ArrayBuffer>[] = [];
 private bytes = 0;
 totalSamples = 0;
 append(pcm: Uint8Array) {
  const copy = new Uint8Array(pcm);
  this.parts.push(copy); this.bytes += copy.length; this.totalSamples += copy.length / 2;
  while (this.bytes > 12 * 16000 && this.parts.length > 1) this.bytes -= this.parts.shift()!.length;
 }
 snapshot(seconds = 10) {
  const pcm = new Uint8Array(this.bytes); let offset = 0;
  for (const part of this.parts) {pcm.set(part, offset); offset += part.length;}
  const tail = pcm.slice(Math.max(0, pcm.length - seconds * 16000));
  return {blob: new Blob([wavHeader(tail.length,8000),tail], {type:'audio/wav'}), duration: tail.length / 16000};
 }
 clear() {this.parts=[];this.bytes=0;}
}

export function measurePCM(pcm: Uint8Array, previous: CaptureFeatureSummary): CaptureFeatureSummary {
 const view = new DataView(pcm.buffer,pcm.byteOffset,pcm.byteLength);
 const n = pcm.length / 2;
 if (!n) return silentFeatures;
 const samples = Array.from({length:n}, (_,i)=>view.getInt16(i*2,true)/32768);
 const rms = Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/n);
 const peak = samples.reduce((s,v)=>Math.max(s,Math.abs(v)),0);
 // A short-window spectrum supports change detection, not sound-source classification.
 let weighted=0,total=0,active=0;
 for (let k=1;k<=32;k++) {
  const bin=Math.max(1,Math.round(k*n/64));
  let re=0,im=0;
  for(let i=0;i<n;i++) {const phase=2*Math.PI*bin*i/n;const sample=samples[i]*(0.5-0.5*Math.cos(2*Math.PI*i/Math.max(1,n-1)));re+=sample*Math.cos(phase);im-=sample*Math.sin(phase);}
  const magnitude=Math.sqrt(re*re+im*im)/n;
  weighted+=bin*8000/n*magnitude;total+=magnitude;if(magnitude>.003)active++;
 }
 return {rms:Math.min(1,rms*3.2),peak,frequencyCentroid:total?weighted/total:0,activityDensity:active/32,transientDensity:Math.min(1,Math.max(0,rms-previous.rms/3.2)*13),continuity:rms>.012?Math.min(1,previous.continuity+.04):Math.max(0,previous.continuity-.025)};
}
