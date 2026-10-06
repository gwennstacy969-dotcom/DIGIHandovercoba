const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function clearHandovers() {
  console.log('Clearing all handovers and issues from database...');
  await prisma.issue.deleteMany({});
  const result = await prisma.handover.deleteMany({});
  console.log(`Deleted ${result.count} handover records and all issues.`);

  // Reset vehicle status back to Active since there are no more active issues
  console.log('Resetting all vehicle statuses to Active...');
  const vResult = await prisma.vehicle.updateMany({
    data: { status: 'Active' }
  });
  console.log(`Reset ${vResult.count} vehicles.`);

  console.log('Clearing uploads folder...');
  const uploadsDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    let deletedCount = 0;
    for (const file of files) {
      if (file !== '.gitkeep' && file !== 'dummy.txt') {
        fs.unlinkSync(path.join(uploadsDir, file));
        deletedCount++;
      }
    }
    console.log(`Deleted ${deletedCount} files in uploads directory.`);
  }

  console.log('Done.');
}

clearHandovers()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
