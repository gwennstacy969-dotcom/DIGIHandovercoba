const prisma = require('../src/config/prisma');
const { reconcileVehicleOperationalStatus } = require('../src/services/vehicleStatusService');

async function syncAllVehicleStatuses() {
  console.log('=== MEMULAI SINKRONISASI STATUS OPERASIONAL KENDARAAN ===');
  const vehicles = await prisma.vehicle.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Ditemukan ${vehicles.length} kendaraan di database.`);

  const summary = {
    total: vehicles.length,
    reconciledCount: 0,
    alreadyInSync: 0,
    toReadyToStart: 0,
    toActive: 0,
    toMaintenance: 0
  };

  for (const v of vehicles) {
    const oldStatus = v.status;
    const result = await reconcileVehicleOperationalStatus(v.noPolisi, prisma, { persist: true });

    if (result.wasReconciled) {
      summary.reconciledCount++;
      console.log(`[RECONCILE] ${v.noPolisi}: ${oldStatus} -> ${result.expectedStatus} (Last HO: ${result.lastHandover?.type || 'none'}, Major Issue: ${result.hasActiveMajorIssue})`);
    } else {
      summary.alreadyInSync++;
    }

    if (result.expectedStatus === 'READY_TO_START') summary.toReadyToStart++;
    else if (result.expectedStatus === 'Active') summary.toActive++;
    else if (result.expectedStatus === 'Maintenance') summary.toMaintenance++;
  }

  console.log('\n=== RINGKASAN SINKRONISASI ===');
  console.log(`Total Kendaraan: ${summary.total}`);
  console.log(`Diperbarui (Out of sync): ${summary.reconciledCount}`);
  console.log(`Sudah Sesuai: ${summary.alreadyInSync}`);
  console.log(`Status Akhir:`);
  console.log(`  - READY_TO_START : ${summary.toReadyToStart}`);
  console.log(`  - Active         : ${summary.toActive}`);
  console.log(`  - Maintenance    : ${summary.toMaintenance}`);
  console.log('========================================================\n');

  await prisma.$disconnect();
}

if (require.main === module) {
  syncAllVehicleStatuses()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Sinkronisasi gagal:', err);
      process.exit(1);
    });
}

module.exports = syncAllVehicleStatuses;
