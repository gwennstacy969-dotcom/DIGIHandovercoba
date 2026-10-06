import test from 'node:test';
import assert from 'node:assert';
import { getItemOptionLabels } from '../utils/checklistHelper.js';

test('checklistHelper - getItemOptionLabels', async (t) => {
  await t.test('Kategori A - Kondisi items return NORMAL / RUSAK', () => {
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Kondisi Rem', category: 'A' }),
      { good: 'NORMAL', bad: 'RUSAK' }
    );
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Kondisi Wiper', category: 'A' }),
      { good: 'NORMAL', bad: 'RUSAK' }
    );
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Kondisi Kompartemen Tangki', category: 'A' }),
      { good: 'NORMAL', bad: 'RUSAK' }
    );
  });

  await t.test('Kategori A - Keberadaan items return ADA / TIDAK ADA', () => {
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Keberadaan DCP/ CO2', category: 'A' }),
      { good: 'ADA', bad: 'TIDAK ADA' }
    );
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Keberadaan STNK', category: 'A' }),
      { good: 'ADA', bad: 'TIDAK ADA' }
    );
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Keberadaan Kotak P3K', category: 'A' }),
      { good: 'ADA', bad: 'TIDAK ADA' }
    );
  });

  await t.test('Kategori A - Fluida items return NORMAL / KURANG', () => {
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Oli Mesin', category: 'A' }),
      { good: 'NORMAL', bad: 'KURANG' }
    );
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Air Radiator', category: 'A' }),
      { good: 'NORMAL', bad: 'KURANG' }
    );
  });

  await t.test('Kategori B - SIM returns SESUAI / TIDAK', () => {
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Membawa SIM Sesuai Kendaraan', category: 'B' }),
      { good: 'SESUAI', bad: 'TIDAK' }
    );
  });

  await t.test('Kategori B - Paspor returns BERLAKU / EXPIRED', () => {
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'ID/ HSE Paspor Berlaku', category: 'B' }),
      { good: 'BERLAKU', bad: 'EXPIRED' }
    );
  });

  await t.test('Kategori B - Dokumen KIM returns LENGKAP / TIDAK', () => {
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Dokumen KIM', category: 'B' }),
      { good: 'LENGKAP', bad: 'TIDAK' }
    );
  });

  await t.test('Kategori B - APD / Seragam returns MENGGUNAKAN / TIDAK', () => {
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Menggunakan Seragam Kerja', category: 'B' }),
      { good: 'MENGGUNAKAN', bad: 'TIDAK' }
    );
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Menggunakan Safety Shoes', category: 'B' }),
      { good: 'MENGGUNAKAN', bad: 'TIDAK' }
    );
  });

  await t.test('Kategori B - Perlengkapan bawaan returns MEMBAWA / TIDAK', () => {
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Membawa Jas Hujan', category: 'B' }),
      { good: 'MEMBAWA', bad: 'TIDAK' }
    );
    assert.deepStrictEqual(
      getItemOptionLabels({ name: 'Membawa Buku Saku AMT', category: 'B' }),
      { good: 'MEMBAWA', bad: 'TIDAK' }
    );
  });
});
