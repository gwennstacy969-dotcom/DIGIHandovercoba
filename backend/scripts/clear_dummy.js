const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Menghapus semua data dummy (noPolisi berawalan DUMMY)...");
  
  const dummyHandovers = await prisma.handover.findMany({
    where: { noPolisi: { startsWith: 'DUMMY' } },
    select: { id: true }
  });
  
  const dummyIds = dummyHandovers.map(h => h.id);
  
  if (dummyIds.length > 0) {
    console.log(`Ditemukan ${dummyIds.length} dummy handovers, menghapus relasi terkait...`);
    await prisma.issue.deleteMany({ where: { handoverId: { in: dummyIds } } });
    await prisma.handoverItem.deleteMany({ where: { handoverId: { in: dummyIds } } });
    await prisma.photo.deleteMany({ where: { handoverId: { in: dummyIds } } });
  }
  
  await prisma.passwordResetRequest.deleteMany({ where: { email: { startsWith: 'dummy' } } });
  
  const result = await prisma.handover.deleteMany({
    where: { noPolisi: { startsWith: 'DUMMY' } }
  });
  
  await prisma.user.deleteMany({ where: { username: { startsWith: 'dummy_' } } });
  
  console.log(`Sukses! ${result.count} data dummy handover dan semua relasinya berhasil dibersihkan dari database.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
