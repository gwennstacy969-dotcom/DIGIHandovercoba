import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getQrBoundingBox, checkOverlap, validateQrPosition } from '../utils/qrPositionValidator.js';

describe('QR Position Validator Test Suite', () => {
  // Kotak scan acuan: ukuran 300x300 di posisi x=50, y=200
  const scanBox = { x: 50, y: 200, width: 300, height: 300 };

  it('1. QR berada tepat di tengah kotak -> validasi berhasil (inside)', () => {
    // QR ukuran 150x150 di tengah (x=125, y=275)
    const event = {
      data: 'BC_B9810TEI',
      cornerPoints: [
        { x: 125, y: 275 },
        { x: 275, y: 275 },
        { x: 275, y: 425 },
        { x: 125, y: 425 },
      ]
    };
    const result = validateQrPosition(event, scanBox);
    assert.equal(result, 'inside');
  });

  it('2. QR terlihat di pojok kiri kamera, di luar kotak -> diabaikan (outside)', () => {
    // QR di x=0, y=50 (jauh di luar kotak scan x=50..350, y=200..500)
    const event = {
      data: 'BC_B9810TEI',
      cornerPoints: [
        { x: 0, y: 50 },
        { x: 40, y: 50 },
        { x: 40, y: 90 },
        { x: 0, y: 90 },
      ]
    };
    const result = validateQrPosition(event, scanBox);
    assert.equal(result, 'outside');
  });

  it('3. QR terlihat di pojok kanan kamera, di luar kotak -> diabaikan (outside)', () => {
    // QR di x=380, y=50
    const event = {
      data: 'BC_B9810TEI',
      cornerPoints: [
        { x: 380, y: 50 },
        { x: 450, y: 50 },
        { x: 450, y: 120 },
        { x: 380, y: 120 },
      ]
    };
    const result = validateQrPosition(event, scanBox);
    assert.equal(result, 'outside');
  });

  it('4. QR terlihat di atas atau di bawah kotak -> diabaikan (outside)', () => {
    // Di atas kotak (y=20..80)
    const eventAtas = {
      data: 'BC_B9810TEI',
      bounds: { origin: { x: 100, y: 50 }, size: { width: 100, height: 100 } }
    };
    assert.equal(validateQrPosition(eventAtas, scanBox), 'outside');

    // Di bawah kotak (y=550..650)
    const eventBawah = {
      data: 'BC_B9810TEI',
      bounds: { origin: { x: 100, y: 550 }, size: { width: 100, height: 100 } }
    };
    assert.equal(validateQrPosition(eventBawah, scanBox), 'outside');
  });

  it('5. QR berada di tepi kotak dan sebagian besar areanya keluar dari batas -> ditolak (outside)', () => {
    // QR 100x100 terletak di x=20, y=250.
    // Hanya x=50..120 (lebar 70) yang masuk, yaitu 70% dari area.
    // Kurang dari 80% overlap -> harus 'outside'
    const eventTepi = {
      data: 'BC_B9810TEI',
      bounds: { origin: { x: 20, y: 250 }, size: { width: 100, height: 100 } }
    };
    assert.equal(validateQrPosition(eventTepi, scanBox), 'outside');
  });

  it('5b. QR di tepi yang overlap >= 80% dan pusat di dalam -> diterima (inside)', () => {
    // QR 100x100 terletak di x=40, y=250 (hanya 10px keluar di kiri -> 90% di dalam)
    // Titik pusat QR: x=90, y=300 (di dalam box x=50..350, y=200..500)
    const eventMasukSebagianBesar = {
      data: 'BC_B9810TEI',
      bounds: { origin: { x: 40, y: 250 }, size: { width: 100, height: 100 } }
    };
    assert.equal(validateQrPosition(eventMasukSebagianBesar, scanBox), 'inside');
  });

  it('6. Ada dua QR di kamera, satu di tengah dan satu di luar -> hanya QR di area scan yang diproses', () => {
    const qrTengah = {
      data: 'BC_VALID_TENGAH',
      bounds: { origin: { x: 150, y: 250 }, size: { width: 100, height: 100 } }
    };
    const qrLuar = {
      data: 'BC_LUAR_KOTAK',
      bounds: { origin: { x: 10, y: 20 }, size: { width: 60, height: 60 } }
    };

    assert.equal(validateQrPosition(qrTengah, scanBox), 'inside');
    assert.equal(validateQrPosition(qrLuar, scanBox), 'outside');
  });

  it('7. Frame kotak belum terukur -> mengembalikan no_frame', () => {
    const event = {
      data: 'BC_B9810TEI',
      bounds: { origin: { x: 150, y: 250 }, size: { width: 100, height: 100 } }
    };
    assert.equal(validateQrPosition(event, null), 'no_frame');
  });

  it('8. Informasi bounds/cornerPoints kosong -> mengembalikan no_coords (tidak terima membabi buta)', () => {
    // Event tanpa koordinat (seperti pada beberapa web emulator atau browser)
    const eventTanpaKoordinat = {
      data: 'BC_B9810TEI'
    };
    assert.equal(validateQrPosition(eventTanpaKoordinat, scanBox), 'no_coords');

    const eventKoordinatKosong = {
      data: 'BC_B9810TEI',
      cornerPoints: [],
      bounds: {}
    };
    assert.equal(validateQrPosition(eventKoordinatKosong, scanBox), 'no_coords');
  });

  it('9. Titik pusat QR di luar kotak scan -> selalu ditolak', () => {
    // QR besar 500x500 yang menutupi area scan tetapi pusatnya di x=-50, y=100
    const qrPusatLuar = {
      x: -300,
      y: 0,
      width: 500,
      height: 500
    };
    assert.equal(checkOverlap(qrPusatLuar, scanBox), 'outside');
  });

  it('10. Bounding box dari cornerPoints acak terurut dengan benar', () => {
    const event = {
      data: 'TEST',
      cornerPoints: [
        { x: 300, y: 400 },
        { x: 100, y: 200 },
        { x: 300, y: 200 },
        { x: 100, y: 400 },
      ]
    };
    const bbox = getQrBoundingBox(event);
    assert.deepEqual(bbox, { x: 100, y: 200, width: 200, height: 200 });
  });
});

