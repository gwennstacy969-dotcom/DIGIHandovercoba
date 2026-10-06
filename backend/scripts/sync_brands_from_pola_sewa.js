/**
 * Script untuk sinkronisasi MERK kendaraan dari Data MT Pola Sewa.xlsx ke database.
 * 
 * Usage: node scripts/sync_brands_from_pola_sewa.js
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
  console.log(`📖 Membaca file: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Baris header berada pada index 5 (Row 6)
  // Col 1: NOPOL, Col 3: Kapasitas KL, Col 8: Type, Col 16: MERK
  const excelVehicles = new Map();
  for (let i = 6; i < data.length; i++) {
    const row = data[i];
    if (row && row[1]) {
      const nopolClean = String(row[1]).replace(/\s+/g, '').toUpperCase();
      const merk = row[16] ? String(row[16]).trim() : '';
      const kap = row[3] ? Number(row[3]) : null;
      const type = row[8] ? String(row[8]).trim() : '';
      excelVehicles.set(nopolClean, {
        rawNopol: String(row[1]).trim(),
        merk,
        kap,
        type
      });
    }
  }

  console.log(`📊 Total kendaraan di Excel: ${excelVehicles.size}`);

  const dbVehicles = await prisma.vehicle.findMany();
  console.log(`📦 Total kendaraan di DB: ${dbVehicles.length}`);

  let updatedCount = 0;
  for (const v of dbVehicles) {
    const cleanNo = v.noPolisi.replace(/\s+/g, '').toUpperCase();
    const excelData = excelVehicles.get(cleanNo);

    if (excelData && excelData.merk) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: {
          brand: excelData.merk,
          kapasitas: excelData.kap !== null ? excelData.kap : v.kapasitas,
          jenisKendaraan: excelData.kap ? `Mobil Tanki ${excelData.kap} KL` : v.jenisKendaraan
        }
      });
      console.log(`✅ [${v.noPolisi}] Brand: "${excelData.merk}" | Kapasitas: ${excelData.kap || v.kapasitas} KL`);
      updatedCount++;
    } else {
      console.log(`⚠️ [${v.noPolisi}] Tidak ada data merk di Excel`);
    }
  }

  console.log(`\n🎉 Selesai! Berhasil memperbarui ${updatedCount} dari ${dbVehicles.length} kendaraan.`);
}

main()
  .catch((e) => {
    console.error('❌ Error saat sinkronisasi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
