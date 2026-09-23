import { SettlementProximity } from './types';

export interface SettlementRecord {
  name: string;
  type: 'city' | 'town' | 'village' | 'protected_area';
  latitude: number;
  longitude: number;
  population?: number;
}

export const MONITORED_SETTLEMENTS: SettlementRecord[] = [
  // California Sierra Zone
  { name: 'Quincy, CA', type: 'town', latitude: 39.9368, longitude: -120.9472, population: 5200 },
  { name: 'Greenville, CA', type: 'town', latitude: 40.1402, longitude: -120.9525, population: 1100 },
  { name: 'Meadow Valley, CA', type: 'village', latitude: 39.9360, longitude: -121.0620, population: 450 },
  { name: 'Plumas National Forest', type: 'protected_area', latitude: 39.9500, longitude: -120.9000 },

  // Pantanal Brazil Zone
  { name: 'Poconé', type: 'city', latitude: -16.2567, longitude: -56.6228, population: 33000 },
  { name: 'Barão de Melgaço', type: 'town', latitude: -16.1944, longitude: -55.9675, population: 8000 },
  { name: 'Pantanal Matogrossense National Park', type: 'protected_area', latitude: -17.5000, longitude: -57.3000 },

  // Greece Evia Island Zone
  { name: 'Mantoudi', type: 'town', latitude: 38.7981, longitude: 23.4797, population: 4800 },
  { name: 'Psachna', type: 'city', latitude: 38.5794, longitude: 23.6436, population: 6000 },
  { name: 'Limni Evias', type: 'town', latitude: 38.7700, longitude: 23.3200, population: 2000 },

  // Australia Blue Mountains Zone
  { name: 'Katoomba', type: 'city', latitude: -33.7125, longitude: 150.3119, population: 9800 },
  { name: 'Leura', type: 'town', latitude: -33.7089, longitude: 150.3325, population: 4600 },
  { name: 'Blackheath', type: 'town', latitude: -33.6333, longitude: 150.2833, population: 4300 },
  { name: 'Blue Mountains World Heritage Area', type: 'protected_area', latitude: -33.7500, longitude: 150.2500 },

  // Alberta Canada Zone
  { name: 'Anzac, AB', type: 'village', latitude: 56.4500, longitude: -111.0333, population: 750 },
  { name: 'Fort McMurray, AB', type: 'city', latitude: 56.7264, longitude: -111.3803, population: 68000 },
  { name: 'Gregoire Lake Provincial Park', type: 'protected_area', latitude: 56.4700, longitude: -111.1800 },

  // India - Indo-Gangetic Plains & Northern Belt
  { name: 'Chandigarh', type: 'city', latitude: 30.7333, longitude: 76.7794, population: 1100000 },
  { name: 'Ludhiana, Punjab', type: 'city', latitude: 30.9010, longitude: 75.8573, population: 1600000 },
  { name: 'Patiala, Punjab', type: 'city', latitude: 30.3398, longitude: 76.3869, population: 450000 },
  { name: 'Dehradun, Uttarakhand', type: 'city', latitude: 30.3165, longitude: 78.0322, population: 800000 },
  { name: 'Rajaji National Park', type: 'protected_area', latitude: 30.1000, longitude: 78.2000 },
  { name: 'Jim Corbett National Park', type: 'protected_area', latitude: 29.5300, longitude: 78.7747 },

  // India - Central & Western Forest Belt (Madhya Pradesh & Maharashtra)
  { name: 'Jabalpur, MP', type: 'city', latitude: 23.1815, longitude: 79.9864, population: 1250000 },
  { name: 'Mandla, MP', type: 'town', latitude: 22.5982, longitude: 80.3712, population: 70000 },
  { name: 'Kanha Tiger Reserve', type: 'protected_area', latitude: 22.3345, longitude: 80.6115 },
  { name: 'Bandhavgarh National Park', type: 'protected_area', latitude: 23.7000, longitude: 81.0300 },

  // India - Western Ghats & Southern Peninsula
  { name: 'Chamarajanagar, Karnataka', type: 'town', latitude: 11.9261, longitude: 76.9437, population: 80000 },
  { name: 'Bandipur National Park', type: 'protected_area', latitude: 11.6664, longitude: 76.6293 },
  { name: 'Wayanad Wildlife Sanctuary', type: 'protected_area', latitude: 11.6854, longitude: 76.3688 },

  // Southeast & East Asia Zones
  { name: 'Palangka Raya, Central Kalimantan', type: 'city', latitude: -2.2167, longitude: 113.9167, population: 280000 },
  { name: 'Sebangau National Park, Indonesia', type: 'protected_area', latitude: -2.3500, longitude: 113.7000 },
  { name: 'Chiang Mai, Thailand', type: 'city', latitude: 18.7883, longitude: 98.9853, population: 130000 },
  { name: 'Doi Inthanon National Park', type: 'protected_area', latitude: 18.5878, longitude: 98.4872 }
];

export function findNearestSettlement(lat: number, lon: number): SettlementProximity | undefined {
  let nearest: SettlementRecord | null = null;
  let minDistance = Infinity;

  for (const s of MONITORED_SETTLEMENTS) {
    const dist = calculateHaversineKm(lat, lon, s.latitude, s.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = s;
    }
  }

  if (!nearest) return undefined;

  return {
    name: nearest.name,
    type: nearest.type,
    distanceKm: Math.round(minDistance * 10) / 10,
    population: nearest.population
  };
}

export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0088;
  const toRad = Math.PI / 180.0;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
