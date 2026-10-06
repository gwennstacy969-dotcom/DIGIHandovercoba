/**
 * Script Migrasi Menyeluruh ID Database dari CUID/UUID ke Format Bersih & Terstruktur
 * 
 * Target Format:
 * - user: USR-0001, USR-0002, ... (Admin & Pengawas di awal)
 * - handover: HO-YYYYMMDD-XXXX (Sudah selesai sebelumnya)
 * - handoveritem: HI-000001, HI-000002, ...
 * - issue: ISS-0001, ISS-0002, ...
 * - photo: PHT-00001, PHT-00002, ...
 * - notification: NTF-00001, NTF-00002, ...
 * - audit_log: LOG-00001, LOG-00002, ...
 * - password_reset_request: PRR-0001, PRR-0002, ...
 * - vehicle: VH-XXX (Cek jika ada yang belum)
 * - checklistitem: CHK-XX (Cek jika ada yang belum)
 */

const prisma = require('./src/config/prisma');

async function migrateAll() {
  console.log('===============================================================');
  console.log('   MIGRASI LENGKAP ID DATABASE: CUID/UUID → KODE BERSIH');
  console.log('===============================================================\n');

  // Matikan Foreign Key Checks
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  console.log('🔓 Foreign Key Checks DINONAKTIFKAN sementara.\n');

  try {
    // -------------------------------------------------------------
    // 1. MIGRASI TABEL USER
    // -------------------------------------------------------------
    console.log('1. Memeriksa tabel `user`...');
    const users = await prisma.$queryRawUnsafe(`
      SELECT id, username, role, name, createdAt 
      FROM \`user\` 
      ORDER BY 
        CASE 
          WHEN role = 'ADMIN' THEN 1 
          WHEN role = 'PENGAWAS' THEN 2 
          ELSE 3 
        END ASC,
        createdAt ASC,
        username ASC
    `);

    let userMigrated = 0;
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const targetId = `USR-${String(i + 1).padStart(4, '0')}`;
      if (u.id !== targetId) {
        // Update Foreign Keys
        await prisma.$executeRawUnsafe('UPDATE handover SET userId = ? WHERE userId = ?', targetId, u.id);
        await prisma.$executeRawUnsafe('UPDATE notification SET targetUserId = ? WHERE targetUserId = ?', targetId, u.id);
        await prisma.$executeRawUnsafe('UPDATE audit_log SET userId = ? WHERE userId = ?', targetId, u.id);
        await prisma.$executeRawUnsafe('UPDATE password_reset_request SET userId = ? WHERE userId = ?', targetId, u.id);
        await prisma.$executeRawUnsafe('UPDATE password_reset_request SET resetByAdminId = ? WHERE resetByAdminId = ?', targetId, u.id);
        await prisma.$executeRawUnsafe('UPDATE email_notification_log SET adminId = ? WHERE adminId = ?', targetId, u.id);
        // Update User
        await prisma.$executeRawUnsafe('UPDATE `user` SET id = ? WHERE id = ?', targetId, u.id);
        userMigrated++;
      }
    }
    console.log(`   ✅ Selesai tabel \`user\`: ${userMigrated} dari ${users.length} user dimigrasi ke USR-XXXX.\n`);

    // -------------------------------------------------------------
    // 2. MIGRASI TABEL ISSUE
    // -------------------------------------------------------------
    console.log('2. Memeriksa tabel `issue`...');
    const issues = await prisma.$queryRawUnsafe(`
      SELECT id, handoverId, createdAt FROM \`issue\` ORDER BY createdAt ASC
    `);

    let issueMigrated = 0;
    for (let i = 0; i < issues.length; i++) {
      const iss = issues[i];
      const targetId = `ISS-${String(i + 1).padStart(4, '0')}`;
      if (iss.id !== targetId) {
        // Update references di notification (actionId) & audit_log
        await prisma.$executeRawUnsafe("UPDATE notification SET actionId = ? WHERE actionType = 'VIEW_ISSUE' AND actionId = ?", targetId, iss.id);
        await prisma.$executeRawUnsafe('UPDATE audit_log SET actionId = ? WHERE actionId = ?', targetId, iss.id);
        // Update Issue
        await prisma.$executeRawUnsafe('UPDATE `issue` SET id = ? WHERE id = ?', targetId, iss.id);
        issueMigrated++;
      }
    }
    console.log(`   ✅ Selesai tabel \`issue\`: ${issueMigrated} dari ${issues.length} issue dimigrasi ke ISS-XXXX.\n`);

    // -------------------------------------------------------------
    // 3. MIGRASI TABEL PHOTO
    // -------------------------------------------------------------
    console.log('3. Memeriksa tabel `photo`...');
    const photos = await prisma.$queryRawUnsafe(`
      SELECT id, handoverId FROM \`photo\` ORDER BY handoverId ASC, id ASC
    `);

    let photoMigrated = 0;
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const targetId = `PHT-${String(i + 1).padStart(5, '0')}`;
      if (p.id !== targetId) {
        await prisma.$executeRawUnsafe('UPDATE `photo` SET id = ? WHERE id = ?', targetId, p.id);
        photoMigrated++;
      }
    }
    console.log(`   ✅ Selesai tabel \`photo\`: ${photoMigrated} dari ${photos.length} photo dimigrasi ke PHT-XXXXX.\n`);

    // -------------------------------------------------------------
    // 4. MIGRASI TABEL HANDOVERITEM
    // -------------------------------------------------------------
    console.log('4. Memeriksa tabel `handoveritem`...');
    const items = await prisma.$queryRawUnsafe(`
      SELECT id, handoverId FROM \`handoveritem\` ORDER BY handoverId ASC, id ASC
    `);

    let itemMigrated = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const targetId = `HI-${String(i + 1).padStart(6, '0')}`;
      if (it.id !== targetId) {
        await prisma.$executeRawUnsafe('UPDATE `handoveritem` SET id = ? WHERE id = ?', targetId, it.id);
        itemMigrated++;
      }
    }
    console.log(`   ✅ Selesai tabel \`handoveritem\`: ${itemMigrated} dari ${items.length} item dimigrasi ke HI-XXXXXX.\n`);

    // -------------------------------------------------------------
    // 5. MIGRASI TABEL NOTIFICATION
    // -------------------------------------------------------------
    console.log('5. Memeriksa tabel `notification`...');
    const notifs = await prisma.$queryRawUnsafe(`
      SELECT id, createdAt FROM \`notification\` ORDER BY createdAt ASC
    `);

    let notifMigrated = 0;
    for (let i = 0; i < notifs.length; i++) {
      const n = notifs[i];
      const targetId = `NTF-${String(i + 1).padStart(5, '0')}`;
      if (n.id !== targetId) {
        await prisma.$executeRawUnsafe('UPDATE `notification` SET id = ? WHERE id = ?', targetId, n.id);
        notifMigrated++;
      }
    }
    console.log(`   ✅ Selesai tabel \`notification\`: ${notifMigrated} dari ${notifs.length} notifikasi dimigrasi ke NTF-XXXXX.\n`);

    // -------------------------------------------------------------
    // 6. MIGRASI TABEL AUDIT_LOG
    // -------------------------------------------------------------
    console.log('6. Memeriksa tabel `audit_log`...');
    const logs = await prisma.$queryRawUnsafe(`
      SELECT id, createdAt FROM \`audit_log\` ORDER BY createdAt ASC
    `);

    let logMigrated = 0;
    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      const targetId = `LOG-${String(i + 1).padStart(5, '0')}`;
      if (l.id !== targetId) {
        await prisma.$executeRawUnsafe('UPDATE `audit_log` SET id = ? WHERE id = ?', targetId, l.id);
        logMigrated++;
      }
    }
    console.log(`   ✅ Selesai tabel \`audit_log\`: ${logMigrated} dari ${logs.length} audit log dimigrasi ke LOG-XXXXX.\n`);

    // -------------------------------------------------------------
    // 7. MIGRASI TABEL PASSWORD_RESET_REQUEST
    // -------------------------------------------------------------
    console.log('7. Memeriksa tabel `password_reset_request`...');
    const prrs = await prisma.$queryRawUnsafe(`
      SELECT id, createdAt FROM \`password_reset_request\` ORDER BY createdAt ASC
    `);

    let prrMigrated = 0;
    for (let i = 0; i < prrs.length; i++) {
      const r = prrs[i];
      const targetId = `PRR-${String(i + 1).padStart(4, '0')}`;
      if (r.id !== targetId) {
        await prisma.$executeRawUnsafe('UPDATE `password_reset_request` SET id = ? WHERE id = ?', targetId, r.id);
        prrMigrated++;
      }
    }
    console.log(`   ✅ Selesai tabel \`password_reset_request\`: ${prrMigrated} dari ${prrs.length} request dimigrasi ke PRR-XXXX.\n`);

    // -------------------------------------------------------------
    // 8. CEK TABEL VEHICLE & CHECKLISTITEM
    // -------------------------------------------------------------
    const nonVhVehicles = await prisma.$queryRawUnsafe(`
      SELECT id FROM \`vehicle\` WHERE id NOT LIKE 'VH-%'
    `);
    if (nonVhVehicles.length > 0) {
      console.log(`   ⚠️ Ada ${nonVhVehicles.length} kendaraan non-VH yang perlu dimigrasi...`);
      for (let i = 0; i < nonVhVehicles.length; i++) {
        const v = nonVhVehicles[i];
        const newId = `VH-${String(84 + i).padStart(3, '0')}`;
        await prisma.$executeRawUnsafe('UPDATE `vehicle` SET id = ? WHERE id = ?', newId, v.id);
      }
    } else {
      console.log('   ✅ Semua data kendaraan sudah menggunakan format VH-XXX.');
    }

    const nonChkItems = await prisma.$queryRawUnsafe(`
      SELECT id FROM \`checklistitem\` WHERE id NOT LIKE 'CHK-%'
    `);
    if (nonChkItems.length > 0) {
      console.log(`   ⚠️ Ada ${nonChkItems.length} checklist item non-CHK yang perlu dimigrasi...`);
      for (let i = 0; i < nonChkItems.length; i++) {
        const it = nonChkItems[i];
        const newId = `CHK-${String(25 + i).padStart(2, '0')}`;
        await prisma.$executeRawUnsafe('UPDATE `checklistitem` SET id = ? WHERE id = ?', newId, it.id);
      }
    } else {
      console.log('   ✅ Semua data checklist item sudah menggunakan format CHK-XX.');
    }

  } finally {
    // Aktifkan kembali Foreign Key Checks
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n🔒 Foreign Key Checks DIAKTIFKAN KEMBALI.');
  }

  console.log('\n===============================================================');
  console.log('   MIGRASI SELURUH TABEL DATABASE SELESAI DENGAN SUKSES!');
  console.log('===============================================================\n');
}

migrateAll()
  .catch(e => {
    console.error('❌ Error saat migrasi:', e);
    prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
  })
  .finally(() => prisma.$disconnect());
