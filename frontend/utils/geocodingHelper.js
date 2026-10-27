import AsyncStorageRaw from '@react-native-async-storage/async-storage';

const AsyncStorage = AsyncStorageRaw.default || AsyncStorageRaw;

const getApiUrl = () => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'http://localhost:3000';
};

// In-memory cache for reverse geocoding
const geoCache = new Map();

export function getCacheKey(lat, lng) {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (isNaN(numLat) || isNaN(numLng)) return null;
  return `${numLat.toFixed(4)},${numLng.toFixed(4)}`;
}

export function formatIndonesianAddress({ road, village, district, city, province, country }) {
  const parts = [];

  if (road && road.trim()) {
    parts.push(road.trim());
  }

  if (village && village.trim()) {
    const v = village.trim();
    if (!v.toLowerCase().startsWith('desa') && !v.toLowerCase().startsWith('kelurahan') && !v.toLowerCase().startsWith('kel.')) {
      parts.push(`Desa ${v}`);
    } else {
      parts.push(v);
    }
  }

  if (district && district.trim()) {
    const d = district.trim();
    if (!d.toLowerCase().startsWith('kecamatan') && !d.toLowerCase().startsWith('kec.')) {
      parts.push(`Kecamatan ${d}`);
    } else {
      parts.push(d);
    }
  }

  if (city && city.trim()) {
    const c = city.trim();
    if (!c.toLowerCase().startsWith('kabupaten') && !c.toLowerCase().startsWith('kab.') && !c.toLowerCase().startsWith('kota')) {
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

export async function reverseGeocodeCoords(latitude, longitude, authToken = null) {
  const numLat = parseFloat(latitude);
  const numLng = parseFloat(longitude);
  if (isNaN(numLat) || isNaN(numLng)) {
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
        const district = r.city || r.district || '';
        const city = r.subregion || r.city || '';
        const province = r.region || '';
        const country = r.country || 'Indonesia';

        let formatted = formatIndonesianAddress({ road, village, district, city, province, country });
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

    const baseUrl = getApiUrl();
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
