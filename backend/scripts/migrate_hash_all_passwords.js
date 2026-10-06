const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');

async function migrateAllPasswords() {
  console.log('--- Memulai migrasi hash password semua pengguna ---');
  
  const users = await prisma.user.findMany({
    select: { id: true, username: true, password: true, role: true }
  });

  const unhashed = users.filter(u => !u.password.startsWith('$2b$') && !u.password.startsWith('$2a$'));
  console.log(`Ditemukan ${unhashed.length} pengguna dengan password plain-text dari total ${users.length} pengguna.`);

  let updatedCount = 0;
  for (const user of unhashed) {
    try {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      updatedCount++;
      if (updatedCount % 25 === 0 || updatedCount === unhashed.length) {
        console.log(`Progress: ${updatedCount}/${unhashed.length} pengguna telah di-hash.`);
      }
    } catch (err) {
      console.error(`Gagal hash user ${user.username} (${user.id}):`, err.message);
    }
  }

  console.log(`Selesai! Berhasil meng-hash ${updatedCount} akun.`);
}

migrateAllPasswords()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
