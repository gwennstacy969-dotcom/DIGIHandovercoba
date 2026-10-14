const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function syncBarcodes() {
  const barcodesDir = path.join(__dirname, '..', 'barcodes');
  
  if (!fs.existsSync(barcodesDir)) {
    fs.mkdirSync(barcodesDir, { recursive: true });
  }

  // 1. Ambil seluruh data kendaraan dari database
  const vehicles = await prisma.vehicle.findMany();
  // Kumpulan nama file yang valid
  const validFiles = new Set();
  for (const vehicle of vehicles) {
    const rawPlate = vehicle.noPolisi.replace(/\s+/g, '');
    const targets = [vehicle.barcode, rawPlate];
    if (vehicle.barcode && vehicle.barcode.startsWith('BC_')) {
      targets.push(vehicle.barcode.replace(/^BC_/, ''));
    }
    targets.forEach(t => {
      if (t) validFiles.add(`${t}.png`);
    });
  }

  // 2. Buat QR code .png untuk setiap target
  for (const filename of validFiles) {
    const qrData = filename.replace(/\.png$/, '');
    const filePath = path.join(barcodesDir, filename);
    try {
      await QRCode.toFile(filePath, qrData, {
        errorCorrectionLevel: 'H',
        width: 1024,
        margin: 4,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      console.log(`✅ Barcode siap: ${filename}`);
    } catch (err) {
      console.error(`❌ Gagal membuat QR code untuk ${filename}:`, err);
    }
  }

  // 3. Hapus file-file lama di folder barcodes yang tidak terdaftar di database
  const existingFiles = fs.readdirSync(barcodesDir);
  let deletedCount = 0;

  for (const file of existingFiles) {
    if (!validFiles.has(file)) {
      const filePath = path.join(barcodesDir, file);
      fs.unlinkSync(filePath);
      console.log(`🗑️ Menghapus file lama/tidak relevan: ${file}`);
      deletedCount++;
    }
  }

  console.log(`\nSinkronisasi selesai. ${vehicles.length} barcode aktif, ${deletedCount} file lama dihapus.`);
}

syncBarcodes()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
