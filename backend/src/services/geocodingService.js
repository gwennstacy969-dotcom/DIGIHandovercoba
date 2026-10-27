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
 */
function getCacheKey(lat, lng) {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  return `${numLat.toFixed(4)},${numLng.toFixed(4)}`;
}

/**
 * Clean and normalize Indonesian administrative names
 */
function formatIndonesianAddress({ road, village, district, city, province, country }) {
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
  let district = '';
  let city = '';
  let province = '';
  let country = 'Indonesia';

  for (const c of components) {
    const types = c.types || [];
    if (types.includes('route')) road = c.long_name;
    if (types.includes('administrative_area_level_4') || types.includes('sublocality_level_1')) village = c.long_name;
    if (types.includes('administrative_area_level_3') || types.includes('locality')) district = c.long_name;
    if (types.includes('administrative_area_level_2')) city = c.long_name;
    if (types.includes('administrative_area_level_1')) province = c.long_name;
    if (types.includes('country')) country = c.long_name;
  }

  const formatted = formatIndonesianAddress({ road, village, district, city, province, country }) || result.formatted_address;

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
  const district = a.municipality || a.town || a.city_district || a.district || a.subdistrict || '';
  const city = a.county || a.city || a.regency || '';
  const province = a.state || a.province || '';
  const country = a.country || 'Indonesia';

  const formatted = formatIndonesianAddress({ road, village, district, city, province, country }) || data.display_name;

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
  formatIndonesianAddress,
  getCacheKey
};

