import type { ListeningStory } from '../../types/sound';

type StorySuggestionCardProps = {
  story: ListeningStory;
  onStart: () => void;
  onDismiss: () => void;
};

export function StorySuggestionCard({ story, onStart, onDismiss }: StorySuggestionCardProps) {
  return (
    <aside className="story-suggestion" aria-label="推荐聆听">
      <button className="story-suggestion-close" type="button" onClick={onDismiss} aria-label="关闭推荐">×</button>
      <span>推荐聆听</span>
      <strong>{story.title} · {story.nodeIds.length}段声音</strong>
      <button className="story-suggestion-start" type="button" onClick={onStart}>开始</button>
    </aside>
  );
}
