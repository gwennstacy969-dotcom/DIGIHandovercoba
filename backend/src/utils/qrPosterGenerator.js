const sharp = require('sharp');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Generate official Pertamina Handover QR Code Poster (1024 x 1536 px)
 * Overlays QR code inside the 4 blue brackets and embeds plate number in the designated pill box.
 * 
 * @param {string} noPolisi - Nomor polisi truk (misal: 'N8641UH' atau 'N 8641 UH')
 * @param {string} barcodeData - Data teks QR code (biasanya sama dengan vehicle.barcode)
 * @returns {Promise<Buffer>} - Buffer gambar PNG poster
 */
async function generateQrPosterBuffer(noPolisi, barcodeData) {
  // Lokasi template mentahan
  const possiblePaths = [
    path.resolve(__dirname, '../../../data/mentahan tamplate qr.png'),
    path.resolve(__dirname, '../../data/mentahan tamplate qr.png'),
    path.resolve(__dirname, '../../../frontend/assets/mentahan tamplate qr.png')
  ];

  let templatePath = possiblePaths.find(p => fs.existsSync(p));
  if (!templatePath) {
    throw new Error('File template "mentahan tamplate qr.png" tidak ditemukan di folder data.');
  }

  // 1. Generate QR Code Buffer
  // Size 420x420 memberikan jarak ideal dan proporsional di dalam 4 siku biru
  const qrSize = 420;
  const qrBuffer = await QRCode.toBuffer(barcodeData || noPolisi, {
    errorCorrectionLevel: 'H', // Error correction level tertinggi (aman jika stiker kotor/lecet)
    margin: 1,
    width: qrSize,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  // 2. Format plat nomor (misal 'N8641UH' -> 'N 8641 UH' agar rapi dan mudah dibaca)
  const cleanPlate = (noPolisi || '').trim().toUpperCase();
  const formattedPlate = cleanPlate.replace(/^([A-Z]{1,2})\s*(\d{1,4})\s*([A-Z]{1,3})$/, '$1 $2 $3');

  // 3. SVG Overlay untuk Teks Nomor Polisi
  // Kotak abu-abu/biru muda di bawah "No. Polisi:" berpusat di X ~ 667, Y ~ 1145, baseline presisi di Y = 1174
  const textSvg = Buffer.from(`
    <svg width="1024" height="1536">
      <style>
        .plate-text {
          font-family: 'Arial', 'Montserrat', 'Segoe UI', sans-serif;
          font-weight: 900;
          font-size: 40px;
          fill: #003366;
          letter-spacing: 3px;
          text-anchor: middle;
        }
      </style>
      <text x="667" y="1195" class="plate-text">${formattedPlate}</text>
    </svg>
  `);

  // 4. Koordinat QR Code (Tengah-tengah 4 siku biru: X center = 512, Y center = 655)
  const qrLeft = Math.round(512 - (qrSize / 2)); // 302
  const qrTop = Math.round(655 - (qrSize / 2));  // 445

  // 5. Composite gambar menggunakan Sharp
  const posterBuffer = await sharp(templatePath)
    .composite([
      {
        input: qrBuffer,
        top: qrTop,
        left: qrLeft
      },
      {
        input: textSvg,
        top: 0,
        left: 0
      }
    ])
    .png({ quality: 100 })
    .toBuffer();

  return posterBuffer;
}

module.exports = {
  generateQrPosterBuffer
};
