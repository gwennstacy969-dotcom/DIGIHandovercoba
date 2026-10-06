const fs = require('fs');
const path = require('path');

const barcodesDir = fs.existsSync(path.join(__dirname, 'barcodes'))
  ? path.join(__dirname, 'barcodes')
  : path.join(__dirname, '..', 'barcodes');
const galleryPath = path.join(__dirname, '..', 'scratch', 'barcodes_gallery.html');

const files = fs.readdirSync(barcodesDir).filter(f => f.endsWith('.png'));

let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Galeri Barcode Kendaraan</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f3f4f6; padding: 20px; }
    h1 { text-align: center; color: #1f2937; margin-bottom: 30px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
    .card { background: white; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-align: center; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    .title { margin-top: 10px; font-weight: bold; color: #374151; }
  </style>
</head>
<body>
  <h1>Galeri Barcode Mobil Tanki</h1>
  <div class="grid">
`;

files.forEach(file => {
  const plate = file.replace('.png', '');
  html += `
    <div class="card">
      <img src="./barcodes/${file}" alt="${plate}">
      <div class="title">${plate}</div>
    </div>
  `;
});

html += `
  </div>
</body>
</html>
`;

fs.writeFileSync(galleryPath, html);
console.log('Gallery created at', galleryPath);
