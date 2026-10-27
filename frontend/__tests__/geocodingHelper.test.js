import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Setup Mock untuk window.localStorage agar AsyncStorage dapat berjalan di Node test runner
const memoryStorage = new Map();
global.window = {
  localStorage: {
    getItem: (k) => memoryStorage.get(k) || null,
    setItem: (k, v) => memoryStorage.set(k, String(v)),
    removeItem: (k) => memoryStorage.delete(k),
    clear: () => memoryStorage.clear()
  }
};

import { formatIndonesianAddress, getCacheKey, reverseGeocodeCoords } from '../utils/geocodingHelper.js';

describe('Frontend Geocoding Helper & Address Formatting Tests', () => {
  describe('formatIndonesianAddress', () => {
    it('1. formats full administrative address cleanly with comma separation', () => {
      const res = formatIndonesianAddress({
        road: 'Jl. Ahmad Yani',
        village: 'Karangkemiri',
        district: 'Maos',
        city: 'Cilacap',
        province: 'Jawa Tengah',
        country: 'Indonesia'
      });

      assert.strictEqual(
        res,
        'Jl. Ahmad Yani, Desa Karangkemiri, Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah, Indonesia'
      );
    });

    it('2. preserves existing prefixes such as Desa, Kecamatan, Kota', () => {
      const res = formatIndonesianAddress({
        road: '',
        village: 'Desa Karangkemiri',
        district: 'Kecamatan Maos',
        city: 'Kota Cilacap',
        province: 'Jawa Tengah',
        country: 'Indonesia'
      });

      assert.strictEqual(
        res,
        'Desa Karangkemiri, Kecamatan Maos, Kota Cilacap, Jawa Tengah, Indonesia'
      );
    });

    it('3. handles sparse address fields without leaving undefined or dangling commas', () => {
      const res = formatIndonesianAddress({
        road: null,
        village: null,
        district: 'Maos',
        city: 'Cilacap',
        province: 'Jawa Tengah',
        country: null
      });

      assert.strictEqual(res, 'Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah');
    });

    it('4. returns empty string if all fields are empty or null', () => {
      const res = formatIndonesianAddress({
        road: '',
        village: null,
        district: undefined,
        city: '',
        province: null,
        country: ''
      });

      assert.strictEqual(res, '');
    });
  });

  describe('getCacheKey', () => {
    it('5. returns 4-decimal precision key for spatial cache clustering', () => {
      const key = getCacheKey(-7.61875, 109.14419);
      assert.strictEqual(key, '-7.6188,109.1442');
    });

    it('6. returns null for NaN or invalid coordinates', () => {
      assert.strictEqual(getCacheKey('invalid', 109.14), null);
      assert.strictEqual(getCacheKey(null, undefined), null);
    });
  });

  describe('reverseGeocodeCoords', () => {
    it('7. returns Alamat tidak tersedia for invalid coordinates without crashing', async () => {
      const res = await reverseGeocodeCoords('invalid', 'coord');
      assert.strictEqual(res.isSuccess, false);
      assert.strictEqual(res.address, 'Alamat tidak tersedia');
    });

    it('8. caches successful lookups and reuses cache', async () => {
      // First call (with mocked global.fetch)
      const mockAddress = 'Desa Karangkemiri, Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah, Indonesia';
      const originalFetch = global.fetch;

      global.fetch = async (url) => {
        return {
          ok: true,
          json: async () => ({
            success: true,
            address: mockAddress,
            village: 'Karangkemiri',
            district: 'Maos',
            city: 'Cilacap',
            province: 'Jawa Tengah',
            country: 'Indonesia'
          })
        };
      };

      try {
        const res1 = await reverseGeocodeCoords(-7.61875, 109.14419, 'test-token');
        assert.strictEqual(res1.isSuccess, true);
        assert.strictEqual(res1.address, mockAddress);

        // Turn off fetch: second call MUST come from cache
        global.fetch = () => { throw new Error('Should not be called because of cache'); };

        const res2 = await reverseGeocodeCoords(-7.61875, 109.14419, 'test-token');
        assert.strictEqual(res2.isSuccess, true);
        assert.strictEqual(res2.address, mockAddress);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('9. falls back gracefully to Alamat tidak tersedia when network request fails', async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => {
        throw new Error('Network error / offline');
      };

      try {
        // Use unique coordinates to avoid hitting previous test cache
        const res = await reverseGeocodeCoords(-6.99999, 110.42000, 'test-token');
        assert.strictEqual(res.isSuccess, false);
        assert.strictEqual(res.address, 'Alamat tidak tersedia');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Presentation Logic for Detail Handover & Preview Foto', () => {
    it('10. verifies that GPS coordinates and real address display simultaneously', () => {
      const handover = {
        locationLat: -7.61875,
        locationLng: 109.14419,
        locationAddress: 'Desa Karangkemiri, Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah'
      };

      const gpsDisplay = `${handover.locationLat.toFixed(5)}, ${handover.locationLng.toFixed(5)}`;
      const addressDisplay = handover.locationAddress || 'Alamat belum tersedia';

      assert.strictEqual(gpsDisplay, '-7.61875, 109.14419');
      assert.strictEqual(addressDisplay, 'Desa Karangkemiri, Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah');
    });

    it('11. verifies that legacy data without address displays coordinates and fallback message', () => {
      const legacyHandover = {
        locationLat: -7.61875,
        locationLng: 109.14419,
        locationAddress: null
      };

      const gpsDisplay = `${legacyHandover.locationLat.toFixed(5)}, ${legacyHandover.locationLng.toFixed(5)}`;
      const addressDisplay = legacyHandover.locationAddress || 'Alamat belum tersedia';

      assert.strictEqual(gpsDisplay, '-7.61875, 109.14419');
      assert.strictEqual(addressDisplay, 'Alamat belum tersedia');
    });
  });
});

