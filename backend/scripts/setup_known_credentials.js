const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');

async function setupCredentials() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const pengawasHash = await bcrypt.hash('pengawas123', 10);
  const haulaHash = await bcrypt.hash('haula123', 10);

  // 1. Update yoan (Super Admin)
  const yoan = await prisma.user.findUnique({ where: { username: 'yoan' } });
  if (yoan) {
    await prisma.user.update({
      where: { username: 'yoan' },
      data: { password: adminHash, deletedAt: null }
    });
    console.log('Akun "yoan" (SUPER_ADMIN) diset password: "admin123"');
  }

  // 2. Update haula (Pengawas)
  const haula = await prisma.user.findUnique({ where: { username: 'haula' } });
  if (haula) {
    await prisma.user.update({
      where: { username: 'haula' },
      data: { password: haulaHash, deletedAt: null }
    });
    console.log('Akun "haula" (PENGAWAS) diset password: "haula123"');
  }

  // 3. Upsert admin (SUPER_ADMIN) sesuai README
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!admin) {
    await prisma.user.create({
      data: {
        username: 'admin',
        name: 'Administrator',
        password: adminHash,
        role: 'SUPER_ADMIN',
        jabatan: 'Fleet Supervisor'
      }
    });
    console.log('Akun "admin" (SUPER_ADMIN) dibuat dengan password: "admin123"');
  } else {
    await prisma.user.update({
      where: { username: 'admin' },
      data: { password: adminHash, deletedAt: null }
    });
    console.log('Akun "admin" (SUPER_ADMIN) diset password: "admin123"');
  }

  // 4. Upsert pengawas (PENGAWAS) sesuai README
  const pengawas = await prisma.user.findUnique({ where: { username: 'pengawas' } });
  if (!pengawas) {
    await prisma.user.create({
      data: {
        username: 'pengawas',
        name: 'Pengawas Lapangan',
        password: pengawasHash,
        role: 'PENGAWAS',
        jabatan: 'Pengawas Distribusi'
      }
    });
    console.log('Akun "pengawas" (PENGAWAS) dibuat dengan password: "pengawas123"');
  } else {
    await prisma.user.update({
      where: { username: 'pengawas' },
      data: { password: pengawasHash, deletedAt: null }
    });
    console.log('Akun "pengawas" (PENGAWAS) diset password: "pengawas123"');
  }
}

setupCredentials().finally(() => prisma.$disconnect());
