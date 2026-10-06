const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixVehicleStatus() {
  // Find all active issues
  const activeIssues = await prisma.issue.findMany({
    where: {
      status: { in: ['ONGOING', 'PENDING_APPROVAL'] }
    },
    include: {
      handover: {
        include: {
          items: true
        }
      }
    }
  });

  let updatedCount = 0;

  for (const issue of activeIssues) {
    if (!issue.handover) continue;
    
    // Check if any broken item is MAJOR
    const hasMajor = issue.handover.items.some(item => 
      !item.isGood && item.name.includes('[MAJOR]')
    );

    if (hasMajor) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { noPolisi: issue.handover.noPolisi }
      });

      if (vehicle && vehicle.status !== 'Maintenance') {
        await prisma.vehicle.update({
          where: { noPolisi: vehicle.noPolisi },
          data: { status: 'Maintenance' }
        });
        console.log(`Blocked vehicle ${vehicle.noPolisi} (status -> Maintenance) due to Issue ID ${issue.id}`);
        updatedCount++;
      }
    }
  }

  console.log(`Fixed status for ${updatedCount} vehicles.`);
}

fixVehicleStatus().catch(console.error).finally(() => prisma.$disconnect());
