export type SeedLicense = 'CC0' | 'Attribution' | 'Attribution-NonCommercial' | 'other';

export type FreesoundSeedCandidate = {
  id: number;
  title: string;
  username: string;
  license: SeedLicense;
  sourceUrl: string;
  previewUrl: string;
  attribution: string;
  cityId: string;
  seedType: 'hero' | 'ambient';
};

export type FreesoundSearchPlan = {
  cityId: string;
  query: string;
  filter: string;
  fields: string;
  preferredLicenses: SeedLicense[];
};

const sharedFields = 'id,name,username,license,previews, created, url, geotags';

const cityQueries: Record<string, string[]> = {
  tokyo: ['station train platform', 'rain street crossing', 'shrine quiet ambience'],
  shanghai: ['metro night street', 'rain riverside market lane'],
  beijing: ['hutong street park', 'subway rain wind'],
  singapore: ['MRT hawker centre', 'tropical rain city ambience'],
  berlin: ['U-Bahn rain street', 'park night ambience'],
  'new-york': ['subway avenue traffic', 'park crowd rain siren'],
};

export function buildFreesoundSearchPlan(): FreesoundSearchPlan[] {
  return Object.entries(cityQueries).flatMap(([cityId, queries]) => queries.map((query) => ({
    cityId,
    query,
    filter: 'duration:[10 TO 180] type:wav OR type:mp3',
    fields: sharedFields,
    preferredLicenses: ['CC0', 'Attribution'],
  })));
}

export function normalizeFreesoundCandidate(candidate: FreesoundSeedCandidate) {
  return {
    sourcePlatform: 'freesound' as const,
    sourceUrl: candidate.sourceUrl,
    audioUrl: candidate.previewUrl,
    attribution: `${candidate.title} by ${candidate.username} · ${candidate.license}`,
    seedType: candidate.seedType,
  };
}

