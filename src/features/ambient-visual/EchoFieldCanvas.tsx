import { useEffect, useRef } from 'react';
import { EchoFieldScene } from './EchoFieldScene';
import type { EchoFieldInput } from './types';

type EchoFieldCanvasProps = {
  input: EchoFieldInput;
  className?: string;
};

export function EchoFieldCanvas({ input, className = '' }: EchoFieldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EchoFieldScene | undefined>(undefined);
  const inputRef = useRef(input);

  useEffect(() => {
    inputRef.current = input;
    sceneRef.current?.updateInput(input);
  }, [input]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const scene = new EchoFieldScene();
    scene.mount(host);
    sceneRef.current = scene;
    const resize = () => scene.resize(host.clientWidth, host.clientHeight);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    let previous = performance.now();
    let lastRender = 0;
    const tick = (now: number) => {
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (document.visibilityState === 'visible' && now - lastRender > 1000 / 45) {
        scene.render(delta, now / 1000);
        lastRender = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.dispose();
      sceneRef.current = undefined;
    };
  }, []);

  return <div ref={hostRef} className={`ambient-field-canvas ${className}`} aria-hidden="true" />;
}

export type { EchoFieldInput } from './types';
