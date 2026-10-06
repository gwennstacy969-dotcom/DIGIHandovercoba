const xlsx = require('xlsx');
const path = require('path');

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

try {
  console.log("--- AMT FILE ---");
  const amtWorkbook = xlsx.readFile(amtFile);
  const amtSheetName = amtWorkbook.SheetNames[0];
  const amtSheet = amtWorkbook.Sheets[amtSheetName];
  const amtData = xlsx.utils.sheet_to_json(amtSheet, { header: 1 });
  console.log("Headers:", amtData[0]);
  console.log("Row 1:", amtData[1]);
  console.log("Row 2:", amtData[2]);
  console.log("Row 3:", amtData[3]);

  console.log("\n--- VEHICLE FILE ---");
  const vehicleWorkbook = xlsx.readFile(vehicleFile);
  
  for (const sheetName of vehicleWorkbook.SheetNames) {
    console.log(`\nSheet: ${sheetName}`);
    const sheet = vehicleWorkbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log("Row 0:", data[0]);
    console.log("Row 1:", data[1]);
  }
} catch (e) {
  console.error(e);
}
