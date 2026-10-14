const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function run() {
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, noPolisi: true, barcode: true }
  });
  console.log('Total vehicles in DB:', vehicles.length);

  const barcodesDir = path.resolve(__dirname, '../barcodes');
  const postersDir = path.resolve(__dirname, '../uploads/posters');

  let missing = [];
  vehicles.forEach(veh => {
    const fn1 = path.join(barcodesDir, `${veh.barcode}.png`);
    const fn2 = path.join(barcodesDir, `${veh.noPolisi.replace(/\s+/g, '')}.png`);
    const exists1 = fs.existsSync(fn1);
    const exists2 = fs.existsSync(fn2);
    if (!exists1 && !exists2) {
      missing.push({ noPolisi: veh.noPolisi, barcode: veh.barcode });
    }
  });

  console.log(`Vehicles without ANY barcode file in backend/barcodes: ${missing.length}`);
  if (missing.length > 0) {
    console.log('Missing list:', missing);
  }

  // Check how many poster files exist in data/posters_siap_cetak or backend/barcodes
  const posterSiapCetakDir = path.resolve(__dirname, '../../data/posters_siap_cetak');
  if (fs.existsSync(posterSiapCetakDir)) {
    const posters = fs.readdirSync(posterSiapCetakDir);
    console.log(`data/posters_siap_cetak contains ${posters.length} files`);
  } else {
    console.log(`data/posters_siap_cetak does NOT exist!`);
  }
}

run().catch(console.error);
