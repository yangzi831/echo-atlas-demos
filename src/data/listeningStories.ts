import type { ListeningStory } from '../types/sound';

export const listeningStories: ListeningStory[] = [
  {
    id: 'shanghai-rain-night',
    cityId: 'shanghai',
    entryLabel: '听一段上海雨夜',
    title: '上海雨夜',
    nodeIds: ['bus-stop-rain-night', 'suzhou-creek-under-bridge', 'plane-tree-rain'],
  },
  {
    id: 'berlin-winter-night',
    cityId: 'berlin',
    entryLabel: '听一段柏林冬夜',
    title: '柏林冬夜',
    nodeIds: ['kreuzberg-winter-night', 'berlin-ubahn-arrival', 'berlin-spati-chat'],
  },
  {
    id: 'beijing-early-morning',
    cityId: 'beijing',
    entryLabel: '听一段北京清晨',
    title: '北京清晨',
    nodeIds: ['beijing-first-arrival', 'beijing-hutong-breakfast', 'beijing-subway-transfer'],
  },
  {
    id: 'singapore-tropical-rain',
    cityId: 'singapore',
    entryLabel: '听一场热带雨',
    title: '新加坡雨后',
    nodeIds: ['singapore-tropical-rain', 'singapore-mrt', 'singapore-night-neighbourhood'],
  },
];

export function getCityStory(cityId: string) {
  return listeningStories.find((story) => story.cityId === cityId);
}
