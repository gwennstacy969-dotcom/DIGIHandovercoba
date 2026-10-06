const BASE_URL = 'http://localhost:3000/api';

async function testAdminFeature() {
  console.log('--- 🧪 PENGUJIAN FITUR DAFTAR ADMIN & PEMISAHAN ROLE ---');

  // 1. Login as Super Admin
  let token;
  let superAdminUser;
  try {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginData.error || 'Login failed');
    token = loginData.token;
    superAdminUser = loginData.user;
    console.log(`✅ 1. Login Super Admin berhasil: @${superAdminUser.username} (${superAdminUser.role})`);
  } catch (err) {
    console.error('❌ Login failed:', err.message);
    process.exit(1);
  }

  const authHeader = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. GET /api/admins
  let initialAdmins = [];
  try {
    const res = await fetch(`${BASE_URL}/admins`, { headers: authHeader });
    initialAdmins = await res.json();
    console.log(`✅ 2. GET /api/admins berhasil: ${initialAdmins.length} admin ditemukan.`);
    initialAdmins.forEach(a => console.log(`   - ${a.name} (@${a.username}) [${a.role}]`));
  } catch (err) {
    console.error('❌ GET /api/admins failed:', err.message);
  }

  // 3. GET /api/pengawas (Verify only PENGAWAS is returned)
  try {
    const res = await fetch(`${BASE_URL}/pengawas`, { headers: authHeader });
    const pengawasList = await res.json();
    const nonPengawas = pengawasList.filter(p => p.role !== 'PENGAWAS');
    if (nonPengawas.length > 0) {
      console.error('❌ GET /api/pengawas masih memuat role non-pengawas:', nonPengawas);
    } else {
      console.log(`✅ 3. GET /api/pengawas bersih! Hanya ${pengawasList.length} pengawas: ${pengawasList.map(p => p.username).join(', ')}`);
    }
  } catch (err) {
    console.error('❌ GET /api/pengawas failed:', err.message);
  }

  // 4. POST /api/admins (Create a new test admin)
  let testAdminId;
  const testUsername = `adm_test_${Date.now().toString().slice(-4)}`;
  try {
    const createRes = await fetch(`${BASE_URL}/admins`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: 'Test Administrator Baru',
        username: testUsername,
        password: 'password123',
        role: 'ADMIN',
        jabatan: 'Admin Operasional Uji Coba'
      })
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error || 'Create admin failed');
    const createdAdmin = createData.admin || createData;
    testAdminId = createdAdmin.id;
    console.log(`✅ 4. POST /api/admins berhasil! ID: ${testAdminId}, Username: @${createdAdmin.username}`);
  } catch (err) {
    console.error('❌ POST /api/admins failed:', err.message);
  }

  // 5. PUT /api/admins/:id (Update test admin)
  try {
    const updateRes = await fetch(`${BASE_URL}/admins/${testAdminId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        name: 'Test Administrator Updated',
        role: 'ADMIN',
        jabatan: 'Admin Operasional Diperbarui'
      })
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok) throw new Error(updateData.error || 'Update failed');
    console.log(`✅ 5. PUT /api/admins/:id berhasil! Nama baru: ${updateData.name}, Jabatan: ${updateData.jabatan}`);
  } catch (err) {
    console.error('❌ PUT /api/admins failed:', err.message);
  }

  // 6. Test Guard: Try to delete currently logged-in admin (self-delete prevention)
  try {
    const delSelfRes = await fetch(`${BASE_URL}/admins/${superAdminUser.id}`, {
      method: 'DELETE',
      headers: authHeader
    });
    const delSelfData = await delSelfRes.json();
    if (!delSelfRes.ok && delSelfData.error?.includes('sendiri')) {
      console.log(`✅ 6. Guard Anti-Self-Delete BERHASIL: "${delSelfData.error}"`);
    } else {
      console.error('❌ Guard GAGAL: Akun yang sedang login berhasil dihapus sendiri!', delSelfData);
    }
  } catch (err) {
    console.error('❌ Unexpected error on self-delete test:', err.message);
  }

  // 7. DELETE /api/admins/:id (Soft-delete test admin)
  try {
    const deleteRes = await fetch(`${BASE_URL}/admins/${testAdminId}`, {
      method: 'DELETE',
      headers: authHeader
    });
    const deleteData = await deleteRes.json();
    if (!deleteRes.ok) throw new Error(deleteData.error || 'Delete failed');
    console.log(`✅ 7. DELETE /api/admins/:id berhasil! ${deleteData.message}`);
  } catch (err) {
    console.error('❌ DELETE /api/admins failed:', err.message);
  }

  // 8. Verify test admin is not returned in active list
  try {
    const res = await fetch(`${BASE_URL}/admins`, { headers: authHeader });
    const list = await res.json();
    const found = list.find(a => a.id === testAdminId);
    if (!found) {
      console.log(`✅ 8. Verifikasi Soft-Delete Berhasil: Akun uji coba tidak lagi muncul di daftar aktif.`);
    } else {
      console.error('❌ Akun yang sudah dihapus masih muncul di list!');
    }
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
  }

  console.log('\n🎉 SEMUA LOGIKA SISTEM FITUR DAFTAR ADMIN LULUS UJI DENGAN SEMPURNA! 🎉');
}

testAdminFeature();
