const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const vehicleFile = [
  path.join(__dirname, '..', '..', 'data', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx'),
  path.join(__dirname, '..', '..', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx'),
  path.join(__dirname, '..', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx')
].find(p => fs.existsSync(p)) || path.join(__dirname, '..', '..', 'data', 'Nomor Polisi Mobil Tanki dan Kapasitas.xlsx');

try {
  const vehicleWorkbook = xlsx.readFile(vehicleFile);
  const plateRegex = /^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{1,3}$/i;
  const plateData = [];
  
  for (const sheetName of vehicleWorkbook.SheetNames) {
    const sheet = vehicleWorkbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (typeof cell === 'string' && plateRegex.test(cell.trim())) {
          plateData.push({
            sheet: sheetName,
            rowIdx: r,
            colIdx: c,
            plate: cell.trim(),
            nextCell: row[c+1],
            prevCell: row[c-1],
            rowBelow: data[r+1] ? data[r+1][c] : null
          });
        }
      }
    }
  }
  
  console.log("Plate data:", plateData.slice(0, 15));
} catch (e) {
  console.error(e);
}
