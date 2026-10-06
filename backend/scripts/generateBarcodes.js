const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function syncBarcodes() {
  const barcodesDir = path.join(__dirname, 'barcodes');
  
  if (!fs.existsSync(barcodesDir)) {
    fs.mkdirSync(barcodesDir, { recursive: true });
  }

  // 1. Ambil seluruh data kendaraan dari database
  const vehicles = await prisma.vehicle.findMany();
  console.log(`Ditemukan ${vehicles.length} kendaraan di database:`);
  vehicles.forEach(v => console.log(` - Plat: ${v.noPolisi}, Barcode: ${v.barcode}`));

  // Kumpulan nama file yang valid (format: <barcode>.png)
  const validFiles = new Set(vehicles.map(v => `${v.barcode}.png`));

  // 2. Buat QR code .png untuk setiap kendaraan yang ada di database
  for (const vehicle of vehicles) {
    const qrData = vehicle.barcode;
    const filePath = path.join(barcodesDir, `${qrData}.png`);
    
    try {
      await QRCode.toFile(filePath, qrData, {
        errorCorrectionLevel: 'H',
        width: 1024,
        margin: 4,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      console.log(`✅ Barcode siap: ${qrData}.png (Plat: ${vehicle.noPolisi})`);
    } catch (err) {
      console.error(`❌ Gagal membuat QR code untuk ${qrData}:`, err);
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
