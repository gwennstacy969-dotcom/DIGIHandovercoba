const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads'); // backend/uploads
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const optimizeImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  try {
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const filenameBase = file.fieldname + '-' + Date.now() + '-' + Math.round(Math.random() * 1000);
      
      const fullName = `${filenameBase}-full.webp`;
      const previewName = `${filenameBase}-preview.webp`;
      const thumbName = `${filenameBase}-thumb.webp`;

      // Full size (1200x1200 max, auto-rotated according to EXIF)
      await sharp(file.buffer)
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(path.join(uploadsDir, fullName));

      // Preview size (600x600 max, auto-rotated according to EXIF)
      await sharp(file.buffer)
        .rotate()
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(path.join(uploadsDir, previewName));

      // Thumbnail size (200x200 cropped, auto-rotated according to EXIF)
      await sharp(file.buffer)
        .rotate()
        .resize(200, 200, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(path.join(uploadsDir, thumbName));

      // Attach new URLs and info to the file object
      file.path = `uploads/${fullName}`;
      file.thumbnailUrl = `uploads/${thumbName}`;
      file.previewUrl = `uploads/${previewName}`;
      file.originalSize = file.size;
    }
    next();
  } catch (error) {
    console.error('Image optimization failed:', error);
    next(error);
  }
};

module.exports = optimizeImages;
