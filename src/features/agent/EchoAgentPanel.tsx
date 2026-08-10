import { useMemo, useState } from 'react';
import { agentRoutes } from '../../data/soundNodes';
import { getCityStory } from '../../data/listeningStories';
import type { ListeningStory, SoundNode } from '../../types/sound';

type EchoAgentPanelProps = {
  isOpen: boolean;
  nodes: SoundNode[];
  onRoute: (nodeIds: string[]) => void;
  onSelectNode: (nodeId: string) => void;
  onStartStory: (story: ListeningStory) => void;
};

const berlinWinterIds = [
  'kreuzberg-winter-night',
  'berlin-ubahn-arrival',
  'berlin-spati-chat',
  'berlin-rain-street',
  'tempelhof-open-field',
  'berlin-courtyard-snow',
];

export function EchoAgentPanel({
  isOpen,
  nodes,
  onRoute,
  onSelectNode,
  onStartStory,
}: EchoAgentPanelProps) {
  const defaultPrompt = '我离开柏林已经一年了，有时候还是会想念那里。';
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [resultIds, setResultIds] = useState<string[]>();
  const isBerlinResult = resultIds?.[0] === berlinWinterIds[0];
  const resultNodes = useMemo(
    () => (resultIds ?? []).map((id) => nodes.find((node) => node.id === id)).filter((node): node is SoundNode => Boolean(node)),
    [nodes, resultIds],
  );

  if (!isOpen) {
    return null;
  }

  const handleListen = () => {
    const wantsBerlin = /柏林|berlin|winter|冬|想念|离开/i.test(prompt);
    const nodeIds = wantsBerlin ? berlinWinterIds : agentRoutes[0].nodeIds;
    setResultIds(nodeIds);
    onRoute(nodeIds);
  };

  const startListening = () => {
    const story = getCityStory(isBerlinResult ? 'berlin' : 'shanghai');
    if (story) {
      onStartStory(story);
    }
  };

  return (
    <aside className="agent-panel" aria-label="声音路线选择">
      <p className="panel-kicker">Listening Guide</p>
      <h2>想听什么？</h2>

      <label className="agent-prompt">
        <span>说一个地方，或一种你正在想念的声音</span>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} />
      </label>

      <div className="prompt-chips">
        <button type="button" onClick={() => setPrompt(defaultPrompt)}>柏林 · 想念 · 冬天</button>
        <button type="button" onClick={() => setPrompt(agentRoutes[0].prompt)}>上海 · 水声 · 安静</button>
      </div>

      <button className="curate-button" type="button" onClick={handleListen}>寻找声音</button>

      {resultIds && (
        <div className="agent-route" aria-live="polite">
          <p>找到了 {resultNodes.length} 段{isBerlinResult ? '柏林冬天' : '上海夜晚'}的声音。</p>
          <div className="agent-result-preview">
            {resultNodes.slice(0, 3).map((node) => (
              <button type="button" key={node.id} onClick={() => onSelectNode(node.id)}>
                <strong>{node.location}</strong>
                <span>{node.tags.slice(0, 2).join(' / ')}</span>
              </button>
            ))}
          </div>
          <button className="agent-start" type="button" onClick={startListening}>开始听</button>
        </div>
      )}
    </aside>
  );
}
