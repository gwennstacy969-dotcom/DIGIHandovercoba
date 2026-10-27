const request = require('supertest');
const app = require('../index');
const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');
const TokenManager = require('../src/utils/TokenManager');
const { createSessionAtomic, terminateSession } = require('../src/services/sessionService');

describe('SUPER_ADMIN, Single Active Session & RBAC Regression Test Suite', () => {
  const testId = `SAS_${Date.now().toString().slice(-6)}`;
  let superAdminUser;
  let regularAdminUser;
  let testAmtUser;

  let superAdminToken;
  let regularAdminToken;
  let amtToken;

  const rawPassword = 'PasswordTest123!';

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 1. Buat Super Admin
    superAdminUser = await prisma.user.create({
      data: {
        username: `sa_${testId}`,
        password: hashedPassword,
        name: `Super Admin ${testId}`,
        role: 'SUPER_ADMIN',
        jabatan: 'Super Admin Pusat'
      }
    });

    // 2. Buat Admin Biasa
    regularAdminUser = await prisma.user.create({
      data: {
        username: `adm_${testId}`,
        password: hashedPassword,
        name: `Regular Admin ${testId}`,
        role: 'ADMIN',
        jabatan: 'Admin Operasional'
      }
    });

    // 3. Buat AMT
    testAmtUser = await prisma.user.create({
      data: {
        username: `amt_${testId}`,
        password: hashedPassword,
        name: `AMT Driver ${testId}`,
        role: 'AMT',
        jabatan: 'Driver AMT 1'
      }
    });
  });

  afterAll(async () => {
    try {
      // Bersihkan audit logs dan users test
      await prisma.auditLog.deleteMany({
        where: {
          userId: {
            in: [superAdminUser.id, regularAdminUser.id, testAmtUser.id]
          }
        }
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: [superAdminUser.id, regularAdminUser.id, testAmtUser.id]
          }
        }
      });
    } catch (_) {}
    await prisma.$disconnect();
  });

  describe('1. Single Active Session (SAS) & Login Enforcement', () => {
    let amtSessionToken;

    test('Login pertama kali berhasil dan membuat activeSessionId', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: testAmtUser.username, password: rawPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('AMT');

      amtSessionToken = res.body.token;

      // Verifikasi database menyimpan activeSessionId
      const userInDb = await prisma.user.findUnique({ where: { id: testAmtUser.id } });
      expect(userInDb.activeSessionId).toBeTruthy();
      expect(userInDb.sessionStartedAt).toBeTruthy();
    });

    test('Login kedua kali pada akun yang sedang aktif ditolak dengan HTTP 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: testAmtUser.username, password: rawPassword });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/sedang digunakan pada perangkat lain/i);
    });

    test('Logout mengakhiri sesi aktif di database', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${amtSessionToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const userInDb = await prisma.user.findUnique({ where: { id: testAmtUser.id } });
      expect(userInDb.activeSessionId).toBeNull();
    });

    test('Setelah logout, login kembali dapat dilakukan dengan sukses', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: testAmtUser.username, password: rawPassword });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();

      // Bersihkan sesi
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${res.body.token}`)
        .send();
    });
  });

  describe('2. Role-Based Access Control (RBAC): SUPER_ADMIN vs ADMIN', () => {
    let saToken;
    let admToken;

    beforeAll(async () => {
      // Login SA
      const saLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: superAdminUser.username, password: rawPassword });
      saToken = saLogin.body.token;

      // Login Admin
      const admLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: regularAdminUser.username, password: rawPassword });
      admToken = admLogin.body.token;
    });

    afterAll(async () => {
      if (saToken) {
        await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${saToken}`).send();
      }
      if (admToken) {
        await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${admToken}`).send();
      }
    });

    test('Admin biasa DILARANG membuat akun Admin baru (HTTP 403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/admins')
        .set('Authorization', `Bearer ${admToken}`)
        .send({
          username: `unauthorized_adm_${testId}`,
          password: 'Password123!',
          name: 'Unauthorized Admin',
          role: 'ADMIN'
        });

      expect(res.status).toBe(403);
    });

    test('Admin biasa DILARANG mengakses Audit Logs (HTTP 403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${admToken}`);

      expect(res.status).toBe(403);
    });

    test('Admin biasa DILARANG melihat sesi aktif (HTTP 403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/admins/sessions/active')
        .set('Authorization', `Bearer ${admToken}`);

      expect(res.status).toBe(403);
    });

    test('Super Admin BERHAK melihat Audit Logs (HTTP 200 OK)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${saToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });

    test('Super Admin BERHAK melihat daftar sesi aktif (HTTP 200 OK)', async () => {
      const res = await request(app)
        .get('/api/admins/sessions/active')
        .set('Authorization', `Bearer ${saToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.activeSessions)).toBe(true);
    });

    test('Super Admin BERHAK membuat Admin baru', async () => {
      const newAdminUsername = `created_adm_${testId}`;
      const res = await request(app)
        .post('/api/admins')
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          username: newAdminUsername,
          password: 'PasswordBaru123!',
          name: 'Admin Dibuat SuperAdmin',
          role: 'ADMIN',
          jabatan: 'Koordinator Lapangan'
        });

      expect(res.status).toBe(201);
      const created = res.body.admin || res.body;
      expect(created.username).toBe(newAdminUsername);

      // Bersihkan
      await prisma.user.deleteMany({ where: { username: newAdminUsername } });
    });
  });

  describe('3. Super Admin Session Revocation', () => {
    let saToken;
    let targetAmtToken;

    beforeAll(async () => {
      const saLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: superAdminUser.username, password: rawPassword });
      saToken = saLogin.body.token;

      const amtLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: testAmtUser.username, password: rawPassword });
      targetAmtToken = amtLogin.body.token;
    });

    afterAll(async () => {
      if (saToken) {
        await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${saToken}`).send();
      }
    });

    test('Super Admin mencabut sesi user target dengan alasan wajib', async () => {
      const res = await request(app)
        .post(`/api/admins/sessions/${testAmtUser.id}/revoke`)
        .set('Authorization', `Bearer ${saToken}`)
        .send({ reason: 'Investigasi insiden keamanan' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Pastikan tercatat di database AuditLog
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          action: 'REVOKE_USER_SESSION',
          userId: superAdminUser.id
        },
        orderBy: { createdAt: 'desc' }
      });
      expect(auditEntry).toBeTruthy();
      expect(auditEntry.details).toContain('Investigasi insiden keamanan');
    });

    test('User yang sesinya telah dicabut langsung ditolak dengan HTTP 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/api/auth/session/status')
        .set('Authorization', `Bearer ${targetAmtToken}`);

      expect(res.status).toBe(401);
      expect(res.body.isSessionExpired).toBe(true);
      expect(res.body.error).toMatch(/telah dicabut/i);
    });
  });

  describe('4. Status Kendaraan: Manual Maintenance Preservation', () => {
    const testNopol = `B ${testId} MM`;
    const testBarcode = `BARCODE_${testId}_MM`;
    let saToken;

    beforeAll(async () => {
      const saLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: superAdminUser.username, password: rawPassword });
      saToken = saLogin.body.token;

      await prisma.vehicle.create({
        data: {
          noPolisi: testNopol,
          barcode: testBarcode,
          jenisKendaraan: 'Tangki 16 KL',
          kapasitas: 16000,
          status: 'READY_TO_START',
          isManualMaintenance: false
        }
      });
    });

    afterAll(async () => {
      await prisma.vehicle.deleteMany({ where: { noPolisi: testNopol } });
      if (saToken) {
        await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${saToken}`).send();
      }
    });

    test('Admin/Super Admin mengatur Maintenance manual pada kendaraan', async () => {
      const res = await request(app)
        .put(`/api/vehicles/${testNopol}/status`)
        .set('Authorization', `Bearer ${saToken}`)
        .send({ status: 'Maintenance', reason: 'Jadwal Servis Berkala Rem' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('Maintenance');
      expect(res.body.isManualMaintenance).toBe(true);
    });

    test('Kendaraan dalam Manual Maintenance menolak Mulai Pekerjaan (HTTP 409)', async () => {
      const res = await request(app)
        .post('/api/handovers')
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          noPolisi: testNopol,
          type: 'mulai',
          shift: 'Pagi',
          locationLat: -6.2,
          locationLng: 106.8,
          items: '[]'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Maintenance/i);
    });
  });
  describe('5. Patch Q: Administrator Role Management, Instant Logout, & API Contract', () => {
    let saToken;
    let createdAdminId;
    let createdSuperAdminId;

    beforeAll(async () => {
      // Clear any previous session and login as superAdminUser
      await prisma.user.update({
        where: { id: superAdminUser.id },
        data: { activeSessionId: null, sessionStartedAt: null, sessionLastActivityAt: null, sessionExpiresAt: null }
      });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: superAdminUser.username, password: rawPassword });
      saToken = loginRes.body.token;
    });

    afterAll(async () => {
      if (saToken) {
        await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${saToken}`).send();
      }
      if (createdAdminId) {
        await prisma.user.deleteMany({ where: { id: createdAdminId } });
      }
      if (createdSuperAdminId) {
        await prisma.user.deleteMany({ where: { id: createdSuperAdminId } });
      }
    });

    test('Super Admin dapat membuat akun baru dengan role ADMIN', async () => {
      const res = await request(app)
        .post('/api/admins')
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          name: `New Admin ${testId}`,
          username: `new_adm_${testId}`,
          password: 'Password123!',
          role: 'ADMIN',
          jabatan: 'Admin Operasional'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.admin.role).toBe('ADMIN');
      createdAdminId = res.body.admin.id;
    });

    test('Super Admin dapat membuat akun baru dengan role SUPER_ADMIN', async () => {
      const res = await request(app)
        .post('/api/admins')
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          name: `New Super Admin ${testId}`,
          username: `new_sa_${testId}`,
          password: 'PasswordSuper123!',
          role: 'SUPER_ADMIN',
          jabatan: 'Super Admin Regional'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.admin.role).toBe('SUPER_ADMIN');
      createdSuperAdminId = res.body.admin.id;
    });

    test('Super Admin dapat mempromosikan ADMIN menjadi SUPER_ADMIN via PUT /api/admins/:id', async () => {
      const res = await request(app)
        .put(`/api/admins/${createdAdminId}`)
        .set('Authorization', `Bearer ${saToken}`)
        .send({ role: 'SUPER_ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.admin.role).toBe('SUPER_ADMIN');
    });

    test('Menolak pembuatan admin baru tanpa password (tidak ada default hard-coded admin123)', async () => {
      const res = await request(app)
        .post('/api/admins')
        .set('Authorization', `Bearer ${saToken}`)
        .send({
          name: 'No Pass Admin',
          username: `nopass_${testId}`,
          password: '',
          role: 'ADMIN'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/password/i);
    });

    test('Logout manual seketika melepas sesi server sehingga perangkat lain langsung bisa login', async () => {
      // 1. Login user
      const userRes1 = await request(app)
        .post('/api/auth/login')
        .send({ username: `new_sa_${testId}`, password: 'PasswordSuper123!' });
      expect(userRes1.status).toBe(200);
      const userToken = userRes1.body.token;

      // 2. Login perangkat kedua ditolak 409
      const userResConflict = await request(app)
        .post('/api/auth/login')
        .send({ username: `new_sa_${testId}`, password: 'PasswordSuper123!' });
      expect(userResConflict.status).toBe(409);

      // 3. User melakukan logout dari perangkat pertama
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .send();
      expect(logoutRes.status).toBe(200);

      // 4. Perangkat kedua langsung berhasil login tanpa menunggu idle timeout
      const userRes2 = await request(app)
        .post('/api/auth/login')
        .send({ username: `new_sa_${testId}`, password: 'PasswordSuper123!' });
      expect(userRes2.status).toBe(200);
      expect(userRes2.body.success).toBe(true);

      // Cleanup
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userRes2.body.token}`)
        .send();
    });

    test('Kontrak API GET /api/auth/session/status mengembalikan field level teratas dan objek session', async () => {
      const res = await request(app)
        .get('/api/auth/session/status')
        .set('Authorization', `Bearer ${saToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Top-level properties
      expect(res.body.remainingIdleMs).toBeDefined();
      expect(res.body.remainingAbsoluteMs).toBeDefined();
      expect(res.body.idleTimeoutMs).toBeDefined();
      // Session object contract for SessionManager.js
      expect(res.body.session).toBeDefined();
      expect(res.body.session.remainingIdleSeconds).toBeDefined();
      expect(res.body.session.remainingAbsoluteSeconds).toBeDefined();
      expect(res.body.session.isExpired).toBe(false);
    });
  });

  describe('6. Patch R: SAS Race Condition, Secret Safety & Login Brute Force Lockout', () => {
    let raceUser;
    const raceUsername = `race_${testId}`;
    const racePassword = 'RacePassword123!';

    beforeAll(async () => {
      const hashed = await bcrypt.hash(racePassword, 10);
      raceUser = await prisma.user.create({
        data: {
          username: raceUsername,
          password: hashed,
          name: `Race User ${testId}`,
          role: 'ADMIN',
          jabatan: 'Admin Race Tester'
        }
      });
    });

    afterAll(async () => {
      if (raceUser) {
        await prisma.loginAttempt.deleteMany({ where: { normalizedUsername: raceUsername } });
        await prisma.user.deleteMany({ where: { id: raceUser.id } });
      }
    });

    test('1. Dua login simultan pada akun tanpa sesi: tepat satu 200 dan satu 409', async () => {
      // Pastikan akun bersih tanpa sesi
      await prisma.user.update({
        where: { id: raceUser.id },
        data: { activeSessionId: null, sessionStartedAt: null, sessionLastActivityAt: null, sessionExpiresAt: null }
      });

      // Jalankan 2 request login secara bersamaan
      const [res1, res2] = await Promise.all([
        request(app).post('/api/auth/login').send({ username: raceUsername, password: racePassword }),
        request(app).post('/api/auth/login').send({ username: raceUsername, password: racePassword })
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const successRes = res1.status === 200 ? res1 : res2;
      const conflictRes = res1.status === 409 ? res1 : res2;

      expect(successRes.body.success).toBe(true);
      expect(conflictRes.body.error).toMatch(/perangkat lain/i);

      // Bersihkan sesi untuk tes berikutnya
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${successRes.body.token}`)
        .send();
    });

    test('2. Sesi S1 kedaluwarsa bersamaan dengan login baru S2: penghentian S1 tidak boleh menghapus S2', async () => {
      const s1Id = 'dummy-s1-expired-id';
      const s2Id = 'dummy-s2-active-id';

      // Set user memiliki sesi S2 aktif
      await prisma.user.update({
        where: { id: raceUser.id },
        data: {
          activeSessionId: s2Id,
          sessionStartedAt: new Date(),
          sessionLastActivityAt: new Date(),
          sessionExpiresAt: new Date(Date.now() + 3600000)
        }
      });

      // Panggil terminateSession dengan expectedSessionId S1 (sesi lama yang kedaluwarsa)
      await terminateSession(raceUser.id, s1Id, prisma);

      // Verifikasi S2 tetap aktif dan TIDAK terhapus
      const userAfterS1Terminate = await prisma.user.findUnique({ where: { id: raceUser.id } });
      expect(userAfterS1Terminate.activeSessionId).toBe(s2Id);
    });

    test('3. Request logout dari token/sesi lama tidak boleh mencabut sesi baru', async () => {
      // 1. Simulasikan S1
      const oldSessionId = 'old-session-id-123';
      const oldToken = TokenManager.generateAccessToken(raceUser, oldSessionId);

      // 2. Akun sudah memiliki sesi baru S2 di database
      const newSessionId = 'new-session-id-456';
      await prisma.user.update({
        where: { id: raceUser.id },
        data: {
          activeSessionId: newSessionId,
          sessionStartedAt: new Date(),
          sessionLastActivityAt: new Date(),
          sessionExpiresAt: new Date(Date.now() + 3600000)
        }
      });

      // 3. Request logout lama dengan oldToken
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${oldToken}`)
        .send();

      // Request lama dengan token mismatch ditolak oleh authMiddleware (401)
      expect(logoutRes.status).toBe(401);

      // Database harus tetap memiliki sesi baru S2 utuh
      const userCheck = await prisma.user.findUnique({ where: { id: raceUser.id } });
      expect(userCheck.activeSessionId).toBe(newSessionId);
    });

    test('4. Revoke Super Admin seketika menolak access token & refresh token sesi target', async () => {
      // Pastikan akun bersih sebelum login
      await prisma.user.update({
        where: { id: raceUser.id },
        data: { activeSessionId: null, sessionStartedAt: null, sessionLastActivityAt: null, sessionExpiresAt: null }
      });

      // 1. Target user login
      const targetLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: raceUsername, password: racePassword });

      expect(targetLogin.status).toBe(200);
      const targetToken = targetLogin.body.token;
      const targetRefreshToken = targetLogin.body.refreshToken;

      // 2. Super Admin mencabut sesi target user
      const saAuthToken = TokenManager.generateAccessToken(superAdminUser);
      const revokeRes = await request(app)
        .post(`/api/admins/sessions/${raceUser.id}/revoke`)
        .set('Authorization', `Bearer ${saAuthToken}`)
        .send({
          reason: 'Pemeriksaan keamanan darurat'
        });

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.success).toBe(true);

      // 3. Access token target seketika ditolak 401
      const accessRes = await request(app)
        .get('/api/auth/session/status')
        .set('Authorization', `Bearer ${targetToken}`);

      expect(accessRes.status).toBe(401);

      // 4. Refresh token target seketika ditolak 401/403
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: targetRefreshToken });

      expect([401, 403]).toContain(refreshRes.status);
    });

    test('5. Idle timeout role dan absolute timeout 8 jam ditegakkan server-side', async () => {
      const expiredSessionId = 'expired-session-id';

      // Skenario A: Idle Timeout terlampaui (> 15 menit untuk ADMIN)
      const pastIdleTime = new Date(Date.now() - (20 * 60 * 1000));
      await prisma.user.update({
        where: { id: raceUser.id },
        data: {
          activeSessionId: expiredSessionId,
          sessionStartedAt: pastIdleTime,
          sessionLastActivityAt: pastIdleTime,
          sessionExpiresAt: new Date(Date.now() + 3600000)
        }
      });

      const idleToken = TokenManager.generateAccessToken(raceUser, expiredSessionId);
      const idleRes = await request(app)
        .get('/api/auth/session/status')
        .set('Authorization', `Bearer ${idleToken}`);

      expect(idleRes.status).toBe(401);
      expect(idleRes.body.error).toMatch(/tidak ada aktivitas|berakhir/i);

      // Skenario B: Absolute Timeout 8 jam terlampaui
      const pastAbsoluteExpiry = new Date(Date.now() - 1000);
      await prisma.user.update({
        where: { id: raceUser.id },
        data: {
          activeSessionId: expiredSessionId,
          sessionStartedAt: new Date(Date.now() - (9 * 3600 * 1000)),
          sessionLastActivityAt: new Date(),
          sessionExpiresAt: pastAbsoluteExpiry
        }
      });

      const absToken = TokenManager.generateAccessToken(raceUser, expiredSessionId);
      const absRes = await request(app)
        .get('/api/auth/session/status')
        .set('Authorization', `Bearer ${absToken}`);

      expect(absRes.status).toBe(401);
      expect(absRes.body.error).toMatch(/8 jam|berakhir/i);
    });

    test('6. Proteksi brute force: 5 kali gagal login memicu lockout sementara (HTTP 429)', async () => {
      // Bersihkan login attempts sebelumnya
      await prisma.loginAttempt.deleteMany({ where: { normalizedUsername: raceUsername } });

      // Lakukan 4 kali percobaan salah -> status 401
      for (let i = 1; i <= 4; i++) {
        const failRes = await request(app)
          .post('/api/auth/login')
          .send({ username: raceUsername, password: 'WrongPassword!' });
        expect(failRes.status).toBe(401);
        expect(failRes.body.failedAttempts).toBe(i);
      }

      // Percobaan ke-5 -> memicu lockout HTTP 429
      const lockRes = await request(app)
        .post('/api/auth/login')
        .send({ username: raceUsername, password: 'WrongPassword!' });

      expect(lockRes.status).toBe(429);
      expect(lockRes.body.isLockedOut).toBe(true);
      expect(lockRes.body.error).toMatch(/ditangguhkan sementara|5 menit/i);

      // Percobaan ke-6 walaupun password benar tetap diblokir selama lockout
      const blockedRes = await request(app)
        .post('/api/auth/login')
        .send({ username: raceUsername, password: racePassword });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.isLockedOut).toBe(true);

      // Cleanup lockout
      await prisma.loginAttempt.deleteMany({ where: { normalizedUsername: raceUsername } });
    });

    test('7. Keamanan secret: gagal startup pada runtime non-test jika JWT_SECRET hilang', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.JWT_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;

        expect(() => {
          TokenManager.getJwtSecret();
        }).toThrow(/FATAL SECURITY ERROR: JWT_SECRET environment variable is missing/i);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSecret) process.env.JWT_SECRET = origSecret;
      }
    });
  });
});
