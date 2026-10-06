const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

const fs = require('fs');
const amtFile = [
  path.join(__dirname, '..', '..', 'data', 'DAFTAR NAMA AMT 2026.xlsx'),
  path.join(__dirname, '..', '..', 'DAFTAR NAMA AMT 2026.xlsx'),
  path.join(__dirname, '..', 'DAFTAR NAMA AMT 2026.xlsx')
].find(p => fs.existsSync(p)) || path.join(__dirname, '..', '..', 'data', 'DAFTAR NAMA AMT 2026.xlsx');

const vehicleFile = [
  path.join(__dirname, '..', '..', 'data', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx'),
  path.join(__dirname, '..', '..', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx'),
  path.join(__dirname, '..', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx')
].find(p => fs.existsSync(p)) || path.join(__dirname, '..', '..', 'data', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx');

async function main() {
  console.log('Starting data reset and import...');

  try {
    // 1. DELETE ALL DATA
    console.log('Deleting existing Handovers, Vehicles, and AMT Users...');
    // Delete handovers (this will cascade delete HandoverItem, Photo, Issue)
    const deleteHandovers = await prisma.handover.deleteMany({});
    console.log(`Deleted ${deleteHandovers.count} Handovers (and associated items/photos/issues).`);

    const deleteVehicles = await prisma.vehicle.deleteMany({});
    console.log(`Deleted ${deleteVehicles.count} Vehicles.`);

    const deleteUsers = await prisma.user.deleteMany({
      where: {
        role: {
          in: ['AMT', 'USER']
        }
      }
    });
    console.log(`Deleted ${deleteUsers.count} AMT Users.`);

    // 2. IMPORT AMT
    console.log('Importing AMT Users from DAFTAR NAMA AMT 2026.xlsx...');
    const amtWorkbook = xlsx.readFile(amtFile);
    const amtSheet = amtWorkbook.Sheets[amtWorkbook.SheetNames[0]];
    const amtData = xlsx.utils.sheet_to_json(amtSheet, { header: 1 });
    
    let amtCount = 0;
    for (let i = 1; i < amtData.length; i++) {
      const row = amtData[i];
      if (!row || row.length < 4 || !row[1] || !row[3]) continue; // Skip empty/invalid rows

      const name = String(row[1]).trim();
      let username = String(row[3]).trim();
      
      // Some usernames might be numbers that get parsed as floats, clean them up
      username = username.replace(/\s+/g, '');

      if (!username || !name) continue;

      const passwordHash = await bcrypt.hash(username, 10);

      try {
        await prisma.user.upsert({
          where: { username },
          update: {
            name,
            password: passwordHash,
            role: 'AMT'
          },
          create: {
            username,
            name,
            password: passwordHash,
            role: 'AMT'
          }
        });
        amtCount++;
      } catch (err) {
        console.error(`Failed to insert AMT: ${name} (${username})`, err.message);
      }
    }
    console.log(`Successfully imported ${amtCount} AMT Users.`);

    // 3. IMPORT VEHICLES
    console.log('Importing Vehicles from Nomor Polisi Mobil Tanki dan Kapasitas.xlsx...');
    const vehicleWorkbook = xlsx.readFile(vehicleFile);
    const plateRegex = /^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{1,3}$/i;
    const vehicleMap = new Map(); // Plate -> Capacity

    for (const sheetName of vehicleWorkbook.SheetNames) {
      const sheet = vehicleWorkbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      data.forEach(row => {
        if (!row) return;
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (typeof cell === 'string' && plateRegex.test(cell.trim())) {
            const plate = cell.replace(/\s+/g, '').toUpperCase(); // Normalize plate (e.g., B1234XYZ)
            
            // Try to find capacity in the next cell
            let capacity = null;
            if (row[c+1]) {
               const nextVal = String(row[c+1]).trim();
               if (!isNaN(parseFloat(nextVal))) {
                 capacity = `${nextVal} KL`;
               }
            }
            
            if (!vehicleMap.has(plate) || (capacity && !vehicleMap.get(plate))) {
               vehicleMap.set(plate, capacity);
            }
          }
        }
      });
    }

    let vehicleCount = 0;
    for (const [plate, capacity] of vehicleMap.entries()) {
      try {
        await prisma.vehicle.upsert({
          where: { noPolisi: plate },
          update: {
            jenisKendaraan: capacity || 'MT',
            status: 'Active'
          },
          create: {
            noPolisi: plate,
            barcode: plate, // Use plate as barcode for now
            jenisKendaraan: capacity || 'MT',
            brand: '',
            status: 'Active' 
          }
        });
        vehicleCount++;
      } catch (err) {
        console.error(`Failed to insert Vehicle: ${plate}`, err.message);
      }
    }
    console.log(`Successfully imported ${vehicleCount} Vehicles.`);

    console.log('Import complete!');
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
