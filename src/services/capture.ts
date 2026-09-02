import { CURRENT_USER_ID } from '../data/users';
import type {
  CaptureSource,
  City,
  LocationPrivacy,
  SoundFeatures,
  SoundMemory,
  Visibility,
} from '../types/sound';

export type CaptureFeatureSummary = {
  rms: number;
  peak: number;
  frequencyCentroid: number;
  activityDensity: number;
  transientDensity: number;
  continuity: number;
};

export type CreateSoundMemoryInput = {
  city: City;
  coordinate: [number, number];
  placeName: string;
  locationCity?: string;
  country?: string;
  recordedAt: string;
  duration: number;
  audioUrl: string;
  note: string;
  title?: string;
  imageUrl?: string;
  tags?: string[];
  moods?: string[];
  visibility: Visibility;
  locationPrivacy: LocationPrivacy;
  features: CaptureFeatureSummary;
  captureSource?: CaptureSource;
};

function hashSeed(value: string) {
  return [...value].reduce((total, character, index) => (
    (total * 31 + character.charCodeAt(0) + index) % 2147483647
  ), 17);
}

function imprintType(features: CaptureFeatureSummary): SoundMemory['visualImprint']['type'] {
  if (features.transientDensity > 0.3) return 'pulse';
  if (features.frequencyCentroid > 2600) return 'filament';
  if (features.continuity > 0.68) return 'ripple';
  return 'grain';
}

export function createSoundMemory(input: CreateSoundMemoryInput): SoundMemory {
  const id = 'capture-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const note = input.note.trim() || '在这里录下的一段声音。';
  const soundFeatures: SoundFeatures = {
    loudness: input.features.rms,
    spectralCentroid: input.features.frequencyCentroid,
    rhythmDensity: input.features.activityDensity,
    rms: input.features.rms,
    peak: input.features.peak,
    frequencyCentroid: input.features.frequencyCentroid,
    activityDensity: input.features.activityDensity,
    transientDensity: input.features.transientDensity,
    continuity: input.features.continuity,
  };

  return {
    id,
    ownerId: CURRENT_USER_ID,
    title: input.title?.trim() || '《' + note.slice(0, 12) + '》',
    audioUrl: input.audioUrl,
    duration: Math.max(1, Math.round(input.duration)),
    recordedAt: input.recordedAt,
    location: {
      lat: input.coordinate[1],
      lng: input.coordinate[0],
      placeName: input.placeName,
      city: input.locationCity || input.city.localName,
      country: input.country || input.city.country,
    },
    note,
    imageUrl: input.imageUrl,
    tags: input.tags?.length ? input.tags : ['现场录音'],
    moods: input.moods?.length ? input.moods : ['此刻'],
    soundFeatures,
    visualImprint: {
      seed: hashSeed(id + ':' + input.features.frequencyCentroid + ':' + input.features.peak),
      type: imprintType(input.features),
    },
    visibility: input.visibility,
    locationPrivacy: input.locationPrivacy,
    createdAt: new Date().toISOString(),
    captureSource: input.captureSource ?? 'phone',
    cityId: input.city.id,
    coordinate: input.coordinate,
    density: Math.min(0.94, 0.58 + input.features.rms * 0.7),
    sourceType: 'user_recording',
    memoryRelation: ['lived_here'],
    aiDescription: '浏览器现场录音。声音特征由设备端实时分析生成。',
    echoMessage: note,
  };
}
