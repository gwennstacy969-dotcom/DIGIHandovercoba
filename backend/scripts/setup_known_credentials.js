const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');

async function setupCredentials() {
  const hashHaula = await bcrypt.hash('240206', 10);
  const hashYoan = await bcrypt.hash('672023', 10);
  const hashSekar = await bcrypt.hash('12345', 10);
  const hashAdmin = await bcrypt.hash('admin123', 10);

  // 1. Upsert haulafatiha (Admin) sesuai README
  await prisma.user.upsert({
    where: { username: 'haulafatiha' },
    update: { password: hashHaula, role: 'ADMIN', deletedAt: null },
    create: {
      username: 'haulafatiha',
      name: 'Haula Fatiha',
      password: hashHaula,
      role: 'ADMIN',
      jabatan: 'Administrator'
    }
  });
  console.log('Akun "haulafatiha" (ADMIN) diset password: "240206"');

  // 2. Upsert yoan (Admin / Super Admin) sesuai README
  await prisma.user.upsert({
    where: { username: 'yoan' },
    update: { password: hashYoan, role: 'SUPER_ADMIN', deletedAt: null },
    create: {
      username: 'yoan',
      name: 'Yoan',
      password: hashYoan,
      role: 'SUPER_ADMIN',
      jabatan: 'Administrator'
    }
  });
  console.log('Akun "yoan" (SUPER_ADMIN) diset password: "672023"');

  // 3. Upsert sekar (Pengawas) sesuai README
  await prisma.user.upsert({
    where: { username: 'sekar' },
    update: { password: hashSekar, role: 'PENGAWAS', deletedAt: null },
    create: {
      username: 'sekar',
      name: 'Sekar',
      password: hashSekar,
      role: 'PENGAWAS',
      jabatan: 'Pengawas Lapangan'
    }
  });
  console.log('Akun "sekar" (PENGAWAS) diset password: "12345"');

  // 4. Upsert admin cadangan
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: hashAdmin, role: 'SUPER_ADMIN', deletedAt: null },
    create: {
      username: 'admin',
      name: 'Administrator',
      password: hashAdmin,
      role: 'SUPER_ADMIN',
      jabatan: 'Fleet Supervisor'
    }
  });
  console.log('Akun "admin" (SUPER_ADMIN) diset password: "admin123"');
}

setupCredentials().finally(() => prisma.$disconnect());

