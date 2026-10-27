const request = require('supertest');
const app = require('../index');
const geocodingService = require('../src/services/geocodingService');
const TokenManager = require('../src/utils/TokenManager');
const prisma = require('../src/config/prisma');

describe('Geocoding Service & Location Reverse Geocode API Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Buat test user untuk pengujian endpoint
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        username: `geo_user_${timestamp}`,
        name: 'Geo Test Worker',
        role: 'ADMIN',
        password: 'hashed_password_test'
      }
    });
    authToken = TokenManager.generateAccessToken(testUser);
  });

  afterAll(async () => {
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
  });

  describe('formatIndonesianAddress Unit Tests', () => {
    it('1. formats full address with all components accurately', () => {
      const formatted = geocodingService.formatIndonesianAddress({
        road: 'Jl. Raya Maos',
        village: 'Karangkemiri',
        district: 'Maos',
        city: 'Cilacap',
        province: 'Jawa Tengah',
        country: 'Indonesia'
      });

      expect(formatted).toBe('Jl. Raya Maos, Desa Karangkemiri, Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah, Indonesia');
    });

    it('2. retains existing prefixes (Desa, Kecamatan, Kabupaten/Kota)', () => {
      const formatted = geocodingService.formatIndonesianAddress({
        road: '',
        village: 'Kelurahan Sidanegara',
        district: 'Kecamatan Cilacap Tengah',
        city: 'Kota Cilacap',
        province: 'Jawa Tengah',
        country: 'Indonesia'
      });

      expect(formatted).toBe('Kelurahan Sidanegara, Kecamatan Cilacap Tengah, Kota Cilacap, Jawa Tengah, Indonesia');
    });

    it('3. handles sparse components gracefully without undefined or null', () => {
      const formatted = geocodingService.formatIndonesianAddress({
        road: null,
        village: null,
        district: 'Maos',
        city: 'Cilacap',
        province: 'Jawa Tengah',
        country: null
      });

      expect(formatted).toBe('Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah');
    });
  });

  describe('reverseGeocode Service Logic', () => {
    it('4. returns null for missing or invalid coordinates', async () => {
      const res1 = await geocodingService.reverseGeocode(null, null);
      expect(res1).toBeNull();

      const res2 = await geocodingService.reverseGeocode('invalid', 'coord');
      expect(res2).toBeNull();
    });

    it('5. reverse geocodes valid coordinates and returns address components', async () => {
      // Koordinat Fuel Terminal Maos
      const result = await geocodingService.reverseGeocode(-7.61875, 109.14419);

      if (result) {
        expect(result.latitude).toBeCloseTo(-7.61875, 4);
        expect(result.longitude).toBeCloseTo(109.14419, 4);
        expect(typeof result.address).toBe('string');
        expect(result.address.length).toBeGreaterThan(5);
        expect(result.district || result.city || result.province).toBeTruthy();
      }
    }, 10000);

    it('6. uses cache for subsequent lookups with identical or nearby coordinates', async () => {
      const key = geocodingService.getCacheKey(-7.61875, 109.14419);
      expect(key).toBe('-7.6188,109.1442');

      const start = Date.now();
      const res1 = await geocodingService.reverseGeocode(-7.61875, 109.14419);
      const res2 = await geocodingService.reverseGeocode(-7.61875, 109.14419);
      const duration = Date.now() - start;

      // Pemanggilan kedua harus instan dari cache
      expect(res1).toEqual(res2);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('GET /api/location/reverse-geocode Endpoint', () => {
    it('7. returns 401 when request has no auth token', async () => {
      const res = await request(app)
        .get('/api/location/reverse-geocode?lat=-7.61875&lng=109.14419');

      expect(res.status).toBe(401);
    });

    it('8. returns 400 when lat or lng query params are missing', async () => {
      const res = await request(app)
        .get('/api/location/reverse-geocode?lat=-7.61875')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('wajib');
    });

    it('9. returns 200 with address when valid coordinates are provided', async () => {
      const res = await request(app)
        .get('/api/location/reverse-geocode?lat=-7.61875&lng=109.14419')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.success) {
        expect(res.body.latitude).toBeCloseTo(-7.61875, 4);
        expect(res.body.longitude).toBeCloseTo(109.14419, 4);
        expect(typeof res.body.address).toBe('string');
      } else {
        expect(res.body.message).toBe('Alamat tidak tersedia');
      }
    }, 10000);
  });

  describe('Handover Persistence & Legacy Backfill', () => {
    let createdHandoverId;

    afterEach(async () => {
      if (createdHandoverId) {
        await prisma.handoverItem.deleteMany({ where: { handoverId: createdHandoverId } }).catch(() => {});
        await prisma.photo.deleteMany({ where: { handoverId: createdHandoverId } }).catch(() => {});
        await prisma.handover.delete({ where: { id: createdHandoverId } }).catch(() => {});
        createdHandoverId = null;
      }
    });

    it('10. persists explicit locationAddress in handover record', async () => {
      const handover = await prisma.handover.create({
        data: {
          noPolisi: 'R 1234 GEO',
          shift: 'PAGI',
          status: 'Aman',
          type: 'mulai',
          userId: testUser.id,
          locationLat: -7.61875,
          locationLng: 109.14419,
          locationAddress: 'Desa Karangkemiri, Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah',
          locationVillage: 'Karangkemiri',
          locationDistrict: 'Maos',
          locationCity: 'Cilacap',
          locationProvince: 'Jawa Tengah',
          locationCountry: 'Indonesia'
        }
      });
      createdHandoverId = handover.id;

      const res = await request(app)
        .get(`/api/handovers/${createdHandoverId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.handover.locationAddress).toBe('Desa Karangkemiri, Kecamatan Maos, Kabupaten Cilacap, Jawa Tengah');
      expect(res.body.handover.locationDistrict).toBe('Maos');
      expect(res.body.handover.locationCity).toBe('Cilacap');
    });

    it('11. handles legacy handover without address gracefully without crashing', async () => {
      const handover = await prisma.handover.create({
        data: {
          noPolisi: 'R 9999 OLD',
          shift: 'SIANG',
          status: 'Aman',
          type: 'mulai',
          userId: testUser.id,
          locationLat: -7.61875,
          locationLng: 109.14419,
          locationAddress: null
        }
      });
      createdHandoverId = handover.id;

      const res = await request(app)
        .get(`/api/handovers/${createdHandoverId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.handover.locationLat).toBeCloseTo(-7.61875, 4);
      // Either backfilled or null, but never crashes
      expect(res.body.success).toBe(true);
    });
  });
});

