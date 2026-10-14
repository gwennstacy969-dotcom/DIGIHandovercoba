const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

async function main() {
  const outputPath = path.join(__dirname, '..', '..', 'handover_full_dump.sql');
  let sql = '';

  // Header
  sql += '-- ============================================================\n';
  sql += '-- DIGI HANDOVER - FULL DATABASE DUMP\n';
  sql += `-- Generated: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n`;
  sql += '-- Database: MySQL (InnoDB)\n';
  sql += '-- ============================================================\n\n';
  sql += 'SET NAMES utf8mb4;\n';
  sql += 'SET FOREIGN_KEY_CHECKS = 0;\n';
  sql += 'SET SQL_MODE = \'NO_AUTO_VALUE_ON_ZERO\';\n\n';

  // ============ 1. USERS ============
  console.log('Extracting users...');
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: user (${users.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`user\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`username\` VARCHAR(191) NOT NULL,
  \`password\` VARCHAR(191) NOT NULL,
  \`role\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`jabatan\` VARCHAR(191) NULL DEFAULT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  \`refreshToken\` TEXT NULL DEFAULT NULL,
  \`fcmToken\` VARCHAR(191) NULL DEFAULT NULL,
  \`deletedAt\` DATETIME(3) NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`User_username_key\`(\`username\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (users.length > 0) {
    sql += 'INSERT INTO `user` (`id`, `username`, `password`, `role`, `name`, `jabatan`, `createdAt`, `updatedAt`, `refreshToken`, `fcmToken`, `deletedAt`) VALUES\n';
    sql += users.map(u =>
      `(${escapeSQL(u.id)}, ${escapeSQL(u.username)}, ${escapeSQL(u.password)}, ${escapeSQL(u.role)}, ${escapeSQL(u.name)}, ${escapeSQL(u.jabatan)}, ${escapeSQL(u.createdAt)}, ${escapeSQL(u.updatedAt)}, ${escapeSQL(u.refreshToken)}, ${escapeSQL(u.fcmToken)}, ${escapeSQL(u.deletedAt)})`
    ).join(',\n') + ';\n\n';
  }

  // ============ 2. VEHICLES ============
  console.log('Extracting vehicles...');
  const vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: vehicle (${vehicles.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`vehicle\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`noPolisi\` VARCHAR(191) NOT NULL,
  \`barcode\` VARCHAR(191) NOT NULL,
  \`jenisKendaraan\` VARCHAR(191) NULL DEFAULT NULL,
  \`kapasitas\` INT NULL DEFAULT NULL,
  \`brand\` VARCHAR(191) NULL DEFAULT NULL,
  \`status\` VARCHAR(191) NOT NULL DEFAULT 'Active',
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`Vehicle_noPolisi_key\`(\`noPolisi\`),
  UNIQUE INDEX \`Vehicle_barcode_key\`(\`barcode\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (vehicles.length > 0) {
    sql += 'INSERT INTO `vehicle` (`id`, `noPolisi`, `barcode`, `jenisKendaraan`, `kapasitas`, `brand`, `status`, `createdAt`, `updatedAt`) VALUES\n';
    sql += vehicles.map(v =>
      `(${escapeSQL(v.id)}, ${escapeSQL(v.noPolisi)}, ${escapeSQL(v.barcode)}, ${escapeSQL(v.jenisKendaraan)}, ${escapeSQL(v.kapasitas)}, ${escapeSQL(v.brand)}, ${escapeSQL(v.status)}, ${escapeSQL(v.createdAt)}, ${escapeSQL(v.updatedAt)})`
    ).join(',\n') + ';\n\n';
  }

  // ============ 3. CHECKLIST ITEMS ============
  console.log('Extracting checklist items...');
  const checklists = await prisma.checklistItem.findMany({ orderBy: { createdAt: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: checklistitem (${checklists.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`checklistitem\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`category\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`severity\` VARCHAR(191) NOT NULL DEFAULT 'Minor',
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (checklists.length > 0) {
    sql += 'INSERT INTO `checklistitem` (`id`, `category`, `name`, `severity`, `createdAt`, `updatedAt`) VALUES\n';
    sql += checklists.map(c =>
      `(${escapeSQL(c.id)}, ${escapeSQL(c.category)}, ${escapeSQL(c.name)}, ${escapeSQL(c.severity)}, ${escapeSQL(c.createdAt)}, ${escapeSQL(c.updatedAt)})`
    ).join(',\n') + ';\n\n';
  }

  // ============ 4. HANDOVERS ============
  console.log('Extracting handovers...');
  const handovers = await prisma.handover.findMany({ orderBy: { createdAt: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: handover (${handovers.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`handover\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`handoverNo\` VARCHAR(50) NULL DEFAULT NULL,
  \`noPolisi\` VARCHAR(50) NOT NULL,
  \`shift\` VARCHAR(191) NOT NULL,
  \`status\` VARCHAR(50) NOT NULL,
  \`type\` VARCHAR(191) NOT NULL DEFAULT 'mulai',
  \`locationLat\` DOUBLE NULL DEFAULT NULL,
  \`locationLng\` DOUBLE NULL DEFAULT NULL,
  \`amt1\` VARCHAR(100) NULL DEFAULT NULL,
  \`amt2\` VARCHAR(100) NULL DEFAULT NULL,
  \`timestamp\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`notes\` TEXT NULL DEFAULT NULL,
  \`userId\` VARCHAR(191) NOT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  INDEX \`Handover_userId_fkey\`(\`userId\`),
  INDEX \`handover_createdAt_status_noPolisi_idx\`(\`createdAt\`, \`status\`, \`noPolisi\`),
  CONSTRAINT \`Handover_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (handovers.length > 0) {
    sql += 'INSERT INTO `handover` (`id`, `handoverNo`, `noPolisi`, `shift`, `status`, `type`, `locationLat`, `locationLng`, `amt1`, `amt2`, `timestamp`, `notes`, `userId`, `createdAt`, `updatedAt`) VALUES\n';
    sql += handovers.map(h =>
      `(${escapeSQL(h.id)}, ${escapeSQL(h.handoverNo)}, ${escapeSQL(h.noPolisi)}, ${escapeSQL(h.shift)}, ${escapeSQL(h.status)}, ${escapeSQL(h.type)}, ${escapeSQL(h.locationLat)}, ${escapeSQL(h.locationLng)}, ${escapeSQL(h.amt1)}, ${escapeSQL(h.amt2)}, ${escapeSQL(h.timestamp)}, ${escapeSQL(h.notes)}, ${escapeSQL(h.userId)}, ${escapeSQL(h.createdAt)}, ${escapeSQL(h.updatedAt)})`
    ).join(',\n') + ';\n\n';
  }

  // ============ 5. HANDOVER ITEMS ============
  console.log('Extracting handover items...');
  const items = await prisma.handoverItem.findMany({ orderBy: { handoverId: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: handoveritem (${items.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`handoveritem\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`category\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`isGood\` TINYINT(1) NOT NULL,
  \`handoverId\` VARCHAR(191) NOT NULL,
  \`severity\` VARCHAR(191) NULL DEFAULT NULL,
  \`notes\` VARCHAR(191) NULL DEFAULT NULL,
  \`repairNote\` VARCHAR(191) NULL DEFAULT NULL,
  \`repairPhotoUrl\` VARCHAR(191) NULL DEFAULT NULL,
  \`isRepaired\` TINYINT(1) NOT NULL DEFAULT 0,
  \`adminRejectionNote\` VARCHAR(191) NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  INDEX \`HandoverItem_handoverId_fkey\`(\`handoverId\`),
  CONSTRAINT \`HandoverItem_handoverId_fkey\` FOREIGN KEY (\`handoverId\`) REFERENCES \`handover\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (items.length > 0) {
    // Batch insert in chunks of 100 to avoid too long SQL statements
    const chunkSize = 100;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      sql += 'INSERT INTO `handoveritem` (`id`, `category`, `name`, `isGood`, `handoverId`, `severity`, `notes`, `repairNote`, `repairPhotoUrl`, `isRepaired`, `adminRejectionNote`) VALUES\n';
      sql += chunk.map(it =>
        `(${escapeSQL(it.id)}, ${escapeSQL(it.category)}, ${escapeSQL(it.name)}, ${escapeSQL(it.isGood)}, ${escapeSQL(it.handoverId)}, ${escapeSQL(it.severity)}, ${escapeSQL(it.notes)}, ${escapeSQL(it.repairNote)}, ${escapeSQL(it.repairPhotoUrl)}, ${escapeSQL(it.isRepaired)}, ${escapeSQL(it.adminRejectionNote)})`
      ).join(',\n') + ';\n\n';
    }
  }

  // ============ 6. ISSUES ============
  console.log('Extracting issues...');
  const issues = await prisma.issue.findMany({ orderBy: { createdAt: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: issue (${issues.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`issue\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`handoverId\` VARCHAR(191) NOT NULL,
  \`status\` VARCHAR(191) NOT NULL DEFAULT 'ONGOING',
  \`resolvedAt\` DATETIME(3) NULL DEFAULT NULL,
  \`repairRequestedAt\` DATETIME(3) NULL DEFAULT NULL,
  \`resolvedBy\` VARCHAR(191) NULL DEFAULT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`Issue_handoverId_key\`(\`handoverId\`),
  CONSTRAINT \`Issue_handoverId_fkey\` FOREIGN KEY (\`handoverId\`) REFERENCES \`handover\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (issues.length > 0) {
    sql += 'INSERT INTO `issue` (`id`, `handoverId`, `status`, `resolvedAt`, `repairRequestedAt`, `resolvedBy`, `createdAt`, `updatedAt`) VALUES\n';
    sql += issues.map(i =>
      `(${escapeSQL(i.id)}, ${escapeSQL(i.handoverId)}, ${escapeSQL(i.status)}, ${escapeSQL(i.resolvedAt)}, ${escapeSQL(i.repairRequestedAt)}, ${escapeSQL(i.resolvedBy)}, ${escapeSQL(i.createdAt)}, ${escapeSQL(i.updatedAt)})`
    ).join(',\n') + ';\n\n';
  }

  // ============ 7. AMT ISSUES ============
  console.log('Extracting AMT issues...');
  const amtIssues = await prisma.amtIssue.findMany({ orderBy: { createdAt: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: amt_issue (${amtIssues.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`amt_issue\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`handoverId\` VARCHAR(191) NOT NULL,
  \`userId\` VARCHAR(191) NULL DEFAULT NULL,
  \`amtName\` VARCHAR(191) NOT NULL,
  \`amtRole\` VARCHAR(191) NULL DEFAULT 'AMT_1',
  \`itemName\` VARCHAR(191) NOT NULL,
  \`category\` VARCHAR(191) NOT NULL DEFAULT 'B',
  \`status\` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  \`notes\` TEXT NULL DEFAULT NULL,
  \`actionTaken\` TEXT NULL DEFAULT NULL,
  \`resolvedAt\` DATETIME(3) NULL DEFAULT NULL,
  \`resolvedBy\` VARCHAR(191) NULL DEFAULT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  INDEX \`amt_issue_handoverId_idx\`(\`handoverId\`),
  INDEX \`amt_issue_userId_idx\`(\`userId\`),
  INDEX \`amt_issue_status_idx\`(\`status\`),
  CONSTRAINT \`amt_issue_handoverId_fkey\` FOREIGN KEY (\`handoverId\`) REFERENCES \`handover\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`amt_issue_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (amtIssues.length > 0) {
    sql += 'INSERT INTO `amt_issue` (`id`, `handoverId`, `userId`, `amtName`, `amtRole`, `itemName`, `category`, `status`, `notes`, `actionTaken`, `resolvedAt`, `resolvedBy`, `createdAt`, `updatedAt`) VALUES\n';
    sql += amtIssues.map(a =>
      `(${escapeSQL(a.id)}, ${escapeSQL(a.handoverId)}, ${escapeSQL(a.userId)}, ${escapeSQL(a.amtName)}, ${escapeSQL(a.amtRole)}, ${escapeSQL(a.itemName)}, ${escapeSQL(a.category)}, ${escapeSQL(a.status)}, ${escapeSQL(a.notes)}, ${escapeSQL(a.actionTaken)}, ${escapeSQL(a.resolvedAt)}, ${escapeSQL(a.resolvedBy)}, ${escapeSQL(a.createdAt)}, ${escapeSQL(a.updatedAt)})`
    ).join(',\n') + ';\n\n';
  }

  // ============ 8. PHOTOS ============
  console.log('Extracting photos...');
  const photos = await prisma.photo.findMany({ orderBy: { handoverId: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: photo (${photos.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`photo\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`type\` VARCHAR(191) NOT NULL,
  \`url\` VARCHAR(191) NOT NULL,
  \`thumbnailUrl\` VARCHAR(191) NULL DEFAULT NULL,
  \`previewUrl\` VARCHAR(191) NULL DEFAULT NULL,
  \`originalSize\` INT NULL DEFAULT NULL,
  \`handoverId\` VARCHAR(191) NOT NULL,
  PRIMARY KEY (\`id\`),
  INDEX \`Photo_handoverId_fkey\`(\`handoverId\`),
  CONSTRAINT \`Photo_handoverId_fkey\` FOREIGN KEY (\`handoverId\`) REFERENCES \`handover\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (photos.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < photos.length; i += chunkSize) {
      const chunk = photos.slice(i, i + chunkSize);
      sql += 'INSERT INTO `photo` (`id`, `type`, `url`, `thumbnailUrl`, `previewUrl`, `originalSize`, `handoverId`) VALUES\n';
      sql += chunk.map(p =>
        `(${escapeSQL(p.id)}, ${escapeSQL(p.type)}, ${escapeSQL(p.url)}, ${escapeSQL(p.thumbnailUrl)}, ${escapeSQL(p.previewUrl)}, ${escapeSQL(p.originalSize)}, ${escapeSQL(p.handoverId)})`
      ).join(',\n') + ';\n\n';
    }
  }

  // ============ 9. NOTIFICATIONS ============
  console.log('Extracting notifications...');
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: notification (${notifications.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`notification\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`title\` VARCHAR(191) NOT NULL,
  \`message\` TEXT NOT NULL,
  \`isRead\` TINYINT(1) NOT NULL DEFAULT 0,
  \`type\` VARCHAR(191) NOT NULL DEFAULT 'INFO',
  \`targetRole\` VARCHAR(191) NULL DEFAULT 'ADMIN',
  \`targetUserId\` VARCHAR(191) NULL DEFAULT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`actionType\` VARCHAR(191) NULL DEFAULT NULL,
  \`actionId\` VARCHAR(191) NULL DEFAULT NULL,
  \`noPolisi\` VARCHAR(191) NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  INDEX \`notification_targetUserId_idx\`(\`targetUserId\`),
  INDEX \`notification_targetRole_idx\`(\`targetRole\`),
  CONSTRAINT \`notification_targetUserId_fkey\` FOREIGN KEY (\`targetUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (notifications.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize);
      sql += 'INSERT INTO `notification` (`id`, `title`, `message`, `isRead`, `type`, `targetRole`, `targetUserId`, `createdAt`, `actionType`, `actionId`, `noPolisi`) VALUES\n';
      sql += chunk.map(n =>
        `(${escapeSQL(n.id)}, ${escapeSQL(n.title)}, ${escapeSQL(n.message)}, ${escapeSQL(n.isRead)}, ${escapeSQL(n.type)}, ${escapeSQL(n.targetRole)}, ${escapeSQL(n.targetUserId)}, ${escapeSQL(n.createdAt)}, ${escapeSQL(n.actionType)}, ${escapeSQL(n.actionId)}, ${escapeSQL(n.noPolisi)})`
      ).join(',\n') + ';\n\n';
    }
  }

  // ============ 10. AUDIT LOGS ============
  console.log('Extracting audit logs...');
  const auditLogs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
  sql += '-- ============================================================\n';
  sql += `-- TABLE: audit_log (${auditLogs.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`audit_log\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`userId\` VARCHAR(191) NOT NULL,
  \`action\` VARCHAR(191) NOT NULL,
  \`details\` TEXT NULL DEFAULT NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`actionType\` VARCHAR(191) NULL DEFAULT NULL,
  \`actionId\` VARCHAR(191) NULL DEFAULT NULL,
  \`noPolisi\` VARCHAR(191) NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (auditLogs.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < auditLogs.length; i += chunkSize) {
      const chunk = auditLogs.slice(i, i + chunkSize);
      sql += 'INSERT INTO `audit_log` (`id`, `userId`, `action`, `details`, `createdAt`, `actionType`, `actionId`, `noPolisi`) VALUES\n';
      sql += chunk.map(a =>
        `(${escapeSQL(a.id)}, ${escapeSQL(a.userId)}, ${escapeSQL(a.action)}, ${escapeSQL(a.details)}, ${escapeSQL(a.createdAt)}, ${escapeSQL(a.actionType)}, ${escapeSQL(a.actionId)}, ${escapeSQL(a.noPolisi)})`
      ).join(',\n') + ';\n\n';
    }
  }

  // ============ 11. SYSTEM SETTINGS ============
  console.log('Extracting system settings...');
  const settings = await prisma.systemSetting.findMany();
  sql += '-- ============================================================\n';
  sql += `-- TABLE: system_setting (${settings.length} rows)\n`;
  sql += '-- ============================================================\n';
  sql += `CREATE TABLE IF NOT EXISTS \`system_setting\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`key\` VARCHAR(191) NOT NULL,
  \`value\` TEXT NULL DEFAULT NULL,
  \`updatedAt\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`system_setting_key_key\`(\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  if (settings.length > 0) {
    sql += 'INSERT INTO `system_setting` (`id`, `key`, `value`, `updatedAt`) VALUES\n';
    sql += settings.map(s =>
      `(${escapeSQL(s.id)}, ${escapeSQL(s.key)}, ${escapeSQL(s.value)}, ${escapeSQL(s.updatedAt)})`
    ).join(',\n') + ';\n\n';
  }

  // Footer
  sql += 'SET FOREIGN_KEY_CHECKS = 1;\n\n';
  sql += '-- ============================================================\n';
  sql += '-- END OF DUMP\n';
  sql += '-- ============================================================\n';

  // Write file
  fs.writeFileSync(outputPath, sql, 'utf8');
  
  const fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log('\n========================================');
  console.log('DUMP SELESAI!');
  console.log('========================================');
  console.log(`File: ${outputPath}`);
  console.log(`Ukuran: ${fileSizeKB} KB`);
  console.log('');
  console.log('Ringkasan data:');
  console.log(`  Users:          ${users.length}`);
  console.log(`  Vehicles:       ${vehicles.length}`);
  console.log(`  Checklists:     ${checklists.length}`);
  console.log(`  Handovers:      ${handovers.length}`);
  console.log(`  Handover Items: ${items.length}`);
  console.log(`  Issues:         ${issues.length}`);
  console.log(`  AMT Issues:     ${amtIssues.length}`);
  console.log(`  Photos:         ${photos.length}`);
  console.log(`  Notifications:  ${notifications.length}`);
  console.log(`  Audit Logs:     ${auditLogs.length}`);
  console.log(`  Settings:       ${settings.length}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
