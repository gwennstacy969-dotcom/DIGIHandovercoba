const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetPasswordsToUsername() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['AMT', 'USER'] }
    }
  });

  let count = 0;
  for (const user of users) {
    if (user.password !== user.username) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: user.username }
      });
      count++;
    }
  }
  console.log(`Berhasil mengubah password ${count} pekerja menjadi Nomor Induk Pekerja (NIP)-nya masing-masing.`);
  await prisma.$disconnect();
}

resetPasswordsToUsername().catch(console.error);
