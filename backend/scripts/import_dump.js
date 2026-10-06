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

  // Regex to extract all INSERT INTO statements
  // Note: statements end with a semicolon
  const insertRegex = /INSERT INTO\s+`?(\w+)`?\s*\([^)]+\)\s*VALUES\s*([\s\S]*?);/gi;
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
    const safeSql = item.sql.replace(/^INSERT INTO/i, 'INSERT IGNORE INTO');
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
  console.log('Import completed successfully!');
}

importSql()
  .catch((e) => {
    console.error('Import failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
