/**
 * Script untuk merapikan ID pada tabel master database:
 * 1. Tabel Vehicle: 'VH-001' s/d 'VH-083' (sesuai nomor urut Data MT Pola Sewa)
 * 2. Tabel ChecklistItem: 'CHK-01' s/d 'CHK-24' (Kategori A: CHK-01..15, Kategori B: CHK-16..24)
 * 
 * Usage: node scripts/tidy_master_ids.js
 */
const XLSX = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const fs = require('fs');
const excelPath = [
  path.join(__dirname, '..', '..', 'data', 'Data MT Pola Sewa.xlsx'),
  path.join(__dirname, '..', '..', 'Data MT Pola Sewa.xlsx')
].find(p => fs.existsSync(p)) || path.join(__dirname, '..', '..', 'data', 'Data MT Pola Sewa.xlsx');

async function main() {
  console.log('🚀 Memulai perapian ID tabel master database...\n');

  // ==========================================
  // 1. MERAPIKAN TABEL VEHICLE (VH-001 .. VH-083)
  // ==========================================
  console.log('--- 1. MERAPIKAN TABEL VEHICLE ---');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Ambil urutan nopol sesuai baris Excel (Row 7 s/d max)
  const excelOrder = [];
  for (let i = 6; i < data.length; i++) {
    const row = data[i];
    if (row && row[1]) {
      const cleanNo = String(row[1]).replace(/\s+/g, '').toUpperCase();
      excelOrder.push(cleanNo);
    }
  }

  const allVehicles = await prisma.vehicle.findMany();
  console.log(`Ditemukan ${allVehicles.length} kendaraan di DB.`);

  let vhUpdated = 0;
  for (let idx = 0; idx < excelOrder.length; idx++) {
    const nopolTarget = excelOrder[idx];
    const newId = `VH-${String(idx + 1).padStart(3, '0')}`;
    const vehicle = allVehicles.find(v => v.noPolisi.replace(/\s+/g, '').toUpperCase() === nopolTarget);

    if (vehicle) {
      await prisma.$executeRawUnsafe(
        'UPDATE `vehicle` SET `id` = ? WHERE `noPolisi` = ?',
        newId,
        vehicle.noPolisi
      );
      vhUpdated++;
      console.log(`  🚗 [${newId}] ${vehicle.noPolisi} (${vehicle.brand || '-'})`);
    } else {
      console.log(`  ⚠️ Plat ${nopolTarget} tidak ditemukan di database`);
    }
  }
  console.log(`✅ Selesai merapikan ${vhUpdated} ID kendaraan.\n`);

  // ==========================================
  // 2. MERAPIKAN TABEL CHECKLIST ITEM (CHK-01 .. CHK-24)
  // ==========================================
  console.log('--- 2. MERAPIKAN TABEL CHECKLIST ITEM ---');
  const checklistItems = await prisma.checklistItem.findMany({
    orderBy: [
      { category: 'asc' },
      { name: 'asc' }
    ]
  });

  console.log(`Ditemukan ${checklistItems.length} item checklist di DB.`);
  let chkUpdated = 0;
  for (let idx = 0; idx < checklistItems.length; idx++) {
    const item = checklistItems[idx];
    const newId = `CHK-${String(idx + 1).padStart(2, '0')}`;

    await prisma.$executeRawUnsafe(
      'UPDATE `checklistitem` SET `id` = ? WHERE `name` = ? AND `category` = ?',
      newId,
      item.name,
      item.category
    );
    chkUpdated++;
    console.log(`  📋 [${newId}] (Kat ${item.category}) ${item.name} [${item.severity}]`);
  }
  console.log(`✅ Selesai merapikan ${chkUpdated} ID checklist item.\n`);

  // ==========================================
  // 3. VERIFIKASI AKHIR
  // ==========================================
  console.log('--- 3. VERIFIKASI HASIL ID TERBARU ---');
  const sampleVehicles = await prisma.vehicle.findMany({
    take: 5,
    orderBy: { id: 'asc' },
    select: { id: true, noPolisi: true, brand: true }
  });
  console.log('Sample Vehicle IDs:', sampleVehicles);

  const sampleChecklists = await prisma.checklistItem.findMany({
    take: 5,
    orderBy: { id: 'asc' },
    select: { id: true, category: true, name: true }
  });
  console.log('Sample Checklist IDs:', sampleChecklists);

  console.log('\n🎉 Seluruh ID tabel master berhasil dirapikan dengan sempurna!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
