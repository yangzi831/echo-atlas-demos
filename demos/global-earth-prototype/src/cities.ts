export type City = {
  cityId: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  echoes: number;
  hasPublicMemories: boolean;
};

export const browseCities: City[] = [
  ['shanghai', 'Shanghai', 'China', 31.2304, 121.4737],
  ['berlin', 'Berlin', 'Germany', 52.52, 13.405],
  ['beijing', 'Beijing', 'China', 39.9042, 116.4074],
  ['singapore', 'Singapore', 'Singapore', 1.3521, 103.8198],
  ['tokyo', 'Tokyo', 'Japan', 35.6762, 139.6503],
  ['osaka', 'Osaka', 'Japan', 34.6937, 135.5023],
  ['seoul', 'Seoul', 'South Korea', 37.5665, 126.978],
  ['hong-kong', 'Hong Kong', 'China', 22.3193, 114.1694],
  ['taipei', 'Taipei', 'Taiwan', 25.033, 121.5654],
  ['bangkok', 'Bangkok', 'Thailand', 13.7563, 100.5018],
  ['kuala-lumpur', 'Kuala Lumpur', 'Malaysia', 3.139, 101.6869],
  ['jakarta', 'Jakarta', 'Indonesia', -6.2088, 106.8456],
  ['manila', 'Manila', 'Philippines', 14.5995, 120.9842],
  ['hanoi', 'Hanoi', 'Vietnam', 21.0278, 105.8342],
  ['mumbai', 'Mumbai', 'India', 19.076, 72.8777],
  ['delhi', 'Delhi', 'India', 28.6139, 77.209],
  ['dubai', 'Dubai', 'United Arab Emirates', 25.2048, 55.2708],
  ['istanbul', 'Istanbul', 'Türkiye', 41.0082, 28.9784],
  ['london', 'London', 'United Kingdom', 51.5072, -0.1276],
  ['paris', 'Paris', 'France', 48.8566, 2.3522],
  ['amsterdam', 'Amsterdam', 'Netherlands', 52.3676, 4.9041],
  ['copenhagen', 'Copenhagen', 'Denmark', 55.6761, 12.5683],
  ['lisbon', 'Lisbon', 'Portugal', 38.7223, -9.1393],
  ['madrid', 'Madrid', 'Spain', 40.4168, -3.7038],
  ['rome', 'Rome', 'Italy', 41.9028, 12.4964],
  ['vienna', 'Vienna', 'Austria', 48.2082, 16.3738],
  ['prague', 'Prague', 'Czechia', 50.0755, 14.4378],
  ['warsaw', 'Warsaw', 'Poland', 52.2297, 21.0122],
  ['stockholm', 'Stockholm', 'Sweden', 59.3293, 18.0686],
  ['new-york', 'New York', 'United States', 40.7128, -74.006],
  ['los-angeles', 'Los Angeles', 'United States', 34.0522, -118.2437],
  ['san-francisco', 'San Francisco', 'United States', 37.7749, -122.4194],
  ['chicago', 'Chicago', 'United States', 41.8781, -87.6298],
  ['miami', 'Miami', 'United States', 25.7617, -80.1918],
  ['mexico-city', 'Mexico City', 'Mexico', 19.4326, -99.1332],
  ['toronto', 'Toronto', 'Canada', 43.6532, -79.3832],
  ['vancouver', 'Vancouver', 'Canada', 49.2827, -123.1207],
  ['sao-paulo', 'São Paulo', 'Brazil', -23.5505, -46.6333],
  ['buenos-aires', 'Buenos Aires', 'Argentina', -34.6037, -58.3816],
  ['bogota', 'Bogotá', 'Colombia', 4.711, -74.0721],
  ['lima', 'Lima', 'Peru', -12.0464, -77.0428],
  ['santiago', 'Santiago', 'Chile', -33.4489, -70.6693],
  ['cape-town', 'Cape Town', 'South Africa', -33.9249, 18.4241],
  ['nairobi', 'Nairobi', 'Kenya', -1.2921, 36.8219],
  ['cairo', 'Cairo', 'Egypt', 30.0444, 31.2357],
  ['lagos', 'Lagos', 'Nigeria', 6.5244, 3.3792],
  ['accra', 'Accra', 'Ghana', 5.6037, -0.187],
  ['casablanca', 'Casablanca', 'Morocco', 33.5731, -7.5898],
  ['sydney', 'Sydney', 'Australia', -33.8688, 151.2093],
  ['melbourne', 'Melbourne', 'Australia', -37.8136, 144.9631],
  ['auckland', 'Auckland', 'New Zealand', -36.8509, 174.7645],
].map(([cityId, name, country, lat, lng]) => ({
  cityId: cityId as string,
  name: name as string,
  country: country as string,
  lat: lat as number,
  lng: lng as number,
  echoes: 0,
  hasPublicMemories: false,
}));

export const cities: City[] = browseCities;

export function getCityId(city: City) {
  return city.cityId;
}
