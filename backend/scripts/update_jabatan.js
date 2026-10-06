const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const fs = require('fs');
const amtFile = [
  path.join(__dirname, '..', '..', 'data', 'DAFTAR NAMA AMT 2026.xlsx'),
  path.join(__dirname, '..', '..', 'DAFTAR NAMA AMT 2026.xlsx'),
  path.join(__dirname, '..', 'DAFTAR NAMA AMT 2026.xlsx')
].find(p => fs.existsSync(p)) || path.join(__dirname, '..', '..', 'data', 'DAFTAR NAMA AMT 2026.xlsx');

async function main() {
  console.log('Updating Jabatan...');
  const amtWorkbook = xlsx.readFile(amtFile);
  const amtSheet = amtWorkbook.Sheets[amtWorkbook.SheetNames[0]];
  const amtData = xlsx.utils.sheet_to_json(amtSheet, { header: 1 });
  
  let count = 0;
  for (let i = 1; i < amtData.length; i++) {
    const row = amtData[i];
    if (!row || row.length < 4 || !row[1] || !row[3]) continue;

    let username = String(row[3]).trim().replace(/\s+/g, '');
    let jabatan = row[4] ? String(row[4]).trim() : null;

    if (jabatan && username) {
      // Use raw query because prisma client might not have jabatan yet
      try {
        await prisma.$executeRaw`UPDATE user SET jabatan = ${jabatan} WHERE username = ${username}`;
        count++;
      } catch (e) {
        console.error('Failed to update:', username, e.message);
      }
    }
  }
  console.log(`Successfully updated jabatan for ${count} users.`);
}

main().finally(() => prisma.$disconnect());
