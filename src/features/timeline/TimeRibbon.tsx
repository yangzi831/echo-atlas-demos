import type { TimePeriod } from '../../types/sound';

type TimeRibbonProps = {
  periods: TimePeriod[];
  selected: TimePeriod;
  onSelect: (period: TimePeriod) => void;
};

export function TimeRibbon({ periods, selected, onSelect }: TimeRibbonProps) {
  return (
    <nav className="time-ribbon" aria-label="声音时间丝带">
      <div className="ribbon-line" aria-hidden="true" />
      {periods.map((period) => (
        <button
          key={period}
          type="button"
          className={`time-choice ${selected === period ? 'is-active' : ''}`}
          onClick={() => onSelect(period)}
        >
          <span>{period}</span>
        </button>
      ))}
    </nav>
  );
}
