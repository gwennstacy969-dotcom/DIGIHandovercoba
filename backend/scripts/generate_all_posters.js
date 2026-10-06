const path = require('path');
const fs = require('fs');
const prisma = require('../src/config/prisma');
const { generateQrPosterBuffer } = require('../src/utils/qrPosterGenerator');

async function main() {
  console.log('====================================================');
  console.log('  GENERATE SELURUH POSTER QR CODE KENDARAAN (83 TRUK)');
  console.log('====================================================\n');

  const outputDir = path.resolve(__dirname, '../../data/posters_siap_cetak');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const vehicles = await prisma.vehicle.findMany({
    orderBy: { noPolisi: 'asc' }
  });

  console.log(`Memproses ${vehicles.length} kendaraan...\n`);

  let successCount = 0;
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    const cleanPlate = v.noPolisi.replace(/\s+/g, '');
    const filename = `QR_Handover_${cleanPlate}.png`;
    const targetPath = path.join(outputDir, filename);

    try {
      const buffer = await generateQrPosterBuffer(v.noPolisi, v.barcode);
      fs.writeFileSync(targetPath, buffer);
      successCount++;
      console.log(`[${i + 1}/${vehicles.length}] ✅ Berhasil: ${filename} (Plat: ${v.noPolisi})`);
    } catch (err) {
      console.error(`[${i + 1}/${vehicles.length}] ❌ Gagal ${v.noPolisi}:`, err.message);
    }
  }

  console.log(`\n🎉 Selesai! Sebanyak ${successCount} poster berhasil dibuat di:`);
  console.log(outputDir);
}

main().finally(() => prisma.$disconnect());
