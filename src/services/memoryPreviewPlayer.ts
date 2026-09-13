/** Single owner of the media source, independent of React selection renders. */
export class MemoryPreviewPlayer {
 id?: string;
 private url?: string;
 private version=0;
 constructor(private audio: HTMLAudioElement) {}
 async play(id:string, blob:Blob, offset?:number) {
  const version=++this.version;
  if(this.id!==id){
   this.audio.pause();
   const old=this.url;
   this.id=id;this.url=URL.createObjectURL(blob);this.audio.src=this.url;
   if(old)URL.revokeObjectURL(old);
  }
  if(offset!==undefined)this.audio.currentTime=Math.max(0,offset);
  else if(this.audio.ended)this.audio.currentTime=0;
  try{await this.audio.play();}catch(error){
   // Changing clips or pausing intentionally aborts the older play promise.
   if(version!==this.version)return;
   throw error;
  }
 }
 pause(){this.version++;this.audio.pause();}
 dispose(){this.pause();this.audio.removeAttribute('src');this.audio.load();if(this.url)URL.revokeObjectURL(this.url);this.url=undefined;this.id=undefined;}
}
