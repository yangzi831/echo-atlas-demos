import type { VisualSession } from '../../types/sound';

type VisualListeningPlaceholderProps = {
  session: VisualSession;
  onClose: () => void;
};

export function VisualListeningPlaceholder({ session, onClose }: VisualListeningPlaceholderProps) {
  const activeMemory = session.memories.find((memory) => memory.id === session.activeMemoryId);
  if (!activeMemory) return null;

  return (
    <div className="modal-backdrop visual-listening-backdrop" role="presentation">
      <section className="visual-listening-placeholder" role="dialog" aria-modal="true" aria-label="Visual Listening placeholder">
        <button className="panel-close" type="button" onClick={onClose} aria-label="关闭">×</button>
        <p className="panel-kicker">Visual Session Interface</p>
        <div className={`visual-placeholder-imprint imprint-${activeMemory.visualImprint.type}`} aria-hidden="true">
          {Array.from({ length: 28 }).map((_, index) => <span key={index} />)}
        </div>
        <h2>{activeMemory.title}</h2>
        <p>{activeMemory.location.placeName} · {session.preset ?? 'sound-imprint'}</p>
        <small>Visual Engine placeholder · {session.memories.length} memories in session</small>
      </section>
    </div>
  );
}
