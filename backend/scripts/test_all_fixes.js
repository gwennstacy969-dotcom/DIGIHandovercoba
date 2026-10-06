const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }
  return { status: response.status, data };
}

async function testAll() {
  console.log('=== MEMULAI TEST INTEGRASI SEMUA PERBAIKAN LOGIKA & SISTEM ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Test Health Check
  try {
    const res = await request('/health', { method: 'GET' });
    assert(res.status === 200 && res.data.status === 'UP', '1. Service /health check is UP');
  } catch (e) {
    assert(false, `1. Service /health failed: ${e.message}`);
  }

  // 2. Test A5: Unauthenticated access to scan barcode must return 401
  try {
    const res = await request('/api/vehicles/scan/TESTBARCODE', { method: 'GET' });
    assert(res.status === 401, '2. (A5) Unauthenticated scan properly rejected with 401');
  } catch (e) {
    assert(false, `2. Error testing scan: ${e.message}`);
  }

  // 3. Test A1 & C7: Login with valid credentials, verify bcrypt and 1h token
  let adminToken = null;
  let workerToken = null;
  let adminUser = null;
  let workerUser = null;

  try {
    adminUser = await prisma.user.findFirst({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletedAt: null }
    });
    workerUser = await prisma.user.findFirst({
      where: { role: { in: ['AMT', 'USER'] }, deletedAt: null }
    });

    if (adminUser) {
      assert(adminUser.password.startsWith('$2b$'), '3. (A1) Admin password in DB is hashed with bcrypt');

      // Test login with wrong password
      const wrongLoginRes = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: adminUser.username,
          password: 'WRONG_PASSWORD_!@#$'
        })
      });
      assert(wrongLoginRes.status === 401, '4. Login with wrong password correctly returns 401');

      // Set test password for testing
      const testPass = 'admin_test_pass_123';
      const hash = await bcrypt.hash(testPass, 10);
      await prisma.user.update({ where: { id: adminUser.id }, data: { password: hash } });

      const loginRes = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: adminUser.username,
          password: testPass
        })
      });

      adminToken = loginRes.data.token;
      assert(loginRes.status === 200 && adminToken, '5. Admin login succeeded');

      // Test C7: token expiry is 1 day (24h)
      const decoded = jwt.decode(adminToken);
      const expiryHours = (decoded.exp - decoded.iat) / 3600;
      assert(expiryHours === 24, `6. (C7) JWT access token expires in 1 day (got ${expiryHours}h)`);
    }

    if (workerUser) {
      assert(workerUser.password.startsWith('$2b$'), '7. (A1) Worker password in DB is hashed with bcrypt');

      const workerPass = 'worker_test_pass_123';
      const hash = await bcrypt.hash(workerPass, 10);
      await prisma.user.update({ where: { id: workerUser.id }, data: { password: hash } });

      const loginRes = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: workerUser.username,
          password: workerPass
        })
      });

      workerToken = loginRes.data.token;
      assert(loginRes.status === 200 && workerToken, '8. Worker login succeeded');
    }
  } catch (e) {
    assert(false, `Login test failed: ${e.message}`);
  }

  // 4. Test A4: Role authorization - Worker attempting Admin CRUD
  try {
    const res = await request('/api/vehicles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({
        noPolisi: 'B 9999 XYZ',
        barcode: 'BARCODE_TEST_9999'
      })
    });
    assert(res.status === 403, '9. (A4) Worker creating vehicle properly blocked with 403');
  } catch (e) {
    assert(false, `Worker vehicle creation error: ${e.message}`);
  }

  // 5. Test B4: Role authorization - Worker attempting to update handover status
  try {
    const res = await request('/api/handovers/dummy-id', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({
        status: 'Siap Operasi (Normal)'
      })
    });
    assert(res.status === 403, '10. (B4) Worker updating handover status properly blocked with 403');
  } catch (e) {
    assert(false, `Worker handover status update error: ${e.message}`);
  }

  // 6. Test A4: Admin CAN create, read, and delete a test vehicle
  try {
    const testPlate = 'TEST-' + Date.now().toString().slice(-4);
    const testBarcode = 'BAR-' + Date.now().toString().slice(-6);

    const createVehRes = await request('/api/vehicles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        noPolisi: testPlate,
        barcode: testBarcode,
        jenisKendaraan: 'Tangki 24KL',
        brand: 'Hino'
      })
    });

    assert(createVehRes.status === 201 && createVehRes.data.vehicle.noPolisi === testPlate, '11. Admin successfully created vehicle');

    // Test A5 with valid token
    const scanRes = await request(`/api/vehicles/scan/${testBarcode}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${workerToken}` }
    });
    assert(scanRes.status === 200 && scanRes.data.vehicle.noPolisi === testPlate, '12. (A5) Authenticated scan barcode succeeded');

    // Delete test vehicle
    const delRes = await request(`/api/vehicles/${createVehRes.data.vehicle.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(delRes.status === 200, '13. Admin successfully deleted test vehicle');
  } catch (e) {
    assert(false, `Admin vehicle CRUD test failed: ${e.message}`);
  }

  // 7. Test B1 & B6: Handover submission validation
  try {
    const invalidRes = await request('/api/handovers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({
        noPolisi: 'B 1234 ABC',
        shift: '08:00'
      })
    });
    assert(invalidRes.status === 400, '14. (B6) Validation rejected invalid handover submission with 400');
  } catch (e) {
    assert(false, `Handover validation test error: ${e.message}`);
  }

  // 8. Test B3: Notifications endpoint
  try {
    const notifRes = await request('/api/notifications', {
      method: 'GET',
      headers: { Authorization: `Bearer ${workerToken}` }
    });
    assert(notifRes.status === 200 && Array.isArray(notifRes.data.notifications), '15. (B3) Notifications retrieved for user');
  } catch (e) {
    assert(false, `Notifications test failed: ${e.message}`);
  }

  // 9. Test B7: Soft delete worker
  try {
    const tempUsername = 'temp_worker_' + Date.now();
    const createWorkerRes = await request('/api/workers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Temp Worker',
        username: tempUsername,
        password: 'password123',
        role: 'AMT'
      })
    });

    const tempWorkerId = createWorkerRes.data.worker.id;
    assert(createWorkerRes.status === 201 && tempWorkerId, '16. Created temporary worker for soft delete test');

    const deleteWorkerRes = await request(`/api/workers/${tempWorkerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(deleteWorkerRes.status === 200, '17. (B7) Worker deletion request succeeded');

    // Verify row still exists in DB with deletedAt set
    const dbUser = await prisma.user.findUnique({ where: { id: tempWorkerId } });
    assert(dbUser && dbUser.deletedAt !== null, '18. (B7) User is soft deleted (row preserved with deletedAt timestamp)');

    // Verify soft-deleted user is NOT returned in GET /api/workers
    const listRes = await request('/api/workers', {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const foundInList = listRes.data.some(w => w.id === tempWorkerId);
    assert(!foundInList, '19. (B7) Soft-deleted user is excluded from active workers list');

    // Cleanup: permanently remove temp user
    await prisma.user.delete({ where: { id: tempWorkerId } });
  } catch (e) {
    assert(false, `Soft delete test failed: ${e.message}`);
  }

  console.log(`\n=== HASIL PENGUJIAN: ${passed} PASSED, ${failed} FAILED ===`);
}

testAll().finally(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
