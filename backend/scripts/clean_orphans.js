const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanOrphans() {
  console.log('Cleaning up orphaned records...');
  
  // Ambil semua handoverId yang valid
  const handovers = await prisma.handover.findMany({ select: { id: true } });
  const validHandoverIds = handovers.map(h => h.id);
  
  // Hapus HandoverItem yatim piatu
  const deletedItems = await prisma.handoverItem.deleteMany({
    where: {
      handoverId: { notIn: validHandoverIds }
    }
  });
  console.log(`Deleted ${deletedItems.count} orphaned HandoverItems.`);

  // Hapus Photo yatim piatu
  const deletedPhotos = await prisma.photo.deleteMany({
    where: {
      handoverId: { notIn: validHandoverIds }
    }
  });
  console.log(`Deleted ${deletedPhotos.count} orphaned Photos.`);

  // Hapus Issue yatim piatu
  const deletedIssues = await prisma.issue.deleteMany({
    where: {
      handoverId: { notIn: validHandoverIds }
    }
  });
  console.log(`Deleted ${deletedIssues.count} orphaned Issues.`);

  console.log('Cleanup complete!');
  await prisma.$disconnect();
}

cleanOrphans().catch(console.error);
