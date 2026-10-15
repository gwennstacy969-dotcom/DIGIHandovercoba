const { assertNotProduction } = require('./_production_guard');
assertNotProduction('clean_all_handover_reports_and_notifications.js');

const prisma = require('../src/config/prisma');

async function cleanAllReportsAndNotifications() {
  try {
    console.log('--- MEMULAI PEMBERSIHAN DATA RIWAYAT HANDOVER & NOTIFIKASI ---');

    // 1. Hapus EmailNotificationLog
    const deletedEmailLogs = await prisma.emailNotificationLog.deleteMany({});
    console.log(`✓ Email notification logs dihapus: ${deletedEmailLogs.count}`);

    // 2. Hapus Photo
    const deletedPhotos = await prisma.photo.deleteMany({});
    console.log(`✓ Foto dokumentasi handover dihapus: ${deletedPhotos.count}`);

    // 3. Hapus Issue (Isu Kendaraan)
    const deletedIssues = await prisma.issue.deleteMany({});
    console.log(`✓ Isu kendaraan dihapus: ${deletedIssues.count}`);

    // 4. Hapus AmtIssue (Kepatuhan AMT)
    const deletedAmtIssues = await prisma.amtIssue.deleteMany({});
    console.log(`✓ Isu kepatuhan AMT dihapus: ${deletedAmtIssues.count}`);

    // 5. Hapus HandoverItem (Checklist Items)
    const deletedItems = await prisma.handoverItem.deleteMany({});
    console.log(`✓ Item checklist inspeksi dihapus: ${deletedItems.count}`);

    // 6. Hapus Handover (Riwayat Handover Utama)
    const deletedHandovers = await prisma.handover.deleteMany({});
    console.log(`✓ Riwayat handover utama dihapus: ${deletedHandovers.count}`);

    // 7. Hapus Notification (Pesan & Notifikasi)
    const deletedNotifications = await prisma.notification.deleteMany({});
    console.log(`✓ Pesan & notifikasi sistem dihapus: ${deletedNotifications.count}`);

    // 8. Reset status armada mobil tangki ke 'Active' (siap operasi kembali)
    const updatedVehicles = await prisma.vehicle.updateMany({
      where: { status: { in: ['DIBLOKIR', 'Maintenance', 'READY_TO_START'] } },
      data: { status: 'Active' }
    });
    console.log(`✓ Status kendaraan di-reset ke 'Active': ${updatedVehicles.count} unit`);

    console.log('\n--- VERIFIKASI SISA DATA ---');
    const [hCount, issCount, aiCount, notifCount, userCount, vehicleCount] = await Promise.all([
      prisma.handover.count(),
      prisma.issue.count(),
      prisma.amtIssue.count(),
      prisma.notification.count(),
      prisma.user.count(),
      prisma.vehicle.count()
    ]);

    console.log(`Riwayat Handover : ${hCount}`);
    console.log(`Isu Kendaraan    : ${issCount}`);
    console.log(`Isu Kepatuhan AMT: ${aiCount}`);
    console.log(`Pesan/Notifikasi : ${notifCount}`);
    console.log(`Master User      : ${userCount} (Tetap Aman)`);
    console.log(`Master Kendaraan : ${vehicleCount} (Tetap Aman)`);
    console.log('\n✅ PEMBERSIHAN SELESAI DENGAN SEMPURNA!');
  } catch (error) {
    console.error('❌ Gagal membersihkan data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAllReportsAndNotifications();
