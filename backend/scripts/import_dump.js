const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function importSql() {
  const sqlPath = [
    path.resolve(__dirname, '../../data/handover_pertamina.sql'),
    path.resolve(__dirname, '../../handover_pertamina.sql'),
    path.resolve(__dirname, '../handover_pertamina.sql')
  ].find(p => fs.existsSync(p)) || path.resolve(__dirname, '../../data/handover_pertamina.sql');
  console.log('Reading SQL file from:', sqlPath);

  if (!fs.existsSync(sqlPath)) {
    console.error('File not found:', sqlPath);
    return;
  }

  const content = fs.readFileSync(sqlPath, 'utf8');

  // Regex to extract all INSERT INTO statements (with or without column list)
  // Note: statements end with a semicolon
  const insertRegex = /INSERT INTO\s+`?(\w+)`?\s*(?:\([^)]+\))?\s*VALUES\s*([\s\S]*?);/gi;
  let match;
  const inserts = [];

  while ((match = insertRegex.exec(content)) !== null) {
    const fullStatement = match[0];
    const tableName = match[1];
    inserts.push({ tableName, sql: fullStatement });
  }

  console.log(`Found ${inserts.length} INSERT statements.`);

  // Disable foreign key checks first
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

  for (const item of inserts) {
    // Replace INSERT INTO with INSERT IGNORE INTO to prevent duplicate key errors
    let safeSql = item.sql.replace(/^INSERT INTO/i, 'INSERT IGNORE INTO');
    if (item.tableName.toLowerCase() === 'handover' && !safeSql.includes('(`id`')) {
      safeSql = safeSql.replace(
        /^INSERT IGNORE INTO\s+`?handover`?\s*VALUES/i,
        'INSERT IGNORE INTO `handover` (`id`, `noPolisi`, `shift`, `status`, `locationLat`, `locationLng`, `timestamp`, `userId`, `createdAt`, `updatedAt`, `type`, `amt1`, `amt2`) VALUES'
      );
    }
    try {
      console.log(`Importing data into table: ${item.tableName}...`);
      await prisma.$executeRawUnsafe(safeSql);
      console.log(`✓ Table ${item.tableName} imported successfully.`);
    } catch (err) {
      console.error(`Error importing into ${item.tableName}:`, err.message);
    }
  }

  // Re-enable foreign key checks
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');

  // Sync known credentials from README
  const bcrypt = require('bcrypt');
  console.log('\n--- Menyinkronkan Kredensial Pengguna Sesuai README ---');
  const knownAccounts = [
    { username: 'yoan', pass: '672023', role: 'ADMIN', name: 'Yoan' },
    { username: 'haulafatiha', pass: '240206', role: 'ADMIN', name: 'Haula Fatiha' },
    { username: 'sekar', pass: '12345', role: 'PENGAWAS', name: 'Sekar' },
    { username: 'admin', pass: 'admin123', role: 'ADMIN', name: 'Administrator' },
    { username: 'pengawas', pass: 'pengawas123', role: 'PENGAWAS', name: 'Pengawas Lapangan' },
  ];

  for (const acc of knownAccounts) {
    const hash = await bcrypt.hash(acc.pass, 10);
    await prisma.user.upsert({
      where: { username: acc.username },
      update: { password: hash, role: acc.role, name: acc.name, deletedAt: null },
      create: { username: acc.username, password: hash, role: acc.role, name: acc.name }
    });
    console.log(`✓ Akun ${acc.role} '${acc.username}' aktif (password: '${acc.pass}').`);
  }

  // Sync password AMT to NIP
  const amtUsers = await prisma.user.findMany({
    where: { role: { in: ['AMT', 'USER'] } }
  });
  console.log(`Menyinkronkan ${amtUsers.length} pekerja AMT (password = NIP)...`);
  for (const amt of amtUsers) {
    const amtHash = await bcrypt.hash(amt.username, 10);
    await prisma.user.update({
      where: { id: amt.id },
      data: { password: amtHash, deletedAt: null }
    });
  }
  console.log(`✓ Seluruh pekerja AMT berhasil disinkronkan (password = NIP).`);

  // Sanitize any 0000-00-00 dates to prevent Prisma DateTime errors
  try {
    await prisma.$executeRawUnsafe(`UPDATE \`vehicle\` SET \`updatedAt\` = NOW() WHERE CAST(\`updatedAt\` AS CHAR) LIKE '0000-00-00%'`);
    await prisma.$executeRawUnsafe(`UPDATE \`issue\` SET \`updatedAt\` = NOW() WHERE CAST(\`updatedAt\` AS CHAR) LIKE '0000-00-00%'`);
    await prisma.$executeRawUnsafe(`UPDATE \`notification\` SET \`createdAt\` = NOW() WHERE CAST(\`createdAt\` AS CHAR) LIKE '0000-00-00%'`);
  } catch (dateErr) {
    console.warn('Non-critical date sanitization note:', dateErr.message);
  }

  // Check counts
  const usersCount = await prisma.user.count();
  const vehiclesCount = await prisma.vehicle.count();
  const handoversCount = await prisma.handover.count();
  const itemsCount = await prisma.handoverItem.count();
  const photosCount = await prisma.photo.count();

  console.log('\n--- Current Database Summary ---');
  console.log(`Users: ${usersCount}`);
  console.log(`Vehicles: ${vehiclesCount}`);
  console.log(`Handovers: ${handoversCount}`);
  console.log(`Handover Items: ${itemsCount}`);
  console.log(`Photos: ${photosCount}`);
  console.log('--------------------------------');
  console.log('Import & Setup completed successfully!');
}

importSql()
  .catch((e) => {
    console.error('Import failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
