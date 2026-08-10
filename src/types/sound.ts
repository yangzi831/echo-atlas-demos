export type SoundSourceType =
  | 'user_recording'
  | 'authentic_archive'
  | 'artistic_reconstruction';

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
  timeZone: string;
};

export type SoundNode = {
  id: string;
  cityId: City['id'];
  city: string;
  country: string;
  title: string;
  placeName: string;
  location: string;
  recordedAt: string;
  memoryRelation: MemoryRelation[];
  sourceType: SoundSourceType;
  coordinate: [number, number];
  density: number;
  tags: string[];
  moods: string[];
  contributor: string;
  memoryText: string;
  aiDescription: string;
  echoMessage: string;
  durationSeconds: number;
  hasImage: boolean;
  isMine: boolean;
  createdAt: string;
};

export type TimeFilter =
  | { mode: 'all' }
  | { mode: 'today' }
  | { mode: 'past-year' }
  | { mode: 'year'; year: number }
  | { mode: 'custom'; date: string };

export type AgentRoute = {
  id: string;
  prompt: string;
  nodeIds: string[];
  summary: string;
};

export type ListeningStory = {
  id: string;
  cityId: City['id'];
  entryLabel: string;
  title: string;
  nodeIds: string[];
};
