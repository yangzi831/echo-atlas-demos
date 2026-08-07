import { useMemo, useState } from 'react';
import { agentRoutes, soundNodes } from '../../data/soundNodes';

type EchoAgentPanelProps = {
  isOpen: boolean;
  onRoute: (nodeIds: string[]) => void;
  onSelectNode: (nodeId: string) => void;
};

export function EchoAgentPanel({
  isOpen,
  onRoute,
  onSelectNode,
}: EchoAgentPanelProps) {
  const route = agentRoutes[0];
  const [prompt, setPrompt] = useState(route.prompt);
  const [hasResponse, setHasResponse] = useState(false);
  const routeNodes = useMemo(
    () => route.nodeIds.map((id) => soundNodes.find((node) => node.id === id)).filter(Boolean),
    [route.nodeIds],
  );

  if (!isOpen) {
    return null;
  }

  const handleCurate = () => {
    setHasResponse(true);
    onRoute(route.nodeIds);
  };

  return (
    <aside className="agent-panel" aria-label="Echo Agent">
      <p className="panel-kicker">Echo Agent</p>
      <h2>城市声音策展人</h2>
      <p className="agent-copy">
        选择一种今晚的倾听倾向，Agent 会把地点、时间和声音密度编成一条轻路线。
      </p>

      <label className="agent-prompt">
        <span>我想听</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
        />
      </label>

      <div className="prompt-chips">
        <button type="button" onClick={() => setPrompt(route.prompt)}>
          安静 · 水声 · 不拥挤
        </button>
        <button
          type="button"
          onClick={() => setPrompt('给我一条从旧上海到未来江岸的声音路线。')}
        >
          旧城到未来
        </button>
      </div>

      <button className="curate-button" type="button" onClick={handleCurate}>
        生成三站漫游
      </button>

      {hasResponse && (
        <div className="agent-route" aria-live="polite">
          <p>{route.summary}</p>
          {routeNodes.map((node, index) =>
            node ? (
              <button
                type="button"
                className="route-stop"
                key={node.id}
                onClick={() => onSelectNode(node.id)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{node.location}</strong>
                <small>{node.tags.join(' · ')}</small>
              </button>
            ) : null,
          )}
        </div>
      )}
    </aside>
  );
}
