import { useSyncExternalStore } from 'react';
import { listeningAudioEngine } from './ListeningAudioEngine';

export const useListeningAudio = () => useSyncExternalStore(
  listeningAudioEngine.subscribe,
  listeningAudioEngine.getSnapshot,
  listeningAudioEngine.getServerSnapshot,
);
