/**
 * Script untuk sinkronisasi data kendaraan dari Excel ke database.
 * - Update kapasitas & jenisKendaraan berdasarkan nopol yang sudah ada
 * - Tambah kendaraan baru yang belum ada di database
 * - Hapus kendaraan yang tidak ada di Excel
 * 
 * Usage: node scripts/sync_vehicles_from_excel.js
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const vehicleFile = [
  path.join(__dirname, '..', '..', 'data', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx'),
  path.join(__dirname, '..', '..', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx')
].find(p => fs.existsSync(p)) || path.join(__dirname, '..', '..', 'data', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx');
const barcodesDir = path.join(__dirname, '..', 'barcodes');

if (!fs.existsSync(barcodesDir)) {
  fs.mkdirSync(barcodesDir, { recursive: true });
}

function getJenisKendaraan(kapasitas) {
  if (kapasitas === 24) return 'Mobil Tanki 24 KL';
  if (kapasitas === 16) return 'Mobil Tanki 16 KL';
  if (kapasitas === 8) return 'Mobil Tanki 8 KL';
  return 'Mobil Tanki';
}

async function main() {
  // 1. Baca Excel
  const workbook = XLSX.readFile(vehicleFile);
  const sheet = workbook.Sheets['D. Pemasangan GPS sesuai fitur '];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const excelVehicles = [];
  for (let i = 7; i < data.length; i++) {
    const row = data[i];
    if (row && row[1] && typeof row[1] === 'string' && row[1].trim()) {
      excelVehicles.push({
        nopol: row[1].trim(),
        kapasitas: row[2] || null
      });
    }
  }

  console.log(`📋 Data dari Excel: ${excelVehicles.length} kendaraan`);

  // 2. Ambil semua kendaraan di database
  const dbVehicles = await prisma.vehicle.findMany();
  const dbMap = new Map(dbVehicles.map(v => [v.noPolisi, v]));
  const excelNopolSet = new Set(excelVehicles.map(v => v.nopol));

  let created = 0, updated = 0, deleted = 0, skipped = 0;

  // 3. Upsert: Update yang ada, tambah yang baru
  for (const ev of excelVehicles) {
    const existing = dbMap.get(ev.nopol);
    const jenisKendaraan = getJenisKendaraan(ev.kapasitas);

    if (existing) {
      // Update kapasitas dan jenisKendaraan jika berbeda
      if (existing.kapasitas !== ev.kapasitas || existing.jenisKendaraan !== jenisKendaraan) {
        await prisma.vehicle.update({
          where: { id: existing.id },
          data: { 
            kapasitas: ev.kapasitas,
            jenisKendaraan 
          }
        });
        console.log(`  ✏️  Updated: ${ev.nopol} → ${jenisKendaraan} (${ev.kapasitas} KL)`);
        updated++;
      } else {
        skipped++;
      }
    } else {
      // Tambah baru - barcode = noPolisi
      const barcode = ev.nopol;
      const vehicle = await prisma.vehicle.create({
        data: {
          noPolisi: ev.nopol,
          barcode,
          jenisKendaraan,
          kapasitas: ev.kapasitas,
          brand: 'Pertamina',
          status: 'READY_TO_START'
        }
      });

      // Generate QR Code
      const qrPath = path.join(barcodesDir, `${barcode}.png`);
      await QRCode.toFile(qrPath, barcode, {
        errorCorrectionLevel: 'H',
        width: 1024,
        margin: 4,
        color: { dark: '#000000', light: '#FFFFFF' }
      });

      console.log(`  ✅ Created: ${ev.nopol} → ${jenisKendaraan} (${ev.kapasitas} KL)`);
      created++;
    }
  }

  // 4. Hapus kendaraan yang tidak ada di Excel
  for (const dbv of dbVehicles) {
    if (!excelNopolSet.has(dbv.noPolisi)) {
      await prisma.vehicle.delete({ where: { id: dbv.id } });
      // Hapus QR code file
      const qrPath = path.join(barcodesDir, `${dbv.barcode}.png`);
      if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
      console.log(`  🗑️  Deleted: ${dbv.noPolisi} (tidak ada di Excel)`);
      deleted++;
    }
  }

  console.log(`\n📊 Ringkasan:`);
  console.log(`  ✅ Created: ${created}`);
  console.log(`  ✏️  Updated: ${updated}`);
  console.log(`  ⏭️  Skipped (sudah sesuai): ${skipped}`);
  console.log(`  🗑️  Deleted: ${deleted}`);
  console.log(`  📦 Total di database sekarang: ${excelVehicles.length}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  prisma.$disconnect();
  process.exit(1);
});
