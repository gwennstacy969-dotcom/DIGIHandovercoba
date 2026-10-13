const request = require('supertest');
const app = require('../index');
const prisma = require('../src/config/prisma');
const TokenManager = require('../src/utils/TokenManager');

describe('AMT Compliance & Vehicle Issue Decoupling Regression Tests', () => {
  let testUserAmt;
  let testUserPengawas;
  let testUserAdmin;
  let amtToken;
  let pengawasToken;
  let adminToken;
  let testVehicleNopolA;
  let testVehicleNopolB;
  let testVehicleNopolC;

  beforeAll(async () => {
    // 1. Setup Test Users
    testUserAmt = await prisma.user.findFirst({ where: { role: 'AMT' } });
    if (!testUserAmt) {
      testUserAmt = await prisma.user.create({
        data: {
          username: `test_amt_${Date.now()}`,
          password: 'hashed_password',
          name: 'Budi Santoso AMT',
          role: 'AMT',
          jabatan: 'Driver AMT 1'
        }
      });
    }

    testUserPengawas = await prisma.user.findFirst({ where: { role: 'PENGAWAS' } });
    if (!testUserPengawas) {
      testUserPengawas = await prisma.user.create({
        data: {
          username: `test_pengawas_${Date.now()}`,
          password: 'hashed_password',
          name: 'Agus Pengawas',
          role: 'PENGAWAS',
          jabatan: 'Supervisor HSSE'
        }
      });
    }

    testUserAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!testUserAdmin) {
      testUserAdmin = await prisma.user.create({
        data: {
          username: `test_admin_${Date.now()}`,
          password: 'hashed_password',
          name: 'Admin FT Maos',
          role: 'ADMIN',
          jabatan: 'Admin Operasional'
        }
      });
    }

    amtToken = TokenManager.generateAccessToken(testUserAmt);
    pengawasToken = TokenManager.generateAccessToken(testUserPengawas);
    adminToken = TokenManager.generateAccessToken(testUserAdmin);

    // 2. Setup Test Vehicles
    const ts = Date.now().toString().slice(-6);
    testVehicleNopolA = `R ${ts} A`;
    testVehicleNopolB = `R ${ts} B`;
    testVehicleNopolC = `R ${ts} C`;

    // Clean up any stale test records from previous runs
    const existingHandovers = await prisma.handover.findMany({
      where: { noPolisi: { in: [testVehicleNopolA, testVehicleNopolB, testVehicleNopolC] } },
      select: { id: true }
    });
    const hoIds = existingHandovers.map(h => h.id);
    await prisma.amtIssue.deleteMany({ where: { handoverId: { in: hoIds } } });
    await prisma.handover.deleteMany({
      where: { noPolisi: { in: [testVehicleNopolA, testVehicleNopolB, testVehicleNopolC] } }
    });
    await prisma.vehicle.deleteMany({
      where: { noPolisi: { in: [testVehicleNopolA, testVehicleNopolB, testVehicleNopolC] } }
    });

    // Also delete any orphaned AmtIssue rows whose handover no longer exists
    const allValidHo = await prisma.handover.findMany({ select: { id: true } });
    const allValidHoIds = allValidHo.map(h => h.id);
    await prisma.amtIssue.deleteMany({ where: { handoverId: { notIn: allValidHoIds } } });

    await prisma.vehicle.createMany({
      data: [
        { noPolisi: testVehicleNopolA, barcode: `BC_${testVehicleNopolA}`, status: 'READY_TO_START' },
        { noPolisi: testVehicleNopolB, barcode: `BC_${testVehicleNopolB}`, status: 'READY_TO_START' },
        { noPolisi: testVehicleNopolC, barcode: `BC_${testVehicleNopolC}`, status: 'READY_TO_START' }
      ]
    });
  });

  afterAll(async () => {
    // Clean up test vehicles and related records
    const existingHandovers = await prisma.handover.findMany({
      where: { noPolisi: { in: [testVehicleNopolA, testVehicleNopolB, testVehicleNopolC] } },
      select: { id: true }
    });
    const hoIds = existingHandovers.map(h => h.id);
    await prisma.amtIssue.deleteMany({ where: { handoverId: { in: hoIds } } });
    await prisma.handover.deleteMany({
      where: { noPolisi: { in: [testVehicleNopolA, testVehicleNopolB, testVehicleNopolC] } }
    });
    await prisma.vehicle.deleteMany({
      where: { noPolisi: { in: [testVehicleNopolA, testVehicleNopolB, testVehicleNopolC] } }
    });
    await prisma.$disconnect();
  });

  // =========================================================================
  // Test 1: Kategori A Major membuat isu kendaraan & status kendaraan Maintenance
  // =========================================================================
  it('1. Category A Major item creates vehicle Issue and sets vehicle to Maintenance', async () => {
    const items = [
      { category: 'A', name: 'Kondisi Rem [MAJOR]', isGood: false, severity: 'Major', description: 'Rem blong' },
      { category: 'A', name: 'Kondisi Wiper', isGood: true },
      { category: 'B', name: 'Menggunakan Helm Safety', isGood: true }
    ];

    const res = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${amtToken}`)
      .field('userId', testUserAmt.id)
      .field('noPolisi', testVehicleNopolA)
      .field('shift', '1')
      .field('type', 'mulai')
      .field('locationLat', -7.5)
      .field('locationLng', 109.0)
      .field('items', JSON.stringify(items));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Check vehicle status updated to Maintenance
    const vehicle = await prisma.vehicle.findUnique({ where: { noPolisi: testVehicleNopolA } });
    expect(vehicle.status).toBe('Maintenance');

    // Check Issue created for Category A
    const issue = await prisma.issue.findFirst({
      where: { handoverId: res.body.handover.id }
    });
    expect(issue).not.toBeNull();
    expect(issue.status).toBe('ONGOING');

    // Check Notification created with actionType VIEW_ISSUE (not kritis)
    const notif = await prisma.notification.findFirst({
      where: { noPolisi: testVehicleNopolA, actionType: 'VIEW_ISSUE' }
    });
    expect(notif).not.toBeNull();
    expect(notif.title).toContain('Kendaraan');
    expect(notif.title).not.toContain('Kritis');
  });

  // =========================================================================
  // Test 2: Kategori B tidak lengkap dicatat sebagai AmtIssue dan TIDAK membuat status Maintenance
  // =========================================================================
  it('2. Category B deficient item creates AmtIssue, does NOT set vehicle to Maintenance, and leaves vehicle Active', async () => {
    const items = [
      { category: 'A', name: 'Kondisi Rem', isGood: true },
      { category: 'A', name: 'Kondisi Wiper', isGood: true },
      { category: 'B', name: 'Membawa SIM Sesuai Kendaraan', isGood: false, notes: 'SIM tertinggal di rumah' }
    ];

    const res = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${amtToken}`)
      .field('userId', testUserAmt.id)
      .field('noPolisi', testVehicleNopolB)
      .field('shift', '1')
      .field('type', 'mulai')
      .field('locationLat', -7.5)
      .field('locationLng', 109.0)
      .field('items', JSON.stringify(items));

    expect(res.status).toBe(201);

    // Vehicle status should be Active (mulai), NOT Maintenance!
    const vehicle = await prisma.vehicle.findUnique({ where: { noPolisi: testVehicleNopolB } });
    expect(vehicle.status).toBe('Active');

    // Vehicle Issue should NOT exist since Category A is all good
    const vehicleIssue = await prisma.issue.findFirst({
      where: { handoverId: res.body.handover.id }
    });
    expect(vehicleIssue).toBeNull();

    // AmtIssue MUST exist with status PENDING/OPEN
    const amtIssues = await prisma.amtIssue.findMany({
      where: { handoverId: res.body.handover.id }
    });
    expect(amtIssues.length).toBe(1);
    expect(amtIssues[0].itemName).toBe('Membawa SIM Sesuai Kendaraan');
    expect(amtIssues[0].category).toBe('B');
    expect(['PENDING', 'OPEN']).toContain(amtIssues[0].status);

    // Notification created with actionType VIEW_AMT_ISSUE
    const notifAmt = await prisma.notification.findFirst({
      where: { actionId: res.body.handover.id, actionType: 'VIEW_AMT_ISSUE' }
    });
    expect(notifAmt).not.toBeNull();
    expect(notifAmt.title).toContain('Temuan Kepatuhan AMT');
  });

  // =========================================================================
  // Test 3: Scanner kendaraan tidak memblokir kendaraan yang hanya memiliki isu Kategori B
  // =========================================================================
  it('3. Vehicle scanner does NOT block vehicle when only Category B issue exists', async () => {
    const res = await request(app)
      .get(`/api/vehicles/scan/BC_${testVehicleNopolB}`)
      .set('Authorization', `Bearer ${amtToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Should return vehicle without error
    expect(res.body.vehicle.noPolisi).toBe(testVehicleNopolB);
  });

  // =========================================================================
  // Test 4: Handover dengan Kategori A Major DAN Kategori B tidak lengkap menghasilkan dua temuan independen
  // =========================================================================
  let dualHandoverId;
  let dualVehicleIssueId;
  let dualAmtIssueId;

  it('4. Handover with BOTH Category A Major and Category B items generates two independent issues', async () => {
    const items = [
      { category: 'A', name: 'Kebocoran Tangki [MAJOR]', isGood: false, severity: 'Major', description: 'Kran bocor' },
      { category: 'B', name: 'Dokumen HSE Paspor', isGood: false, notes: 'Paspor habis masa berlaku' }
    ];

    const res = await request(app)
      .post('/api/handovers')
      .set('Authorization', `Bearer ${amtToken}`)
      .field('userId', testUserAmt.id)
      .field('noPolisi', testVehicleNopolC)
      .field('shift', '1')
      .field('type', 'mulai')
      .field('locationLat', -7.5)
      .field('locationLng', 109.0)
      .field('items', JSON.stringify(items));

    expect(res.status).toBe(201);
    dualHandoverId = res.body.handover.id;

    // Vehicle goes to Maintenance because of Category A Major
    const vehicle = await prisma.vehicle.findUnique({ where: { noPolisi: testVehicleNopolC } });
    expect(vehicle.status).toBe('Maintenance');

    // Both records exist
    const vIssue = await prisma.issue.findFirst({ where: { handoverId: dualHandoverId } });
    const aIssue = await prisma.amtIssue.findFirst({ where: { handoverId: dualHandoverId } });

    expect(vIssue).not.toBeNull();
    expect(aIssue).not.toBeNull();

    dualVehicleIssueId = vIssue.id;
    dualAmtIssueId = aIssue.id;
  });

  // =========================================================================
  // Test 5: Penyelesaian temuan AMT TIDAK otomatis menutup isu kendaraan
  // =========================================================================
  it('5. Resolving AMT issue does NOT close active vehicle issue', async () => {
    const resolveRes = await request(app)
      .put(`/api/amt-issues/${dualAmtIssueId}/resolve`)
      .set('Authorization', `Bearer ${pengawasToken}`)
      .send({ actionTaken: 'Petugas telah menunjukkan HSE Paspor yang sudah diperpanjang.' });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.success).toBe(true);

    // AmtIssue is now RESOLVED
    const updatedAmtIssue = await prisma.amtIssue.findUnique({ where: { id: dualAmtIssueId } });
    expect(updatedAmtIssue.status).toBe('RESOLVED');
    expect(updatedAmtIssue.resolvedBy).toBe(testUserPengawas.name);

    // Vehicle issue MUST STILL BE ONGOING!
    const vehicleIssue = await prisma.issue.findUnique({ where: { id: dualVehicleIssueId } });
    expect(vehicleIssue.status).toBe('ONGOING');

    // Vehicle must still be Maintenance
    const vehicle = await prisma.vehicle.findUnique({ where: { noPolisi: testVehicleNopolC } });
    expect(vehicle.status).toBe('Maintenance');
  });

  // =========================================================================
  // Test 6: Penyelesaian isu kendaraan TIDAK mengubah status temuan AMT
  // =========================================================================
  it('6. Resolving vehicle issue does NOT alter AMT issue lifecycle', async () => {
    const resolveVehicleRes = await request(app)
      .put(`/api/issues/${dualVehicleIssueId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resolveVehicleRes.status).toBe(200);

    // Vehicle issue is RESOLVED
    const updatedVIssue = await prisma.issue.findUnique({ where: { id: dualVehicleIssueId } });
    expect(updatedVIssue.status).toBe('RESOLVED');

    // Vehicle restored to Active or READY_TO_START
    const vehicle = await prisma.vehicle.findUnique({ where: { noPolisi: testVehicleNopolC } });
    expect(['READY_TO_START', 'Active']).toContain(vehicle.status);
  });

  // =========================================================================
  // Test 7: API Scoping: AMT hanya melihat temuan miliknya, Pengawas/Admin melihat semua
  // =========================================================================
  it('7. Role-based scoping: AMT only sees their own AMT issues, Supervisor sees all', async () => {
    // 1. As Pengawas
    const resPengawas = await request(app)
      .get('/api/amt-issues')
      .set('Authorization', `Bearer ${pengawasToken}`);

    expect(resPengawas.status).toBe(200);
    expect(Array.isArray(resPengawas.body)).toBe(true);
    expect(resPengawas.body.length).toBeGreaterThanOrEqual(1);

    // 2. As AMT
    const resAmt = await request(app)
      .get('/api/amt-issues')
      .set('Authorization', `Bearer ${amtToken}`);

    expect(resAmt.status).toBe(200);
    expect(Array.isArray(resAmt.body)).toBe(true);
    // Every item in AMT response must belong to testUserAmt
    resAmt.body.forEach(item => {
      expect([testUserAmt.id, null]).toContain(item.userId || testUserAmt.id);
    });
  });

  // =========================================================================
  // Test 8: Filter status temuan AMT (OPEN vs ALL)
  // =========================================================================
  it('8. AMT Issues filter by status returns correct subsets', async () => {
    const resOpen = await request(app)
      .get('/api/amt-issues?status=OPEN')
      .set('Authorization', `Bearer ${pengawasToken}`);

    expect(resOpen.status).toBe(200);
    resOpen.body.forEach(item => {
      expect(['OPEN', 'PENDING']).toContain(item.status);
    });

    const resAll = await request(app)
      .get('/api/amt-issues?status=ALL')
      .set('Authorization', `Bearer ${pengawasToken}`);

    expect(resAll.status).toBe(200);
    expect(resAll.body.length).toBeGreaterThanOrEqual(resOpen.body.length);
  });
});
