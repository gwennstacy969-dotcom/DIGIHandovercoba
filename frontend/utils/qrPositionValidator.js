/**
 * Helper untuk validasi posisi QR Code di dalam kotak scan (overlay viewfinder).
 * Memastikan:
 * 1. Titik pusat QR Code harus berada di dalam area kotak scan.
 * 2. Minimal 80% dari area QR Code harus berada di dalam batas kotak scan.
 * 3. Jika bounds / cornerPoints tidak tersedia (atau tidak valid), sistem mengembalikan 'no_coords'
 *    dan menolak memproses scan secara membabi buta.
 */

export const getQrBoundingBox = (barcodeEvent) => {
  if (!barcodeEvent) return null;

  const corners = barcodeEvent.cornerPoints;
  const bounds = barcodeEvent.bounds;

  // 1. Cek cornerPoints (paling akurat di Android native Expo Camera)
  if (Array.isArray(corners) && corners.length === 4) {
    const xs = corners.map(p => Number(p.x)).filter(n => !isNaN(n));
    const ys = corners.map(p => Number(p.y)).filter(n => !isNaN(n));

    if (xs.length === 4 && ys.length === 4) {
      const qrLeft = Math.min(...xs);
      const qrRight = Math.max(...xs);
      const qrTop = Math.min(...ys);
      const qrBottom = Math.max(...ys);
      const width = qrRight - qrLeft;
      const height = qrBottom - qrTop;

      if (width > 0 && height > 0) {
        return { x: qrLeft, y: qrTop, width, height };
      }
    }
  }

  // 2. Fallback ke bounds (iOS / devices dengan bounds origin & size)
  if (bounds && bounds.origin && bounds.size) {
    const x = Number(bounds.origin.x);
    const y = Number(bounds.origin.y);
    const width = Number(bounds.size.width);
    const height = Number(bounds.size.height);

    if (!isNaN(x) && !isNaN(y) && width > 0 && height > 0) {
      return { x, y, width, height };
    }
  }

  return null;
};

export const checkOverlap = (qrRect, boxFrame) => {
  if (!qrRect || !boxFrame) return 'outside';
  if (boxFrame.width <= 0 || boxFrame.height <= 0) return 'outside';
  if (qrRect.width <= 0 || qrRect.height <= 0) return 'outside';

  // 1. Validasi Titik Pusat QR (Center Point Validation)
  const qrCenterX = qrRect.x + qrRect.width / 2;
  const qrCenterY = qrRect.y + qrRect.height / 2;

  const isCenterInside = (
    qrCenterX >= boxFrame.x &&
    qrCenterX <= boxFrame.x + boxFrame.width &&
    qrCenterY >= boxFrame.y &&
    qrCenterY <= boxFrame.y + boxFrame.height
  );

  if (!isCenterInside) {
    return 'outside';
  }

  // 2. Validasi Persentase Area yang Masuk (Minimal 80% Intersection Area)
  const interLeft = Math.max(qrRect.x, boxFrame.x);
  const interTop = Math.max(qrRect.y, boxFrame.y);
  const interRight = Math.min(qrRect.x + qrRect.width, boxFrame.x + boxFrame.width);
  const interBottom = Math.min(qrRect.y + qrRect.height, boxFrame.y + boxFrame.height);

  if (interRight <= interLeft || interBottom <= interTop) {
    return 'outside';
  }

  const interArea = (interRight - interLeft) * (interBottom - interTop);
  const qrArea = qrRect.width * qrRect.height;

  if (qrArea === 0) return 'outside';
  const overlapRatio = interArea / qrArea;

  return overlapRatio >= 0.8 ? 'inside' : 'outside';
};

/**
 * Validasi posisi barcode event terhadap frame kotak scan.
 * @param {object} barcodeEvent - Event dari onBarcodeScanned
 * @param {object|null} boxFrame - Frame posisi kotak scan { x, y, width, height }
 * @returns {'inside' | 'outside' | 'no_coords' | 'no_frame'}
 */
export const validateQrPosition = (barcodeEvent, boxFrame) => {
  if (!boxFrame) return 'no_frame';

  const qrRect = getQrBoundingBox(barcodeEvent);
  if (!qrRect) {
    return 'no_coords';
  }

  return checkOverlap(qrRect, boxFrame);
};

