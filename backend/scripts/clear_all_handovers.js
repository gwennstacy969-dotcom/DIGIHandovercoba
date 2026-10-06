const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Menghapus SEMUA data handover dan relasinya...");
  
  await prisma.issue.deleteMany();
  await prisma.handoverItem.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.notification.deleteMany();
  
  const result = await prisma.handover.deleteMany();
  
  // Reset vehicle statuses to READY_TO_START
  await prisma.vehicle.updateMany({
    data: { status: 'READY_TO_START' }
  });
  
  console.log(`Sukses! ${result.count} data handover dan relasinya berhasil dibersihkan. Status semua mobil dikembalikan ke READY_TO_START.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
