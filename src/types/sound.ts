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

export type Visibility = 'private' | 'followers' | 'public';
export type LocationPrivacy = 'exact' | 'approximate';
export type AtlasMode = 'my-atlas' | 'explore' | 'following' | 'recall';
export type RecallScope = 'mine' | 'public' | 'following';
export type CaptureSource = 'echo-device' | 'phone' | 'upload';

export type User = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  homeCity?: string;
  avatarSeed: string;
  isFollowing: boolean;
};

export type City = {
  id: string;
  name: string;
  localName: string;
  country: string;
  center: [number, number];
  zoom: number;
  timeZone: string;
};

export type SoundFeatures = {
  loudness: number;
  spectralCentroid: number;
  rhythmDensity: number;
  rms?: number;
  peak?: number;
  frequencyCentroid?: number;
  activityDensity?: number;
  transientDensity?: number;
  continuity?: number;
};

export type VisualImprint = {
  seed: number;
  type: 'ripple' | 'grain' | 'filament' | 'pulse';
};

export type SoundLocation = {
  lat: number;
  lng: number;
  placeName: string;
  city: string;
  country: string;
};

export type SoundMemory = {
  id: string;
  ownerId: User['id'];
  title: string;
  audioUrl: string;
  duration: number;
  recordedAt: string;
  location: SoundLocation;
  note: string;
  imageUrl?: string;
  tags: string[];
  moods: string[];
  soundFeatures: SoundFeatures;
  visualImprint: VisualImprint;
  visibility: Visibility;
  locationPrivacy: LocationPrivacy;
  createdAt: string;
  captureSource?: CaptureSource;

  // Derived compatibility fields used by the existing map and story layers.
  cityId: City['id'];
  coordinate: [number, number];
  density: number;
  sourceType: SoundSourceType;
  memoryRelation: MemoryRelation[];
  aiDescription: string;
  echoMessage: string;
};

/** Temporary alias while map and story components retain their existing naming. */
export type SoundNode = SoundMemory;

export type VisualSession = {
  memories: SoundMemory[];
  activeMemoryId?: string;
  preset?: string;
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
