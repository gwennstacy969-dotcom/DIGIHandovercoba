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
});
