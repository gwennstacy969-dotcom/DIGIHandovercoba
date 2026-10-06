const xlsx = require('xlsx');

const path = require('path');
const fs = require('fs');

const templatePath = [
  path.join(__dirname, '..', '..', 'data', 'Template Handover Report excel.xlsx'),
  path.join(__dirname, '..', '..', 'Template Handover Report excel.xlsx'),
  path.join(__dirname, '..', 'Template Handover Report excel.xlsx')
].find(p => fs.existsSync(p)) || path.join(__dirname, '..', '..', 'data', 'Template Handover Report excel.xlsx');

const workbook = xlsx.readFile(templatePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log("Sheet Name:", sheetName);
console.log("Excel Template Content (First 20 rows):");
data.slice(0, 20).forEach((row, i) => {
    console.log(`Row ${i + 1}:`, row);
});
