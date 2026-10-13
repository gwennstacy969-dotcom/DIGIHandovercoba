const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../index');
const prisma = require('../src/config/prisma');
const TokenManager = require('../src/utils/TokenManager');

describe('Auth & Password Reset Logic Tests', () => {
  let testUser;
  let otherUser;
  let adminUser;
  let adminToken;
  const testPassword = 'CorrectPassword123!';
  const wrongPassword = 'WrongPassword456!';
  const usernameA = `test_auth_user_a_${Date.now()}`;
  const usernameB = `test_auth_user_b_${Date.now()}`;
  const adminUsername = `test_admin_auth_${Date.now()}`;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Buat User A
    testUser = await prisma.user.create({
      data: {
        username: usernameA,
        password: hashedPassword,
        name: 'Test Auth User A',
        role: 'AMT',
        jabatan: 'Driver AMT'
      }
    });

    // Buat User B
    otherUser = await prisma.user.create({
      data: {
        username: usernameB,
        password: hashedPassword,
        name: 'Test Auth User B',
        role: 'AMT',
        jabatan: 'Driver AMT'
      }
    });

    // Buat Admin
    adminUser = await prisma.user.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        name: 'Admin Tester',
        role: 'ADMIN',
        jabatan: 'Admin Operasional'
      }
    });

    adminToken = TokenManager.generateAccessToken(adminUser);
  });

  afterAll(async () => {
    // Cleanup login attempts
    await prisma.loginAttempt.deleteMany({
      where: {
        normalizedUsername: { in: [usernameA.toLowerCase(), usernameB.toLowerCase(), adminUsername.toLowerCase()] }
      }
    });

    // Cleanup notifications
    await prisma.notification.deleteMany({
      where: {
        message: { contains: usernameA }
      }
    });

    // Cleanup password reset requests
    await prisma.passwordResetRequest.deleteMany({
      where: {
        userId: { in: [testUser.id, otherUser.id, adminUser.id] }
      }
    });

    // Cleanup users
    await prisma.user.deleteMany({
      where: {
        id: { in: [testUser.id, otherUser.id, adminUser.id] }
      }
    });

    await prisma.$disconnect();
  });

  // =========================================================================
  // Skenario A: Percobaan pertama dan kedua salah -> pesan generik, no countdown/lockout
  // =========================================================================
  it('A. Attempt 1 and 2 with wrong password return 401, failedAttempts 1 & 2, showForgotPasswordPrompt false', async () => {
    // Percobaan 1
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({ username: usernameA, password: wrongPassword });

    expect(res1.status).toBe(401);
    expect(res1.body.error).toBe('Username atau password salah');
    expect(res1.body.failedAttempts).toBe(1);
    expect(res1.body.showForgotPasswordPrompt).toBe(false);

    // Percobaan 2
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ username: usernameA, password: wrongPassword });

    expect(res2.status).toBe(401);
    expect(res2.body.error).toBe('Username atau password salah');
    expect(res2.body.failedAttempts).toBe(2);
    expect(res2.body.showForgotPasswordPrompt).toBe(false);
  });

  // =========================================================================
  // Skenario B: Percobaan ketiga berturut-turut salah -> showForgotPasswordPrompt: true
  // =========================================================================
  it('B. 3rd consecutive failed attempt returns failedAttempts: 3 and showForgotPasswordPrompt: true', async () => {
    const res3 = await request(app)
      .post('/api/auth/login')
      .send({ username: usernameA, password: wrongPassword });

    expect(res3.status).toBe(401);
    expect(res3.body.error).toBe('Username atau password salah');
    expect(res3.body.failedAttempts).toBe(3);
    expect(res3.body.showForgotPasswordPrompt).toBe(true);
  });

  // =========================================================================
  // Skenario C: Percobaan keempat tetap diizinkan tanpa pemblokiran 15 menit
  // =========================================================================
  it('C. 4th attempt is still processed without 15-minute lockout or 429 error', async () => {
    const res4 = await request(app)
      .post('/api/auth/login')
      .send({ username: usernameA, password: wrongPassword });

    expect(res4.status).toBe(401);
    expect(res4.body.error).toBe('Username atau password salah');
    expect(res4.body.failedAttempts).toBe(4);
    expect(res4.body.showForgotPasswordPrompt).toBe(true);
    // Pastikan tidak ada pesan lockout 15 menit
    expect(JSON.stringify(res4.body)).not.toContain('15 menit');
  });

  // =========================================================================
  // Skenario D: Login berhasil setelah kesalahan -> reset counter ke 0
  // =========================================================================
  it('D. Successful login resets failed attempts counter for that user', async () => {
    const successRes = await request(app)
      .post('/api/auth/login')
      .send({ username: usernameA, password: testPassword });

    expect(successRes.status).toBe(200);
    expect(successRes.body.token).toBeDefined();
    expect(successRes.body.user.username).toBe(usernameA);

    // Cek di DB bahwa loginAttempt sudah di-reset/dihapus
    const attemptRecord = await prisma.loginAttempt.findUnique({
      where: { normalizedUsername: usernameA.toLowerCase() }
    });
    expect(attemptRecord).toBeNull();
  });

  // =========================================================================
  // Skenario E: Input kosong atau salah validasi tidak menambah counter kegagalan
  // =========================================================================
  it('E. Empty fields return 400 and do not increment credential failure counter', async () => {
    const emptyRes = await request(app)
      .post('/api/auth/login')
      .send({ username: '', password: '' });

    expect(emptyRes.status).toBe(400);

    const attemptRecord = await prisma.loginAttempt.findUnique({
      where: { normalizedUsername: usernameA.toLowerCase() }
    });
    // Record tetap tidak ada / tidak bertambah
    expect(attemptRecord).toBeNull();
  });

  // =========================================================================
  // Skenario F: Mengganti username tidak menimbulkan penghitung lintas akun yang keliru
  // =========================================================================
  it('F. Changing username tracks attempts independently per user without cross-contamination', async () => {
    // User B mencoba salah 1 kali
    const resUserB = await request(app)
      .post('/api/auth/login')
      .send({ username: usernameB, password: wrongPassword });

    expect(resUserB.status).toBe(401);
    expect(resUserB.body.failedAttempts).toBe(1);
    expect(resUserB.body.showForgotPasswordPrompt).toBe(false);

    // User A mencoba salah 1 kali lagi (setelah sebelumnya di-reset)
    const resUserA = await request(app)
      .post('/api/auth/login')
      .send({ username: usernameA, password: wrongPassword });

    expect(resUserA.status).toBe(401);
    expect(resUserA.body.failedAttempts).toBe(1);
    expect(resUserA.body.showForgotPasswordPrompt).toBe(false);
  });

  // =========================================================================
  // Skenario I: Permintaan reset password menghasilkan 1 record PENDING & 1 notifikasi Admin
  // =========================================================================
  let createdRequestId;
  it('I. Submitting password reset request creates 1 PENDING request and 1 in-app Admin notification', async () => {
    const res = await request(app)
      .post('/api/password-reset/request')
      .send({
        username: usernameA,
        reason: 'Lupa password setelah salah input 3x'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.requestId).toBeDefined();
    createdRequestId = res.body.requestId;

    // Verifikasi di database
    const reqDb = await prisma.passwordResetRequest.findUnique({
      where: { id: createdRequestId }
    });
    expect(reqDb).not.toBeNull();
    expect(reqDb.status).toBe('PENDING');
    expect(reqDb.userId).toBe(testUser.id);

    // Verifikasi notifikasi Admin dibuat
    const notif = await prisma.notification.findFirst({
      where: {
        actionId: createdRequestId,
        type: 'AUTH',
        targetRole: 'ADMIN'
      }
    });
    expect(notif).not.toBeNull();
    expect(notif.message).toContain(usernameA);
  });

  // =========================================================================
  // Skenario J: Permintaan reset yang sedang PENDING tidak menghasilkan duplikat
  // =========================================================================
  it('J. Duplicate reset request when already PENDING is rejected with 400', async () => {
    const resDuplicate = await request(app)
      .post('/api/password-reset/request')
      .send({
        username: usernameA,
        reason: 'Mencoba kirim ulang'
      });

    expect(resDuplicate.status).toBe(400);
    expect(resDuplicate.body.message).toContain('sudah ada dan sedang diproses');

    // Pastikan tidak ada request duplikat
    const totalRequests = await prisma.passwordResetRequest.count({
      where: { userId: testUser.id, status: 'PENDING' }
    });
    expect(totalRequests).toBe(1);
  });

  // =========================================================================
  // Skenario L: Proses persetujuan/penolakan oleh Admin konsisten & tandai notif terbaca
  // =========================================================================
  it('L. Admin approve and reject verify flow updates request and marks notification as read', async () => {
    // 1. Admin approve
    const approveRes = await request(app)
      .post('/api/password-reset/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestId: createdRequestId,
        isApproved: true,
        notes: 'Disetujui oleh Admin Operasional'
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.newPassword).toBeDefined();

    // Verifikasi status request COMPLETED
    const updatedReq = await prisma.passwordResetRequest.findUnique({
      where: { id: createdRequestId }
    });
    expect(updatedReq.status).toBe('COMPLETED');
    expect(updatedReq.resetByAdminId).toBe(adminUser.id);
    expect(updatedReq.adminNotes).toBe('Disetujui oleh Admin Operasional');

    // Verifikasi notifikasi admin ditandai sudah dibaca
    const notif = await prisma.notification.findFirst({
      where: { actionId: createdRequestId }
    });
    expect(notif.isRead).toBe(true);
  });
});
