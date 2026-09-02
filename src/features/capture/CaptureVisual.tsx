import { useEffect, useRef } from 'react';
import type { CaptureFeatureSummary } from '../../services/capture';

type CaptureVisualProps = {
  audioFeatures: CaptureFeatureSummary;
  seed?: number;
  active?: boolean;
};

type Particle = {
  angle: number;
  radius: number;
  size: number;
  drift: number;
  brightness: number;
};

export function CaptureVisual({ audioFeatures, seed = 37, active = false }: CaptureVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const featuresRef = useRef(audioFeatures);

  useEffect(() => {
    featuresRef.current = audioFeatures;
  }, [audioFeatures]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let animationFrame = 0;
    let expansion = 0;
    let previousPeak = 0;
    let randomState = seed || 1;
    const random = () => {
      randomState = (randomState * 16807) % 2147483647;
      return (randomState - 1) / 2147483646;
    };
    const particles: Particle[] = Array.from({ length: 190 }, () => ({
      angle: random() * Math.PI * 2,
      radius: 0.1 + random() * 0.9,
      size: 0.45 + random() * 1.35,
      drift: (random() - 0.5) * 0.0018,
      brightness: 0.25 + random() * 0.65,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      const features = featuresRef.current;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * (0.18 + features.rms * 0.28);
      if (features.peak > Math.max(0.18, previousPeak + 0.08)) expansion = 1;
      previousPeak = features.peak;
      expansion *= reducedMotion ? 0.65 : 0.91;

      context.clearRect(0, 0, width, height);
      const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 1.7);
      glow.addColorStop(0, 'rgba(225, 239, 238, ' + (0.025 + features.rms * 0.08) + ')');
      glow.addColorStop(1, 'rgba(7, 11, 14, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      particles.forEach((particle, index) => {
        const frequencyBias = Math.min(1, features.frequencyCentroid / 5000);
        const phase = particle.angle + frame * particle.drift * (active ? 1 : 0.25);
        const noise = Math.sin(index * 2.73 + frame * 0.012) * (2 + features.activityDensity * 8);
        const radius = baseRadius * particle.radius
          + expansion * (12 + particle.radius * 22)
          + noise * (0.18 + frequencyBias * 0.5);
        const flatten = 0.55 + frequencyBias * 0.34;
        const x = centerX + Math.cos(phase) * radius;
        const y = centerY + Math.sin(phase) * radius * flatten;
        const alpha = particle.brightness * (0.28 + features.rms * 1.5) * (0.72 + features.activityDensity * 0.28);
        context.beginPath();
        context.arc(x, y, particle.size + features.peak * 0.8, 0, Math.PI * 2);
        context.fillStyle = 'rgba(222, 234, 232, ' + Math.min(0.92, alpha) + ')';
        context.fill();
      });

      frame += reducedMotion ? 0.12 : 1;
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [active, seed]);

  return <canvas ref={canvasRef} className="capture-visual" aria-label="实时声音视觉印记" />;
}
