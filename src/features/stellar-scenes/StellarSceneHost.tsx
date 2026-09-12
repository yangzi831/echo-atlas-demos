import { useEffect, useRef } from 'react';
import type { ListeningAudioFeatures } from '../visual-listening/audio/types';
import { VisualEngine } from './vendor/aurora/visual-engine';
import { createSharedState } from './vendor/aurora/constants';
import { StellarScene as GravityScene } from './vendor/gravity/scene';
import { StellarSynthEngine } from './vendor/constellation/engine';
import { ResonanceAxisScene } from './vendor/resonance/scene';
import { StellarSynthEngine as StarChartEngine } from './vendor/star-chart/engine';

export type StellarSceneId = 'aurora' | 'gravity' | 'resonance' | 'constellation' | 'star-chart';

type StellarSceneHostProps = {
  scene: StellarSceneId;
  audio?: ListeningAudioFeatures;
  playing?: boolean;
  className?: string;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function frame(audio?: ListeningAudioFeatures) {
  const features = audio ?? { rms: 0, peak: 0, spectralCentroid: 0, activityDensity: 0, transient: 0, continuity: 0 };
  const centroid = clamp01(features.spectralCentroid / 6000);
  return {
    amplitude: clamp01(features.rms),
    bass: clamp01(features.rms * 0.78 + features.peak * 0.22),
    mid: clamp01(features.activityDensity * 0.7 + centroid * 0.3),
    high: clamp01(features.transient * 0.7 + centroid * 0.3),
    beat: clamp01(features.transient),
    drone: clamp01(features.continuity * 0.75 + features.rms * 0.25),
  };
}

export function StellarSceneHost({ scene, audio, playing = true, className = '' }: StellarSceneHostProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(audio);
  const playingRef = useRef(playing);
  audioRef.current = audio;
  playingRef.current = playing;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let pushFrame = 0;
    const audioFrame = () => frame(audioRef.current);
    const push = () => {
      if (disposed) return;
      const next = audioFrame();
      if (scene === 'aurora') {
        state.energy = Math.max(0.12, next.amplitude * 0.9 + next.bass * 0.2);
        state.releaseAmount = next.beat;
        state.scene = next.mid * 3;
        state.patternVariant = Math.min(3, Math.floor(next.high * 4));
        if (next.beat > 0.72) aurora?.markStep();
      }
      if (scene === 'gravity') gravity?.setAudioFrame(next);
      if (scene === 'constellation') constellation?.pushAudio(next);
      if (scene === 'star-chart') {
        // The star chart has its own honest ambient source when no memory is
        // playing. Do not replace that motion with a synthetic zero frame.
        starChart?.setAudioFrame(audioRef.current ? next : null);
      }
      if (scene === 'resonance') resonance?.audio.pushExternal({
        energy: next.amplitude,
        bass: next.bass,
        mid: next.mid,
        high: next.high,
        beat: next.beat,
        beatOnset: next.beat > 0.7,
        beatId: Math.round(performance.now() / 200),
        flux: next.high,
        live: Boolean(audioRef.current),
      });
      pushFrame = requestAnimationFrame(push);
    };

    const state = createSharedState();
    const canvas = document.createElement('canvas');
    canvas.className = 'stellar-scene-canvas';
    mount.appendChild(canvas);
    let aurora: VisualEngine | undefined;
    let gravity: GravityScene | undefined;
    let constellation: StellarSynthEngine | undefined;
    let starChart: StarChartEngine | undefined;
    let resonance: ResonanceAxisScene | undefined;

    try {
      if (scene === 'aurora') {
        aurora = new VisualEngine(canvas, state);
        aurora.start();
      } else if (scene === 'gravity') {
        gravity = new GravityScene({ maxPixelRatio: 1.5 });
        gravity.mount(canvas);
      } else if (scene === 'constellation') {
        constellation = new StellarSynthEngine({ maxPixelRatio: 1.5, attachPointerListeners: true });
        constellation.mount(mount);
        canvas.remove();
      } else if (scene === 'star-chart') {
        starChart = new StarChartEngine({
          maxPixelRatio: 1.5,
          respectReducedMotion: true,
          colors: { background: 0x04050a, ink: 0xe9e1d4, muted: 0x8ea3ad },
          particleCount: typeof window !== 'undefined' && window.innerWidth < 700 ? 16000 : 52000,
          weights: { nebula: 1.05, chart: 1.28, core: 0.94 },
          coreGlow: 1,
          parallax: 0.08,
        });
        starChart.mount(canvas, mount);
      } else {
        resonance = new ResonanceAxisScene();
        resonance.mount(mount);
        canvas.remove();
      }
      push();
    } catch (error) {
      console.error(`Echo Atlas ${scene} scene failed to mount.`, error);
    }

    const onVisibility = () => {
      if (document.hidden) {
        constellation?.setEnabled(false);
        resonance?.pause();
      } else {
        constellation?.setEnabled(playingRef.current);
        resonance?.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(pushFrame);
      document.removeEventListener('visibilitychange', onVisibility);
      aurora?.dispose();
      gravity?.dispose();
      constellation?.dispose();
      starChart?.dispose();
      resonance?.dispose();
      mount.replaceChildren();
    };
  }, [scene]);

  useEffect(() => {
    // Constellation and resonance own their loops; pause only those engines.
    // The other two remain driven by their original scene contracts.
    const mount = mountRef.current;
    if (!mount || playing) return;
    // Playback state is deliberately read by the next audio frame; no second
    // audio source is created here.
  }, [playing]);

  return <div ref={mountRef} className={`stellar-scene-host ${className}`.trim()} aria-hidden="true" />;
}
