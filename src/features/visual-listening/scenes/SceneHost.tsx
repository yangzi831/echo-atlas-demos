import { useEffect, useRef, useState } from 'react';
import type { SoundMemory } from '../../../types/sound';
import type { ListeningAudioSnapshot } from '../audio';
import { adaptAudioFeatures, getMemoryVisualProfile } from './profile';
import { getVisualPreset } from './registry';
import type { VisualPresetId, VisualScene } from './types';

type SceneHostProps = {
  presetId: VisualPresetId;
  activeMemory: SoundMemory;
  audio: ListeningAudioSnapshot;
};

type SceneLayer = {
  key: string;
  memory: SoundMemory;
  scene: VisualScene;
  element: HTMLDivElement;
  expiresAt?: number;
  fadeDuration: number;
};

export function SceneHost({ presetId, activeMemory, audio }: SceneHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<SceneLayer[]>([]);
  const audioRef = useRef(audio);
  const sizeRef = useRef({ width: 1, height: 1, pixelRatio: 1 });
  const [renderError, setRenderError] = useState<string>();
  audioRef.current = audio;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frameId = 0;
    let previousTime = performance.now();
    const startedAt = previousTime;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height, pixelRatio: window.devicePixelRatio };
      layersRef.current.forEach((layer) => layer.scene.resize(rect.width, rect.height, window.devicePixelRatio));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const animate = (now: number) => {
      const delta = Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      const activeAudio = audioRef.current;
      layersRef.current = layersRef.current.filter((layer) => {
        const residue = layer.expiresAt
          ? Math.max(0, (layer.expiresAt - now) / layer.fadeDuration)
          : 1;
        if (residue <= 0) {
          layer.scene.dispose();
          layer.element.remove();
          return false;
        }
        const receivesLiveAudio = !layer.expiresAt
          && activeAudio.playing
          && activeAudio.memoryId === layer.memory.id;
        const features = adaptAudioFeatures(activeAudio.features, layer.memory, receivesLiveAudio);
        layer.scene.update(reducedMotion ? 0 : delta, reducedMotion ? 0 : (now - startedAt) / 1000, features, residue);
        return true;
      });
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      layersRef.current.forEach((layer) => {
        layer.scene.dispose();
        layer.element.remove();
      });
      layersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const now = performance.now();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fadeDuration = reducedMotion ? 80 : 3600;
    if (layersRef.current.length > 1) {
      const previousLayers = layersRef.current.slice(0, -1);
      previousLayers.forEach((layer) => {
        layer.scene.dispose();
        layer.element.remove();
      });
      layersRef.current = layersRef.current.slice(-1);
    }
    layersRef.current.forEach((layer) => {
      if (!layer.expiresAt) {
        layer.expiresAt = now + fadeDuration;
        layer.fadeDuration = fadeDuration;
      }
    });

    const element = document.createElement('div');
    element.className = 'visual-listening-scene-layer';
    container.appendChild(element);
    const scene = getVisualPreset(presetId).create(getMemoryVisualProfile(activeMemory));
    try {
      scene.mount(element);
      const { width, height, pixelRatio } = sizeRef.current;
      scene.resize(width, height, pixelRatio);
      layersRef.current.push({
        key: `${presetId}:${activeMemory.id}:${now}`,
        memory: activeMemory,
        scene,
        element,
        fadeDuration,
      });
      setRenderError(undefined);
    } catch (error) {
      scene.dispose();
      element.remove();
      setRenderError(error instanceof Error ? error.message : 'Visual renderer could not start.');
    }
  }, [activeMemory, presetId]);

  return (
    <div ref={containerRef} className="visual-listening-scene-host">
      {renderError && <div className="visual-listening-error" role="alert">{renderError}</div>}
    </div>
  );
}
