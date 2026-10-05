const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');

async function setupCredentials() {
  const yoanHash = await bcrypt.hash('672023', 10);
  const haulaFatihaHash = await bcrypt.hash('240206', 10);
  const sekarHash = await bcrypt.hash('12345', 10);
  const adminHash = await bcrypt.hash('admin123', 10);
  const pengawasHash = await bcrypt.hash('pengawas123', 10);

  // 1. yoan (ADMIN)
  await prisma.user.upsert({
    where: { username: 'yoan' },
    update: { password: yoanHash, role: 'ADMIN', name: 'Yoan', deletedAt: null },
    create: { username: 'yoan', name: 'Yoan', password: yoanHash, role: 'ADMIN', jabatan: 'Supervisor Distribusi' }
  });
  console.log('✓ Akun "yoan" (ADMIN) diset password: "672023"');

  // 2. haulafatiha (ADMIN)
  await prisma.user.upsert({
    where: { username: 'haulafatiha' },
    update: { password: haulaFatihaHash, role: 'ADMIN', name: 'Haula Fatiha', deletedAt: null },
    create: { username: 'haulafatiha', name: 'Haula Fatiha', password: haulaFatihaHash, role: 'ADMIN', jabatan: 'Fleet Administrator' }
  });
  console.log('✓ Akun "haulafatiha" (ADMIN) diset password: "240206"');

  // 3. sekar (PENGAWAS)
  await prisma.user.upsert({
    where: { username: 'sekar' },
    update: { password: sekarHash, role: 'PENGAWAS', name: 'Sekar', deletedAt: null },
    create: { username: 'sekar', name: 'Sekar', password: sekarHash, role: 'PENGAWAS', jabatan: 'Pengawas Lapangan' }
  });
  console.log('✓ Akun "sekar" (PENGAWAS) diset password: "12345"');

  // 4. admin (ADMIN)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: adminHash, role: 'ADMIN', name: 'Administrator', deletedAt: null },
    create: { username: 'admin', name: 'Administrator', password: adminHash, role: 'ADMIN', jabatan: 'System Administrator' }
  });
  console.log('✓ Akun "admin" (ADMIN) diset password: "admin123"');

  // 5. pengawas (PENGAWAS)
  await prisma.user.upsert({
    where: { username: 'pengawas' },
    update: { password: pengawasHash, role: 'PENGAWAS', name: 'Pengawas Lapangan', deletedAt: null },
    create: { username: 'pengawas', name: 'Pengawas Lapangan', password: pengawasHash, role: 'PENGAWAS', jabatan: 'Pengawas Distribusi' }
  });
  console.log('✓ Akun "pengawas" (PENGAWAS) diset password: "pengawas123"');

  // 6. Sync AMT workers password = NIP
  const amtUsers = await prisma.user.findMany({
    where: { role: { in: ['AMT', 'USER'] } }
  });
  console.log(`Menyinkronkan ${amtUsers.length} pekerja AMT (password = NIP)...`);
  for (const amt of amtUsers) {
    const amtHash = await bcrypt.hash(amt.username, 10);
    await prisma.user.update({
      where: { id: amt.id },
      data: { password: amtHash, deletedAt: null }
    });
  }
  console.log('✓ Seluruh pekerja AMT berhasil disinkronkan (password = NIP).');
}

setupCredentials().finally(() => prisma.$disconnect());
