const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDates() {
  console.log('--- Memeriksa dan Memperbaiki Tanggal Tidak Valid (0000-00-00) ---');

  const tablesWithDates = [
    { table: 'vehicle', cols: ['createdAt', 'updatedAt'] },
    { table: 'handover', cols: ['createdAt', 'updatedAt', 'timestamp'] },
    { table: 'checklistitem', cols: ['createdAt', 'updatedAt'] },
    { table: 'user', cols: ['createdAt', 'updatedAt'] },
    { table: 'issue', cols: ['createdAt', 'updatedAt'] },
    { table: 'notification', cols: ['createdAt'] },
    { table: 'password_reset_request', cols: ['createdAt', 'updatedAt'] },
    { table: 'email_notification_log', cols: ['createdAt', 'updatedAt', 'sentAt'] },
    { table: 'audit_log', cols: ['createdAt'] },
    { table: 'photo', cols: ['createdAt'] },
  ];

  for (const item of tablesWithDates) {
    for (const col of item.cols) {
      try {
        // Update any row where date is invalid or 0000-00-00 to CURRENT_TIMESTAMP
        const result = await prisma.$executeRawUnsafe(
          `UPDATE \`${item.table}\` SET \`${col}\` = NOW() WHERE CAST(\`${col}\` AS CHAR) LIKE '0000-00-00%' OR \`${col}\` IS NULL AND '${col}' != 'sentAt'`
        );
        if (result > 0) {
          console.log(`✓ Diperbaiki ${result} baris pada ${item.table}.${col}`);
        }
      } catch (err) {
        // Kolom mungkin tidak ada atau error lain
        try {
          const resultFallback = await prisma.$executeRawUnsafe(
            `UPDATE \`${item.table}\` SET \`${col}\` = NOW() WHERE \`${col}\` = '0000-00-00 00:00:00.000' OR \`${col}\` = '0000-00-00 00:00:00'`
          );
          if (resultFallback > 0) {
            console.log(`✓ Diperbaiki (fallback) ${resultFallback} baris pada ${item.table}.${col}`);
          }
        } catch (e) {
          console.log(`Info (${item.table}.${col}):`, e.message);
        }
      }
    }
  }

  console.log('Pemeriksaan tanggal selesai.');
}

fixDates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
