import { useMemo, useRef } from 'react';
import type { SoundNode, TimeFilter } from '../../types/sound';
import { describeTimeFilter, filterMemoriesByTime } from '../../services/time';

type TimeRibbonProps = {
  nodes: SoundNode[];
  filter: TimeFilter;
  onChange: (filter: TimeFilter) => void;
};

export function TimeRibbon({ nodes, filter, onChange }: TimeRibbonProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const years = useMemo(
    () => nodes.map((node) => Number(node.recordedAt.slice(0, 4))).filter(Number.isFinite),
    [nodes],
  );
  const minYear = years.length > 0 ? Math.min(...years) : new Date().getFullYear();
  const maxYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
  const selectedYear = filter.mode === 'year' ? filter.year : maxYear;
  const visibleCount = filterMemoriesByTime(nodes, filter).length;

  return (
    <nav className="time-ribbon" aria-label="声音时间丝带">
      <div className="time-ribbon-head">
        <div className="time-quick-actions" aria-label="时间快捷入口">
          <button type="button" aria-pressed={filter.mode === 'all'} onClick={() => onChange({ mode: 'all' })}>全部时间</button>
          <button type="button" aria-pressed={filter.mode === 'today'} onClick={() => onChange({ mode: 'today' })}>今天</button>
          <button type="button" aria-pressed={filter.mode === 'past-year'} onClick={() => onChange({ mode: 'past-year' })}>过去一年</button>
          <button type="button" aria-pressed={filter.mode === 'custom'} onClick={() => dateInputRef.current?.showPicker()}>自定义日期</button>
        </div>
        <div className="time-readout">
          <span>{describeTimeFilter(filter)}</span>
          <strong>{visibleCount} ECHOES</strong>
        </div>
      </div>

      <div className="time-track-shell">
        <span>{minYear}</span>
        <div className="time-track">
          <div className="time-track-glow" aria-hidden="true" />
          <input
            type="range"
            min={minYear}
            max={maxYear}
            step="1"
            value={selectedYear}
            aria-label="按年份探索声音"
            onChange={(event) => onChange({ mode: 'year', year: Number(event.target.value) })}
          />
        </div>
        <span>{maxYear}</span>
        <input
          ref={dateInputRef}
          className="time-date-input"
          type="date"
          aria-label="选择精确日期"
          value={filter.mode === 'custom' ? filter.date : ''}
          min={`${minYear}-01-01`}
          max={`${maxYear}-12-31`}
          onChange={(event) => event.target.value && onChange({ mode: 'custom', date: event.target.value })}
        />
      </div>
    </nav>
  );
}
