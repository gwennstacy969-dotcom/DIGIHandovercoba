/**
 * geocodingService.js
 * Service for reverse geocoding coordinates (lat, lng) to administrative address components.
 * Supports Google Maps Geocoding API (if GOOGLE_GEOCODING_API_KEY is configured)
 * and fallback to OpenStreetMap Nominatim.
 */

const logger = require('../config/logger');

// In-memory cache with TTL (1 hour)
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Format rounded cache key (e.g., "-7.6188,109.1442")
 * Validates boundaries (-90..90, -180..180) and supports coordinate 0.
 */
function getCacheKey(lat, lng) {
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
 * Clean and normalize Indonesian administrative names
 * Prevents incorrectly prepending "Desa " to suburbs or urban neighbourhoods,
 * and prevents prepending "Kabupaten " to a Kota.
 */
function formatIndonesianAddress({ road, village, villageType, district, city, cityType, province, country }) {
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
      // Suburb/neighbourhood in urban area: keep as is, do NOT label as Desa
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
 * Reverse geocode using Google Maps Geocoding API
 */
async function geocodeGoogle(lat, lng, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=id`;
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) {
    throw new Error(`Google Geocoding HTTP error ${response.status}`);
  }
  const data = await response.json();
  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    return null;
  }

  const result = data.results[0];
  const components = result.address_components || [];

  let road = '';
  let village = '';
  let villageType = null;
  let district = '';
  let city = '';
  let cityType = null;
  let province = '';
  let country = 'Indonesia';

  for (const c of components) {
    const types = c.types || [];
    if (types.includes('route')) road = c.long_name;
    if (types.includes('sublocality_level_1')) {
      village = c.long_name;
      villageType = 'suburb';
    } else if (types.includes('administrative_area_level_4')) {
      village = c.long_name;
      villageType = 'village';
    }
    if (types.includes('administrative_area_level_3') || types.includes('locality')) district = c.long_name;
    if (types.includes('administrative_area_level_2')) {
      city = c.long_name;
      if (c.long_name.toLowerCase().includes('kota')) cityType = 'city';
      else if (c.long_name.toLowerCase().includes('kabupaten')) cityType = 'county';
    }
    if (types.includes('administrative_area_level_1')) province = c.long_name;
    if (types.includes('country')) country = c.long_name;
  }

  const formatted = formatIndonesianAddress({ road, village, villageType, district, city, cityType, province, country }) || result.formatted_address;

  return {
    latitude: parseFloat(lat),
    longitude: parseFloat(lng),
    address: formatted,
    road: road || null,
    village: village || null,
    district: district || null,
    city: city || null,
    province: province || null,
    country: country || null
  };
}

/**
 * Reverse geocode using OpenStreetMap Nominatim
 */
async function geocodeNominatim(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'DIGIHandoverApp/1.0 (handover-app@pertamina.com)',
      'Accept-Language': 'id,en;q=0.8'
    },
    signal: AbortSignal.timeout(4500)
  });

  if (!response.ok) {
    throw new Error(`Nominatim HTTP error ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.address) {
    return null;
  }

  const a = data.address;
  const road = a.road || a.pedestrian || a.street || '';
  const village = a.village || a.suburb || a.hamlet || a.neighbourhood || a.quarter || '';
  const villageType = a.village ? 'village' : (a.suburb || a.neighbourhood ? 'suburb' : null);
  const district = a.municipality || a.town || a.city_district || a.district || a.subdistrict || '';
  const city = a.city || a.county || a.regency || '';
  const cityType = a.city ? 'city' : (a.county || a.regency ? 'county' : null);
  const province = a.state || a.province || '';
  const country = a.country || 'Indonesia';

  const formatted = formatIndonesianAddress({ road, village, villageType, district, city, cityType, province, country }) || data.display_name;

  return {
    latitude: parseFloat(lat),
    longitude: parseFloat(lng),
    address: formatted,
    road: road || null,
    village: village || null,
    district: district || null,
    city: city || null,
    province: province || null,
    country: country || null
  };
}

/**
 * Public method: getCachedAddress
 * Synchronously returns cached address object if present and fresh, or null.
 */
function getCachedAddress(latitude, longitude) {
  const cacheKey = getCacheKey(latitude, longitude);
  if (!cacheKey) return null;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

/**
 * Public method: clearCache (for isolated testing)
 */
function clearCache() {
  cache.clear();
}

/**
 * Public method: reverseGeocode
 * Returns address object or null if failed.
 */
async function reverseGeocode(latitude, longitude) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return null;
  }

  const numLat = parseFloat(latitude);
  const numLng = parseFloat(longitude);
  if (isNaN(numLat) || isNaN(numLng)) {
    return null;
  }

  // Geographic boundaries validation
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return null;
  }

  const cacheKey = getCacheKey(numLat, numLng);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    let result = null;
    const googleKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GEOCODING_API_KEY;

    if (googleKey) {
      try {
        result = await geocodeGoogle(numLat, numLng, googleKey);
      } catch (err) {
        logger.warn(`Google geocoding error: ${err.message}. Falling back to Nominatim.`);
      }
    }

    if (!result) {
      result = await geocodeNominatim(numLat, numLng);
    }

    if (result) {
      cache.set(cacheKey, { timestamp: Date.now(), data: result });
      // Keep cache small
      if (cache.size > 2000) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
    }

    return result;
  } catch (error) {
    logger.warn(`Reverse geocoding failed for (${latitude}, ${longitude}): ${error.message}`);
    return null;
  }
}

module.exports = {
  reverseGeocode,
  getCachedAddress,
  formatIndonesianAddress,
  getCacheKey,
  clearCache
};

