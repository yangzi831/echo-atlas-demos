import { useEffect, useRef } from 'react';

type CityEntryOverlayProps = {
  title: string;
  meta?: string;
  transitionKey: number;
  onComplete: () => void;
};

export function CityEntryOverlay({
  title,
  meta,
  transitionKey,
  onComplete,
}: CityEntryOverlayProps) {
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const timer = window.setTimeout(() => completeRef.current(), 1650);
    return () => window.clearTimeout(timer);
  }, [transitionKey]);

  return (
    <div className="city-entry" aria-live="polite" aria-label={`正在进入 ${title}`}>
      <div className="city-entry-content">
        <h2>{title}</h2>
        {meta && <p>{meta}</p>}
      </div>
    </div>
  );
}
