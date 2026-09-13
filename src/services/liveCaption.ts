import type { TranscriptSentence } from './transcriptTypes';
/** Same-ID revisions update in place. Newer speech supersedes stale drafts;
 * a missing sentence_end must never freeze the display or finalize evidence. */
export function liveCaption(sentences: TranscriptSentence[]): TranscriptSentence | undefined {
 const ordered = sentences.filter(s => s.text.trim()).slice().sort((a,b)=>a.begin-b.begin);
 return ordered[ordered.length - 1];
}
