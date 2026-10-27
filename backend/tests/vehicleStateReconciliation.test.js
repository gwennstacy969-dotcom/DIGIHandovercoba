const request = require('supertest');
const app = require('../index');
const prisma = require('../src/config/prisma');
const TokenManager = require('../src/utils/TokenManager');
const scanTokenService = require('../src/services/scanTokenService');
const {
  reconcileVehicleOperationalStatus,
  getLatestVehicleHandover
} = require('../src/services/vehicleStatusService');

describe('Vehicle Operational Status & State Machine Regression Tests', () => {
  let testAmt;
  let testPengawas;
  let testAdmin;
  let testSuperAdmin;
  let amtToken;
  let pengawasToken;
  let adminToken;
  let superAdminToken;

  const prefix = `REG_${Date.now().toString().slice(-6)}`;
  const nopol1 = `R ${prefix} 1`;
  const nopol2 = `R ${prefix} 2`;
  const nopol3 = `R ${prefix} 3`;
  const nopol4 = `R ${prefix} 4`;
  const nopol5 = `R ${prefix} 5`;
  const nopol6 = `R ${prefix} 6`;
  const nopol7 = `R ${prefix} 7`;
  const nopol8 = `R ${prefix} 8`;

  const allNopols = [nopol1, nopol2, nopol3, nopol4, nopol5, nopol6, nopol7, nopol8];

  beforeAll(async () => {
    // 1. Get or create active test users (deletedAt: null)
    testAmt = await prisma.user.findFirst({ where: { role: 'AMT', deletedAt: null } });
    if (!testAmt) {
      testAmt = await prisma.user.create({
        data: {
          username: `amt_${prefix}`,
          password: 'password_hash',
          name: 'Budi AMT Test',
          role: 'AMT'
        }
      });
    }

    testPengawas = await prisma.user.findFirst({ where: { role: 'PENGAWAS', deletedAt: null } });
    if (!testPengawas) {
      testPengawas = await prisma.user.create({
        data: {
          username: `pengawas_${prefix}`,
          password: 'password_hash',
          name: 'Agus Pengawas Test',
          role: 'PENGAWAS'
        }
      });
    }

    testAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN', deletedAt: null } });
    if (!testAdmin) {
      testAdmin = await prisma.user.create({
        data: {
          username: `admin_${prefix}`,
          password: 'password_hash',
          name: 'Admin Test',
          role: 'ADMIN'
        }
      });
    }

    testSuperAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
    if (!testSuperAdmin) {
      testSuperAdmin = await prisma.user.create({
        data: {
          username: `superadmin_${prefix}`,
          password: 'password_hash',
          name: 'Super Admin Test',
          role: 'SUPER_ADMIN'
        }
      });
    }

    amtToken = TokenManager.generateAccessToken(testAmt);
    pengawasToken = TokenManager.generateAccessToken(testPengawas);
    adminToken = TokenManager.generateAccessToken(testAdmin);
    superAdminToken = TokenManager.generateAccessToken(testSuperAdmin);

    // 2. Cleanup existing test vehicles if any
    const existingHandovers = await prisma.handover.findMany({
      where: { noPolisi: { in: allNopols } },
      select: { id: true }
    });
    const hoIds = existingHandovers.map(h => h.id);
    if (hoIds.length > 0) {
      await prisma.handoverItem.deleteMany({ where: { handoverId: { in: hoIds } } });
      await prisma.issue.deleteMany({ where: { handoverId: { in: hoIds } } });
      await prisma.amtIssue.deleteMany({ where: { handoverId: { in: hoIds } } });
      await prisma.handover.deleteMany({ where: { id: { in: hoIds } } });
    }
    await prisma.vehicle.deleteMany({ where: { noPolisi: { in: allNopols } } });
  });

  afterAll(async () => {
    // Cleanup test data
    const existingHandovers = await prisma.handover.findMany({
      where: { noPolisi: { in: allNopols } },
      select: { id: true }
    });
    const hoIds = existingHandovers.map(h => h.id);
    if (hoIds.length > 0) {
      await prisma.handoverItem.deleteMany({ where: { handoverId: { in: hoIds } } });
      await prisma.issue.deleteMany({ where: { handoverId: { in: hoIds } } });
      await prisma.amtIssue.deleteMany({ where: { handoverId: { in: hoIds } } });
      await prisma.handover.deleteMany({ where: { id: { in: hoIds } } });
    }
    await prisma.vehicle.deleteMany({ where: { noPolisi: { in: allNopols } } });
    await prisma.$disconnect();
  });

  // =========================================================================
  // SKENARIO 1:
  // Riwayat terakhir 'akhiri', status lama 'Active', tidak ada issue Major aktif
  // -> status dikoreksi menjadi 'READY_TO_START' dan Mulai diizinkan.
  // =========================================================================
  it('1. Reconciles stale Active status to READY_TO_START when last handover is akhiri and allows Mulai', async () => {
    const v = await prisma.vehicle.create({
      data: {
        noPolisi: nopol1,
        barcode: `BC_${nopol1}`,
        status: 'Active' // Status usang di database
      }
    });

    // Buat riwayat terakhir akhiri
    await prisma.handover.create({
      data: {
        id: `HO_TEST_${nopol1}_1`,
        noPolisi: nopol1,
        userId: testAmt.id,
        shift: '1',
        type: 'akhiri',
        status: 'Siap Operasi (Normal)',
        timestamp: new Date(Date.now() - 3600000)
      }
    });

    // Scan kendaraan via API
    const scanRes = await request(app)
      .get(`/api/vehicles/scan/BC_${nopol1}?userId=${testAmt.id}&processType=mulai`)
      .set('Authorization', `Bearer ${amtToken}`);

    expect(scanRes.status).toBe(200);
    expect(scanRes.body.success).toBe(true);
    expect(scanRes.body.vehicle.status).toBe('READY_TO_START');
    expect(scanRes.body.scanToken).toBeDefined();

    // Pastikan status di database juga telah disinkronkan ke READY_TO_START
    const inDb = await prisma.vehicle.findUnique({ where: { noPolisi: nopol1 } });
    expect(inDb.status).toBe('READY_TO_START');

    // Submit handover mulai
    const submitRes = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${amtToken}`)
      .set('x-scan-token', scanRes.body.scanToken)
      .field('noPolisi', nopol1)
      .field('shift', '1')
      .field('type', 'mulai')
      .field('locationLat', -7.4)
      .field('locationLng', 109.1)
      .field('items', JSON.stringify([
        { category: 'A', name: 'Kondisi Rem [MAJOR]', isGood: true },
        { category: 'A', name: 'Kondisi Ban', isGood: true }
      ]));

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);

    // Status kendaraan kini Active
    const updatedDb = await prisma.vehicle.findUnique({ where: { noPolisi: nopol1 } });
    expect(updatedDb.status).toBe('Active');
  });

  // =========================================================================
  // SKENARIO 2:
  // Riwayat terakhir 'akhiri', status lama 'Maintenance', tidak ada issue Major aktif
  // -> status direkonsiliasi menjadi 'READY_TO_START'.
  // =========================================================================
  it('2. Reconciles stale Maintenance status to READY_TO_START when all issues resolved and last handover is akhiri', async () => {
    await prisma.vehicle.create({
      data: {
        noPolisi: nopol2,
        barcode: `BC_${nopol2}`,
        status: 'Maintenance' // Status usang setelah perbaikan selesai
      }
    });

    // Buat handover dengan issue yang sudah RESOLVED
    const ho = await prisma.handover.create({
      data: {
        id: `HO_TEST_${nopol2}_1`,
        noPolisi: nopol2,
        userId: testAmt.id,
        shift: '1',
        type: 'akhiri',
        status: 'Siap Operasi (Normal)',
        timestamp: new Date(Date.now() - 7200000),
        items: {
          create: [{ category: 'A', name: 'Kondisi Rem [MAJOR]', isGood: false, isRepaired: true }]
        },
        issue: {
          create: { status: 'RESOLVED', resolvedAt: new Date() }
        }
      }
    });

    const result = await reconcileVehicleOperationalStatus(nopol2);
    expect(result.expectedStatus).toBe('READY_TO_START');
    expect(result.vehicle.status).toBe('READY_TO_START');

    const inDb = await prisma.vehicle.findUnique({ where: { noPolisi: nopol2 } });
    expect(inDb.status).toBe('READY_TO_START');
  });

  // =========================================================================
  // SKENARIO 3:
  // Riwayat terakhir 'akhiri' tetapi issue Major masih 'ONGOING'
  // -> kendaraan tetap diblokir ('Maintenance').
  // =========================================================================
  it('3. Keeps vehicle in Maintenance when last handover is akhiri but a Major issue is ONGOING', async () => {
    await prisma.vehicle.create({
      data: {
        noPolisi: nopol3,
        barcode: `BC_${nopol3}`,
        status: 'Maintenance'
      }
    });

    await prisma.handover.create({
      data: {
        id: `HO_TEST_${nopol3}_1`,
        noPolisi: nopol3,
        userId: testAmt.id,
        shift: '1',
        type: 'akhiri',
        status: 'Ada Masalah',
        timestamp: new Date(Date.now() - 3600000),
        items: {
          create: [{ category: 'A', name: 'Kondisi Rem [MAJOR]', isGood: false, severity: 'Major' }]
        },
        issue: {
          create: { status: 'ONGOING' }
        }
      }
    });

    const result = await reconcileVehicleOperationalStatus(nopol3);
    expect(result.hasActiveMajorIssue).toBe(true);
    expect(result.expectedStatus).toBe('Maintenance');
    expect(result.vehicle.status).toBe('Maintenance');

    // Scan via endpoint
    const scanRes = await request(app)
      .get(`/api/vehicles/scan/BC_${nopol3}?userId=${testAmt.id}&processType=mulai`)
      .set('Authorization', `Bearer ${amtToken}`);

    expect(scanRes.status).toBe(200);
    expect(scanRes.body.vehicle.status).toBe('Maintenance');

    // Coba submit Mulai -> harus ditolak 409
    const submitRes = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${amtToken}`)
      .set('x-scan-token', scanRes.body.scanToken)
      .field('noPolisi', nopol3)
      .field('shift', '1')
      .field('type', 'mulai')
      .field('locationLat', -7.4)
      .field('locationLng', 109.1)
      .field('items', JSON.stringify([{ category: 'A', name: 'Kondisi Ban', isGood: true }]));

    expect(submitRes.status).toBe(409);
    expect(submitRes.body.error).toContain('Maintenance');
  });

  // =========================================================================
  // SKENARIO 4:
  // Riwayat terakhir 'akhiri' tetapi issue Major masih 'PENDING_APPROVAL'
  // -> kendaraan tetap diblokir ('Maintenance').
  // =========================================================================
  it('4. Keeps vehicle in Maintenance when Major issue is PENDING_APPROVAL', async () => {
    await prisma.vehicle.create({
      data: {
        noPolisi: nopol4,
        barcode: `BC_${nopol4}`,
        status: 'Maintenance'
      }
    });

    await prisma.handover.create({
      data: {
        id: `HO_TEST_${nopol4}_1`,
        noPolisi: nopol4,
        userId: testAmt.id,
        shift: '1',
        type: 'akhiri',
        status: 'Ada Masalah',
        timestamp: new Date(Date.now() - 3600000),
        items: {
          create: [{ category: 'A', name: 'Kondisi Rem [MAJOR]', isGood: false, isRepaired: true }]
        },
        issue: {
          create: { status: 'PENDING_APPROVAL', repairRequestedAt: new Date() }
        }
      }
    });

    const result = await reconcileVehicleOperationalStatus(nopol4);
    expect(result.hasActiveMajorIssue).toBe(true);
    expect(result.expectedStatus).toBe('Maintenance');
    expect(result.vehicle.status).toBe('Maintenance');

    // Coba submit Mulai -> harus ditolak 409
    const scanRes = await request(app)
      .get(`/api/vehicles/scan/BC_${nopol4}?userId=${testAdmin.id}&processType=mulai`)
      .set('Authorization', `Bearer ${adminToken}`);

    const submitRes = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-scan-token', scanRes.body.scanToken)
      .field('noPolisi', nopol4)
      .field('shift', '1')
      .field('type', 'mulai')
      .field('locationLat', -7.4)
      .field('locationLng', 109.1)
      .field('items', JSON.stringify([{ category: 'A', name: 'Kondisi Ban', isGood: true }]));

    expect(submitRes.status).toBe(409);
    expect(submitRes.body.error).toContain('Maintenance');
  });

  // =========================================================================
  // SKENARIO 5:
  // Riwayat terakhir 'mulai' -> Mulai kedua ditolak, Akhiri dapat diproses jika memenuhi syarat
  // =========================================================================
  it('5. Rejects second Mulai when last handover is mulai, and allows Akhiri', async () => {
    await prisma.vehicle.create({
      data: {
        noPolisi: nopol5,
        barcode: `BC_${nopol5}`,
        status: 'Active'
      }
    });

    await prisma.handover.create({
      data: {
        id: `HO_TEST_${nopol5}_1`,
        noPolisi: nopol5,
        userId: testAmt.id,
        amt1: testAmt.name,
        shift: '1',
        type: 'mulai',
        status: 'Siap Operasi (Normal)',
        timestamp: new Date(Date.now() - 1800000)
      }
    });

    // Reconcile -> status Active
    const result = await reconcileVehicleOperationalStatus(nopol5);
    expect(result.expectedStatus).toBe('Active');

    // Coba submit Mulai kedua -> ditolak 409
    const scanMulai = await request(app)
      .get(`/api/vehicles/scan/BC_${nopol5}?userId=${testAmt.id}&processType=mulai`)
      .set('Authorization', `Bearer ${amtToken}`);

    const secondMulaiRes = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${amtToken}`)
      .set('x-scan-token', scanMulai.body.scanToken)
      .field('noPolisi', nopol5)
      .field('shift', '1')
      .field('type', 'mulai')
      .field('locationLat', -7.4)
      .field('locationLng', 109.1)
      .field('items', JSON.stringify([{ category: 'A', name: 'Ban', isGood: true }]));

    expect(secondMulaiRes.status).toBe(409);
    expect(secondMulaiRes.body.error).toContain('pekerjaan aktif');

    // Scan untuk Akhiri
    const scanAkhiri = await request(app)
      .get(`/api/vehicles/scan/BC_${nopol5}?userId=${testAmt.id}&processType=akhiri`)
      .set('Authorization', `Bearer ${amtToken}`);

    expect(scanAkhiri.status).toBe(200);

    // Submit Akhiri oleh AMT yang sama -> berhasil
    const submitAkhiriRes = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${amtToken}`)
      .set('x-scan-token', scanAkhiri.body.scanToken)
      .field('noPolisi', nopol5)
      .field('shift', '1')
      .field('type', 'akhiri')
      .field('locationLat', -7.4)
      .field('locationLng', 109.1)
      .field('items', JSON.stringify([{ category: 'A', name: 'Ban', isGood: true }]));

    expect(submitAkhiriRes.status).toBe(201);
    expect(submitAkhiriRes.body.success).toBe(true);

    // Kendaraan kembali READY_TO_START
    const afterAkhiri = await prisma.vehicle.findUnique({ where: { noPolisi: nopol5 } });
    expect(afterAkhiri.status).toBe('READY_TO_START');
  });

  // =========================================================================
  // SKENARIO 6:
  // Riwayat terakhir 'akhiri' -> Akhiri kedua ditolak karena tidak ada pekerjaan aktif
  // =========================================================================
  it('6. Rejects second Akhiri when last handover is already akhiri', async () => {
    await prisma.vehicle.create({
      data: {
        noPolisi: nopol6,
        barcode: `BC_${nopol6}`,
        status: 'READY_TO_START'
      }
    });

    await prisma.handover.create({
      data: {
        id: `HO_TEST_${nopol6}_1`,
        noPolisi: nopol6,
        userId: testAmt.id,
        shift: '1',
        type: 'akhiri',
        status: 'Siap Operasi (Normal)',
        timestamp: new Date(Date.now() - 3600000)
      }
    });

    const scanRes = await request(app)
      .get(`/api/vehicles/scan/BC_${nopol6}?userId=${testAmt.id}&processType=akhiri`)
      .set('Authorization', `Bearer ${amtToken}`);

    expect(scanRes.status).toBe(200);

    const submitRes = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${amtToken}`)
      .set('x-scan-token', scanRes.body.scanToken)
      .field('noPolisi', nopol6)
      .field('shift', '1')
      .field('type', 'akhiri')
      .field('locationLat', -7.4)
      .field('locationLng', 109.1)
      .field('items', JSON.stringify([{ category: 'A', name: 'Ban', isGood: true }]));

    expect(submitRes.status).toBe(409);
    expect(submitRes.body.error).toContain('belum memiliki pekerjaan aktif');
  });

  // =========================================================================
  // SKENARIO 7:
  // Handover dengan timestamp sama tetap memilih riwayat terbaru secara konsisten
  // menggunakan createdAt desc sebagai tiebreaker
  // =========================================================================
  it('7. Consistently selects the latest handover using createdAt DESC when timestamp is identical', async () => {
    await prisma.vehicle.create({
      data: {
        noPolisi: nopol7,
        barcode: `BC_${nopol7}`,
        status: 'Active'
      }
    });

    const identicalTime = new Date('2026-10-27T08:00:00.000Z');

    // Buat riwayat mulai terdahulu
    const hoMulai = await prisma.handover.create({
      data: {
        id: `HO_TEST_${nopol7}_MULAI`,
        noPolisi: nopol7,
        userId: testAmt.id,
        shift: '1',
        type: 'mulai',
        status: 'Siap Operasi (Normal)',
        timestamp: identicalTime,
        createdAt: new Date('2026-10-27T08:00:01.000Z')
      }
    });

    // Buat riwayat akhiri berikutnya pada timestamp yang sama tetapi createdAt lebih baru
    const hoAkhiri = await prisma.handover.create({
      data: {
        id: `HO_TEST_${nopol7}_AKHIRI`,
        noPolisi: nopol7,
        userId: testAmt.id,
        shift: '1',
        type: 'akhiri',
        status: 'Siap Operasi (Normal)',
        timestamp: identicalTime,
        createdAt: new Date('2026-10-27T08:00:02.000Z')
      }
    });

    const latest = await getLatestVehicleHandover(nopol7);
    expect(latest.id).toBe(hoAkhiri.id);
    expect(latest.type).toBe('akhiri');

    // Reconcile status harus menghasilkan READY_TO_START berdasarkan riwayat akhiri
    const result = await reconcileVehicleOperationalStatus(nopol7);
    expect(result.expectedStatus).toBe('READY_TO_START');
    expect(result.vehicle.status).toBe('READY_TO_START');
  });

  // =========================================================================
  // SKENARIO 8:
  // Validasi tetap aman dan konsisten untuk semua role (AMT, Pengawas, Admin, Super Admin)
  // =========================================================================
  it('8. Validates safely and consistently across all roles (AMT, Pengawas, Admin, Super Admin)', async () => {
    await prisma.vehicle.create({
      data: {
        noPolisi: nopol8,
        barcode: `BC_${nopol8}`,
        status: 'READY_TO_START'
      }
    });

    const roles = [
      { name: 'AMT', user: testAmt, token: amtToken },
      { name: 'PENGAWAS', user: testPengawas, token: pengawasToken },
      { name: 'ADMIN', user: testAdmin, token: adminToken },
      { name: 'SUPER_ADMIN', user: testSuperAdmin, token: superAdminToken }
    ];

    for (const r of roles) {
      // Setiap role wajib scan QR fisik melalui scan API
      const scanRes = await request(app)
        .get(`/api/vehicles/scan/BC_${nopol8}?userId=${r.user.id}&processType=mulai`)
        .set('Authorization', `Bearer ${r.token}`);

      expect(scanRes.status).toBe(200);
      expect(scanRes.body.scanToken).toBeDefined();
      expect(scanRes.body.vehicle.status).toBe('READY_TO_START');
    }

    // Eksekusi mulai oleh kru AMT
    const amtScan = await request(app)
      .get(`/api/vehicles/scan/BC_${nopol8}?userId=${testAmt.id}&processType=mulai`)
      .set('Authorization', `Bearer ${amtToken}`);

    const startRes = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${amtToken}`)
      .set('x-scan-token', amtScan.body.scanToken)
      .field('noPolisi', nopol8)
      .field('amt1', testAmt.name)
      .field('shift', '1')
      .field('type', 'mulai')
      .field('locationLat', -7.4)
      .field('locationLng', 109.1)
      .field('items', JSON.stringify([{ category: 'A', name: 'Ban', isGood: true }]));

    expect(startRes.status).toBe(201);

    // Verifikasi kendaraan Active
    const activeVeh = await prisma.vehicle.findUnique({ where: { noPolisi: nopol8 } });
    expect(activeVeh.status).toBe('Active');

    // Pengawas/Admin dapat mengakhiri pekerjaan (supervisory role)
    const pengawasScan = await request(app)
      .get(`/api/vehicles/scan/BC_${nopol8}?userId=${testPengawas.id}&processType=akhiri`)
      .set('Authorization', `Bearer ${pengawasToken}`);

    const endRes = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${pengawasToken}`)
      .set('x-scan-token', pengawasScan.body.scanToken)
      .field('noPolisi', nopol8)
      .field('shift', '1')
      .field('type', 'akhiri')
      .field('locationLat', -7.4)
      .field('locationLng', 109.1)
      .field('items', JSON.stringify([{ category: 'A', name: 'Ban', isGood: true }]));

    expect(endRes.status).toBe(201);

    // Kendaraan kembali siap
    const finalVeh = await prisma.vehicle.findUnique({ where: { noPolisi: nopol8 } });
    expect(finalVeh.status).toBe('READY_TO_START');
  });
});
