export type City = {
  cityId: string;
  name: string;
  lat: number;
  lng: number;
  echoes: number;
};

export const cities: City[] = [
  {
    cityId: 'shanghai',
    name: 'Shanghai',
    lat: 31.2304,
    lng: 121.4737,
    echoes: 12,
  },
  {
    cityId: 'berlin',
    name: 'Berlin',
    lat: 52.52,
    lng: 13.405,
    echoes: 8,
  },
  {
    cityId: 'beijing',
    name: 'Beijing',
    lat: 39.9042,
    lng: 116.4074,
    echoes: 15,
  },
  {
    cityId: 'singapore',
    name: 'Singapore',
    lat: 1.3521,
    lng: 103.8198,
    echoes: 6,
  },
];

export function getCityId(city: City) {
  return city.cityId;
}
