import type { SoundNode, TimeFilter } from '../types/sound';

function datePart(value: string) {
  return value.slice(0, 10);
}

function localDatePart(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function filterMemoriesByTime(
  nodes: SoundNode[],
  filter: TimeFilter,
  now = new Date(),
) {
  if (filter.mode === 'all') {
    return nodes;
  }

  if (filter.mode === 'today') {
    const today = localDatePart(now);
    return nodes.filter((node) => datePart(node.recordedAt) === today);
  }

  if (filter.mode === 'past-year') {
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    return nodes.filter((node) => new Date(node.recordedAt) >= start);
  }

  if (filter.mode === 'year') {
    return nodes.filter((node) => Number(node.recordedAt.slice(0, 4)) === filter.year);
  }

  return nodes.filter((node) => datePart(node.recordedAt) === filter.date);
}

export function describeTimeFilter(filter: TimeFilter) {
  if (filter.mode === 'all') return '全部时间';
  if (filter.mode === 'today') return '今天';
  if (filter.mode === 'past-year') return '过去一年';
  if (filter.mode === 'year') return String(filter.year);
  return filter.date || '自定义日期';
}

export function formatRecordedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
