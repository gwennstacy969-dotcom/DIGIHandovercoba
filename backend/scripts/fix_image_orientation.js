const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '../uploads');

async function migrateImages() {
  console.log('--- Memulai Koreksi Orientasi Gambar (Landscape ke Portrait) ---');
  if (!fs.existsSync(uploadsDir)) {
    console.error('Direktori uploads tidak ditemukan!');
    return;
  }

  const files = fs.readdirSync(uploadsDir);
  let rotatedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (!file.endsWith('.webp') && !file.endsWith('.jpg') && !file.endsWith('.jpeg')) {
      continue;
    }

    const filePath = path.join(uploadsDir, file);

    try {
      // Baca file ke buffer terlebih dahulu agar tidak ada file lock di Windows
      const fileBuffer = fs.readFileSync(filePath);
      const meta = await sharp(fileBuffer).metadata();

      // Hanya putar jika gambar berbentuk landscape (width > height)
      if (meta.width && meta.height && meta.width > meta.height) {
        const rotatedBuf = await sharp(fileBuffer).rotate(90).toBuffer();
        fs.writeFileSync(filePath, rotatedBuf);
        rotatedCount++;
        console.log(`[ROTATED 90° CW] ${file} (${meta.width}x${meta.height} -> ${meta.height}x${meta.width})`);

        // Jika ini file -full.webp, periksa juga apakah ada -thumb.webp terkait
        if (file.endsWith('-full.webp')) {
          const thumbName = file.replace('-full.webp', '-thumb.webp');
          const thumbPath = path.join(uploadsDir, thumbName);
          if (fs.existsSync(thumbPath)) {
            try {
              const thumbBuf = fs.readFileSync(thumbPath);
              const rotatedThumb = await sharp(thumbBuf).rotate(90).toBuffer();
              fs.writeFileSync(thumbPath, rotatedThumb);
              console.log(`  └─ [ROTATED THUMB 90° CW] ${thumbName}`);
            } catch (errThumb) {
              console.error(`  └─ Gagal putar thumb ${thumbName}:`, errThumb.message);
            }
          }
        }
      } else {
        skippedCount++;
      }
    } catch (e) {
      console.error(`Error memproses ${file}:`, e.message);
    }
  }

  console.log(`\nSelesai! Berhasil mengoreksi ${rotatedCount} gambar menjadi portrait. (${skippedCount} gambar dilewati karena sudah portrait/persegi)`);
}

migrateImages();
