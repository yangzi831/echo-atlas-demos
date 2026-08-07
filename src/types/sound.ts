export type SoundSourceType =
  | 'user_recording'
  | 'authentic_archive'
  | 'artistic_reconstruction';

export type TimePeriod = '1990s' | '2010s' | '2026' | 'Future Archive';

export type MemoryRelation =
  | 'lived_here'
  | 'miss_this_place'
  | 'first_arrival'
  | 'new_beginning'
  | 'visited'
  | 'witnessed_event'
  | 'imagined_future';

export type City = {
  id: string;
  name: string;
  localName: string;
  country: string;
  center: [number, number];
  zoom: number;
};

export type SoundNode = {
  id: string;
  cityId: City['id'];
  country: string;
  title: string;
  placeName: string;
  location: string;
  recordedAt: string;
  timePeriod: TimePeriod;
  memoryRelation: MemoryRelation[];
  sourceType: SoundSourceType;
  coordinate: [number, number];
  mapPosition: {
    x: number;
    y: number;
  };
  density: number;
  tags: string[];
  moods: string[];
  contributor: string;
  memoryText: string;
  uploader: string;
  aiDescription: string;
  echoMessage: string;
};

export type AgentRoute = {
  id: string;
  prompt: string;
  nodeIds: string[];
  summary: string;
};
