const prisma = require('./src/config/prisma');

async function checkIntegrity() {
  console.log('=== VERIFIKASI INTEGRITAS DATA ===\n');

  const checks = [
    {
      name: 'handover.userId -> user.id',
      query: `SELECT count(*) as cnt FROM handover h LEFT JOIN user u ON h.userId = u.id WHERE u.id IS NULL`
    },
    {
      name: 'handoveritem.handoverId -> handover.id',
      query: `SELECT count(*) as cnt FROM handoveritem hi LEFT JOIN handover h ON hi.handoverId = h.id WHERE h.id IS NULL`
    },
    {
      name: 'issue.handoverId -> handover.id',
      query: `SELECT count(*) as cnt FROM issue i LEFT JOIN handover h ON i.handoverId = h.id WHERE h.id IS NULL`
    },
    {
      name: 'photo.handoverId -> handover.id',
      query: `SELECT count(*) as cnt FROM photo p LEFT JOIN handover h ON p.handoverId = h.id WHERE h.id IS NULL`
    },
    {
      name: 'notification.targetUserId -> user.id',
      query: `SELECT count(*) as cnt FROM notification n LEFT JOIN user u ON n.targetUserId = u.id WHERE n.targetUserId IS NOT NULL AND u.id IS NULL`
    },
    {
      name: 'audit_log.userId -> user.id',
      query: `SELECT count(*) as cnt FROM audit_log a LEFT JOIN user u ON a.userId = u.id WHERE u.id IS NULL`
    },
    {
      name: 'password_reset_request.userId -> user.id',
      query: `SELECT count(*) as cnt FROM password_reset_request pr LEFT JOIN user u ON pr.userId = u.id WHERE u.id IS NULL`
    }
  ];

  let allOk = true;
  for (const c of checks) {
    const res = await prisma.$queryRawUnsafe(c.query);
    const count = Number(res[0]?.cnt || 0);
    if (count === 0) {
      console.log(`✅ ${c.name.padEnd(45)}: 0 orphaned rows`);
    } else {
      console.log(`❌ ${c.name.padEnd(45)}: ${count} ORPHANED ROWS!`);
      allOk = false;
    }
  }

  console.log('\nSample User Admin & Pengawas:');
  const keyUsers = await prisma.$queryRawUnsafe(`
    SELECT id, username, role, name FROM user WHERE role IN ('ADMIN', 'PENGAWAS')
  `);
  console.table(keyUsers);

  if (allOk) {
    console.log('\n🎉 SEMUA RELASI FOREIGN KEY DAN INTEGRITAS 100% VALID!');
  }
}

checkIntegrity()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
