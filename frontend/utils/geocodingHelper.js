import AsyncStorageRaw from '@react-native-async-storage/async-storage';
import axios from 'axios';

const AsyncStorage = AsyncStorageRaw.default || AsyncStorageRaw;

/**
 * Resolves the active backend API URL across:
 * 1. axios.defaults.baseURL (configured in config.js / loadSavedApiUrl)
 * 2. Web browser window.location (local dev, LAN IP, or production reverse proxy)
 * 3. EXPO_PUBLIC_API_URL environment variable
 * 4. Production domain fallback (https://pertamina-handover.com)
 */
export const resolveApiUrl = () => {
  if (axios.defaults?.baseURL) {
    return axios.defaults.baseURL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//localhost:3000`;
    }
    if (!port || port === '80' || port === '443') {
      return `${protocol}//${hostname}`;
    }
    return `${protocol}//${hostname}:3000`;
  }
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  return 'https://pertamina-handover.com';
};

// In-memory cache for reverse geocoding
const geoCache = new Map();

/**
 * Generates 4-decimal precision key for spatial cache clustering.
 * Validates boundaries (-90..90, -180..180) and accepts coordinate 0.
 */
export function getCacheKey(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (isNaN(numLat) || isNaN(numLng)) {
    return null;
  }
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return null;
  }
  return `${numLat.toFixed(4)},${numLng.toFixed(4)}`;
}

/**
 * Clear in-memory cache (for test isolation)
 */
export function clearGeoCache() {
  geoCache.clear();
}

/**
 * Clean and normalize Indonesian administrative names.
 * Avoids prepending "Desa " to suburbs or urban neighbourhoods,
 * and avoids prepending "Kabupaten " to a Kota.
 */
export function formatIndonesianAddress({ road, village, villageType, district, city, cityType, province, country }) {
  const parts = [];

  if (road && road.trim()) {
    parts.push(road.trim());
  }

  if (village && village.trim()) {
    const v = village.trim();
    const vLower = v.toLowerCase();
    if (vLower.startsWith('desa') || vLower.startsWith('kelurahan') || vLower.startsWith('kel.') || vLower.startsWith('rw') || vLower.startsWith('rt')) {
      parts.push(v);
    } else if (villageType === 'suburb' || villageType === 'neighbourhood') {
      // Suburb in urban city: keep name as is without forcing "Desa"
      parts.push(v);
    } else if (villageType === 'village') {
      parts.push(`Desa ${v}`);
    } else {
      parts.push(v);
    }
  }

  if (district && district.trim()) {
    const d = district.trim();
    const dLower = d.toLowerCase();
    if (dLower.startsWith('kecamatan') || dLower.startsWith('kec.')) {
      parts.push(d);
    } else {
      parts.push(`Kecamatan ${d}`);
    }
  }

  if (city && city.trim()) {
    const c = city.trim();
    const cLower = c.toLowerCase();
    if (cLower.startsWith('kabupaten') || cLower.startsWith('kab.') || cLower.startsWith('kota')) {
      parts.push(c);
    } else if (cityType === 'city') {
      parts.push(`Kota ${c}`);
    } else if (cityType === 'county') {
      parts.push(`Kabupaten ${c}`);
    } else {
      parts.push(c);
    }
  }

  if (province && province.trim()) {
    parts.push(province.trim());
  }

  if (country && country.trim()) {
    parts.push(country.trim());
  }

  return parts.join(', ');
}

/**
 * Helper to safely obtain expo-location module only in Native mobile environment
 */
let cachedLocationModule = null;
async function getExpoLocation() {
  if (cachedLocationModule !== null) return cachedLocationModule;
  try {
    const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
    if (isReactNative) {
      cachedLocationModule = await import('expo-location');
    } else {
      cachedLocationModule = false;
    }
  } catch (err) {
    cachedLocationModule = false;
  }
  return cachedLocationModule;
}

export async function reverseGeocodeCoords(latitude, longitude, authToken = null, customBaseUrl = null) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return {
      isSuccess: false,
      address: 'Alamat tidak tersedia',
      village: null,
      district: null,
      city: null,
      province: null,
      country: null
    };
  }

  const numLat = parseFloat(latitude);
  const numLng = parseFloat(longitude);
  if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return {
      isSuccess: false,
      address: 'Alamat tidak tersedia',
      village: null,
      district: null,
      city: null,
      province: null,
      country: null
    };
  }

  const cacheKey = getCacheKey(numLat, numLng);
  if (cacheKey && geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey);
  }

  // 1. On Native Mobile (Android/iOS), try Expo Location native reverse geocoder first
  try {
    const Location = await getExpoLocation();
    if (Location && typeof Location.reverseGeocodeAsync === 'function') {
      const results = await Location.reverseGeocodeAsync({
        latitude: numLat,
        longitude: numLng
      });

      if (results && results.length > 0) {
        const r = results[0];
        const road = r.street || r.name || '';
        const village = r.district || r.subregion || '';
        const villageType = r.subregion ? 'suburb' : null;
        const district = r.city || r.district || '';
        const city = r.subregion || r.city || '';
        const cityType = r.city && r.city.toLowerCase().includes('kota') ? 'city' : null;
        const province = r.region || '';
        const country = r.country || 'Indonesia';

        let formatted = formatIndonesianAddress({ road, village, villageType, district, city, cityType, province, country });
        if (!formatted && r.formattedAddress) {
          formatted = r.formattedAddress;
        }

        if (formatted) {
          const resObj = {
            isSuccess: true,
            latitude: numLat,
            longitude: numLng,
            address: formatted,
            road: road || null,
            village: village || null,
            district: district || null,
            city: city || null,
            province: province || null,
            country: country || null
          };
          geoCache.set(cacheKey, resObj);
          return resObj;
        }
      }
    }
  } catch (nativeErr) {
    // Native geocoding failed or not supported, fall through to backend API
  }

  // 2. Fallback to Backend Proxy API (works on Web, or when Native fails)
  try {
    let token = authToken;
    if (!token && AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      token = await AsyncStorage.getItem('token');
    }

    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timeoutId = null;
    if (controller) {
      timeoutId = setTimeout(() => controller.abort(), 4500);
    }

    const baseUrl = (customBaseUrl || resolveApiUrl()).replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/api/location/reverse-geocode?lat=${numLat}&lng=${numLng}`, {
      headers,
      signal: controller ? controller.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.success && data.address) {
        const resObj = {
          isSuccess: true,
          latitude: numLat,
          longitude: numLng,
          address: data.address,
          road: data.road || null,
          village: data.village || null,
          district: data.district || null,
          city: data.city || null,
          province: data.province || null,
          country: data.country || null
        };
        geoCache.set(cacheKey, resObj);
        return resObj;
      }
    }
  } catch (apiErr) {
    // API failed or offline
  }

  // 3. Fallback when geocoding is unavailable
  const fallbackObj = {
    isSuccess: false,
    latitude: numLat,
    longitude: numLng,
    address: 'Alamat tidak tersedia',
    village: null,
    district: null,
    city: null,
    province: null,
    country: null
  };
  return fallbackObj;
}

