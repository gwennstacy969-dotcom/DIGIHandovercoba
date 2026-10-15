const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

async function verify() {
  try {
    const wb = xlsx.readFile(path.join(__dirname, '..', '..', 'data', 'DAFTAR NAMA AMT 2026.xlsx'));
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const excelUsers = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[1] || !r[3]) continue;
      const nip = String(r[3]).trim().replace(/\s+/g, '');
      const name = String(r[1]).trim();
      const jbt = r[4] ? String(r[4]).trim() : '';
      excelUsers.push({ nip, name, jbt });
    }

    console.log('--- HASIL PENGECEKAN DATA SEEDER VS DATABASE ---');
    console.log(`Total akun AMT di file Seeder (Excel): ${excelUsers.length}`);

    const dbUsers = await prisma.user.findMany({
      select: { id: true, username: true, role: true, name: true, jabatan: true, deletedAt: true }
    });
    console.log(`Total seluruh user di Database: ${dbUsers.length}`);

    const dbUserMap = new Map();
    dbUsers.forEach(u => dbUserMap.set(u.username.toLowerCase(), u));

    const missing = [];
    excelUsers.forEach(u => {
      const dbUser = dbUserMap.get(u.nip.toLowerCase());
      if (!dbUser) {
        missing.push(u);
      }
    });

    console.log(`Jumlah akun AMT yang belum ada di database: ${missing.length}`);
    if (missing.length > 0) {
      console.log('Daftar yang belum masuk:');
      missing.forEach((m, idx) => console.log(`  ${idx + 1}. [${m.nip}] ${m.name}`));
    } else {
      console.log('>> SEMUA 334 user AMT dari seeder SUDAH MASUK ke database (100% lengkap)! <<');
    }

    // Role breakdown
    const roleStats = {};
    dbUsers.forEach(u => {
      roleStats[u.role] = (roleStats[u.role] || 0) + 1;
    });
    console.log('\nDistribusi Role di Database:');
    for (const [role, count] of Object.entries(roleStats)) {
      console.log(`- ${role}: ${count} pengguna`);
    }

    // Daftar Admin & Pengawas
    const adminsAndPengawas = dbUsers.filter(u => ['ADMIN', 'PENGAWAS'].includes(u.role));
    console.log('\nDaftar Admin & Pengawas di Database:');
    adminsAndPengawas.forEach(u => {
      console.log(`- [${u.role}] ${u.name} (username: ${u.username})`);
    });

  } catch (err) {
    console.error('Error saat verifikasi:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
