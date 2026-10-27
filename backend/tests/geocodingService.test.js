const request = require('supertest');
const app = require('../index');
const geocodingService = require('../src/services/geocodingService');
const TokenManager = require('../src/utils/TokenManager');
const prisma = require('../src/config/prisma');

describe('Geocoding Service & Location Reverse Geocode Audit Tests', () => {
  let adminToken;
  let adminUser;
  let amtUserA;
  let amtTokenA;
  let amtUserB;
  let amtTokenB;

  beforeAll(async () => {
    const timestamp = Date.now();
    adminUser = await prisma.user.create({
      data: {
        username: `geo_admin_${timestamp}`,
        name: 'Geo Admin',
        role: 'ADMIN',
        password: 'hashed_password_test'
      }
    });
    adminToken = TokenManager.generateAccessToken(adminUser);

    amtUserA = await prisma.user.create({
      data: {
        username: `geo_amt_a_${timestamp}`,
        name: 'AMT User A',
        role: 'AMT',
        password: 'hashed_password_test'
      }
    });
    amtTokenA = TokenManager.generateAccessToken(amtUserA);

    amtUserB = await prisma.user.create({
      data: {
        username: `geo_amt_b_${timestamp}`,
        name: 'AMT User B',
        role: 'AMT',
        password: 'hashed_password_test'
      }
    });
    amtTokenB = TokenManager.generateAccessToken(amtUserB);
  });

  afterAll(async () => {
    geocodingService.clearCache();
    const ids = [adminUser?.id, amtUserA?.id, amtUserB?.id].filter(Boolean);
    if (ids.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    }
  });

  describe('1. formatIndonesianAddress Unit Tests', () => {
    it('formats rural address correctly with Desa and Kabupaten', () => {
      const formatted = geocodingService.formatIndonesianAddress({
        road: 'Jl. Raya Maos',
        village: 'Karangkemiri',
        villageType: 'village',
        district: 'Maos',
        city: 'Cilacap',
        cityType: 'county',
        province: 'Jawa Tengah',
        country: 'Indonesia'
      });

      expect(formatted).toBe('Jl. Raya Maos, Desa Karangkemiri, Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah, Indonesia');
    });

    it('does NOT prepend "Desa " to urban suburb or "Kabupaten " to a Kota', () => {
      const formatted = geocodingService.formatIndonesianAddress({
        road: 'Jl. Pahlawan',
        village: 'Kebayoran Baru',
        villageType: 'suburb',
        district: 'Kebayoran Baru',
        city: 'Semarang',
        cityType: 'city',
        province: 'Jawa Tengah',
        country: 'Indonesia'
      });

      expect(formatted).toBe('Jl. Pahlawan, Kebayoran Baru, Kecamatan Kebayoran Baru, Kota Semarang, Jawa Tengah, Indonesia');
    });

    it('handles sparse components without dangling commas', () => {
      const formatted = geocodingService.formatIndonesianAddress({
        road: null,
        village: null,
        district: 'Maos',
        city: 'Cilacap',
        province: 'Jawa Tengah',
        country: null
      });

      expect(formatted).toBe('Kecamatan Maos, Cilacap, Jawa Tengah');
    });
  });

  describe('2. getCacheKey Validation & Boundary Checks', () => {
    it('accepts coordinate 0 (Equator / Prime Meridian)', () => {
      const key = geocodingService.getCacheKey(0, 0);
      expect(key).toBe('0.0000,0.0000');
    });

    it('returns null for out-of-bounds coordinates', () => {
      expect(geocodingService.getCacheKey(91, 100)).toBeNull();
      expect(geocodingService.getCacheKey(-91, 100)).toBeNull();
      expect(geocodingService.getCacheKey(0, 181)).toBeNull();
      expect(geocodingService.getCacheKey(0, -181)).toBeNull();
    });

    it('returns null for null, undefined, or NaN inputs', () => {
      expect(geocodingService.getCacheKey(null, 100)).toBeNull();
      expect(geocodingService.getCacheKey(undefined, undefined)).toBeNull();
      expect(geocodingService.getCacheKey('invalid', 100)).toBeNull();
    });
  });

  describe('3. reverseGeocode Service Logic (Deterministic Mock Testing)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      geocodingService.clearCache();
    });

    it('returns null for out-of-bounds or invalid coordinates without making network calls', async () => {
      global.fetch = jest.fn();

      const r1 = await geocodingService.reverseGeocode(100, 200);
      const r2 = await geocodingService.reverseGeocode(null, null);

      expect(r1).toBeNull();
      expect(r2).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('deterministically reverse geocodes valid coordinates with mock provider', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          display_name: 'Karangkemiri, Maos, Cilacap, Jawa Tengah, Indonesia',
          address: {
            village: 'Karangkemiri',
            town: 'Maos',
            county: 'Cilacap',
            state: 'Jawa Tengah',
            country: 'Indonesia'
          }
        })
      });

      const result = await geocodingService.reverseGeocode(-7.61875, 109.14419);

      expect(result).not.toBeNull();
      expect(result.latitude).toBeCloseTo(-7.61875, 4);
      expect(result.longitude).toBeCloseTo(109.14419, 4);
      expect(result.village).toBe('Karangkemiri');
      expect(result.district).toBe('Maos');
      expect(result.city).toBe('Cilacap');
      expect(result.province).toBe('Jawa Tengah');
      expect(result.address).toContain('Karangkemiri');
    });

    it('handles provider HTTP 500 or network timeout gracefully without throwing', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Provider timeout / connection reset'));

      const result = await geocodingService.reverseGeocode(-7.61875, 109.14419);
      expect(result).toBeNull();
    });

    it('uses in-memory spatial cache on subsequent calls and avoids redundant network calls', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          display_name: 'Karangkemiri, Maos, Cilacap',
          address: { village: 'Karangkemiri', town: 'Maos', county: 'Cilacap' }
        })
      });

      const res1 = await geocodingService.reverseGeocode(-7.61875, 109.14419);
      const res2 = await geocodingService.reverseGeocode(-7.61875, 109.14419);

      expect(res1).toEqual(res2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. GET /api/location/reverse-geocode Endpoint Security & Validation', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(app).get('/api/location/reverse-geocode?lat=-7.61875&lng=109.14419');
      expect(res.status).toBe(401);
    });

    it('returns 400 when lat or lng is missing', async () => {
      const res = await request(app)
        .get('/api/location/reverse-geocode?lat=-7.61875')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('wajib disertakan');
    });

    it('returns 400 when coordinates contain non-numeric trailing characters (e.g. 12abc)', async () => {
      const res = await request(app)
        .get('/api/location/reverse-geocode?lat=12abc&lng=109.14')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('tidak valid');
    });

    it('returns 400 when coordinates are out of geographic boundaries (-90..90, -180..180)', async () => {
      const res = await request(app)
        .get('/api/location/reverse-geocode?lat=95&lng=109.14')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('batas geografis');
    });
  });

  describe('5. Object-Level Authorization & Side-Effect Ordering (IDOR Protection)', () => {
    let handoverBId;

    beforeAll(async () => {
      // Buat handover milik User B yang belum memiliki alamat
      const hB = await prisma.handover.create({
        data: {
          noPolisi: 'R 7777 SEC',
          shift: 'PAGI',
          status: 'Aman',
          type: 'mulai',
          userId: amtUserB.id,
          locationLat: -7.61875,
          locationLng: 109.14419,
          locationAddress: null
        }
      });
      handoverBId = hB.id;
    });

    afterAll(async () => {
      if (handoverBId) {
        await prisma.handoverItem.deleteMany({ where: { handoverId: handoverBId } }).catch(() => {});
        await prisma.photo.deleteMany({ where: { handoverId: handoverBId } }).catch(() => {});
        await prisma.handover.delete({ where: { id: handoverBId } }).catch(() => {});
      }
    });

    it('REJECTS unauthorized AMT A with 403 when requesting handover of User B BEFORE any geocoding side-effect', async () => {
      // Spy pada geocodingService.reverseGeocode
      const geoSpy = jest.spyOn(geocodingService, 'reverseGeocode');

      const res = await request(app)
        .get(`/api/handovers/${handoverBId}`)
        .set('Authorization', `Bearer ${amtTokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Akses ditolak');

      // Pastikan reverse geocode TIDAK pernah dipanggil untuk request tidak berizin
      expect(geoSpy).not.toHaveBeenCalled();

      // Pastikan database record handover B TIDAK termutasi
      const checkRecord = await prisma.handover.findUnique({ where: { id: handoverBId } });
      expect(checkRecord.locationAddress).toBeNull();

      geoSpy.mockRestore();
    });

    it('ALLOWS authorized Admin to read handover and triggers backfill safely', async () => {
      const res = await request(app)
        .get(`/api/handovers/${handoverBId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.handover.id).toBe(handoverBId);
    });
  });
});
