import type { User } from '../types/sound';

export const CURRENT_USER_ID = 'me';
export const MING_USER_ID = 'ming';
export const AYA_USER_ID = 'aya';

export const users: User[] = [
  { id: CURRENT_USER_ID, name: 'Me', handle: '@my-atlas', bio: 'Building a personal atlas one recording at a time.', homeCity: 'Shanghai', avatarSeed: 'me-echo', isFollowing: false },
  { id: MING_USER_ID, name: 'Ming', handle: '@minglistens', bio: 'Berlin-based sound collector', homeCity: 'Berlin', avatarSeed: 'ming-berlin', isFollowing: true },
  { id: AYA_USER_ID, name: 'Aya', handle: '@aya.fieldnotes', bio: 'Tokyo-based field recorder', homeCity: 'Tokyo', avatarSeed: 'aya-tokyo', isFollowing: true },
  { id: 'noor', name: 'Noor', handle: '@noor.afterdark', bio: 'Listening after sunset.', homeCity: 'Singapore', avatarSeed: 'noor-night', isFollowing: true },
  { id: 'jonas', name: 'Jonas', handle: '@streetintervals', bio: 'Street recordings and ordinary pauses.', homeCity: 'Berlin', avatarSeed: 'jonas-street', isFollowing: false },
  { id: 'public-archive', name: 'Public Archive', handle: '@open-field-notes', bio: 'Shared and donated recordings.', avatarSeed: 'public-archive', isFollowing: false },
];

export const followedUserIds = users.filter((user) => user.isFollowing).map((user) => user.id);

export function getUser(ownerId: string) {
  return users.find((user) => user.id === ownerId) ?? users[users.length - 1];
}
