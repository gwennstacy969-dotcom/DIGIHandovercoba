/**
 * Helper untuk menentukan label tombol pilihan jawaban checklist secara kontekstual
 * berdasarkan nama pertanyaan/item dan kategorinya.
 * 
 * Sesuai kebutuhan operasional Pertamina:
 * - Kondisi (Rem, Wiper, Kompartemen) => NORMAL / RUSAK
 * - Keberadaan (DCP/CO2, STNK, dsb) => ADA / TIDAK ADA
 * - Level Fluida (Oli Mesin, Radiator) => NORMAL / KURANG
 * - Perlengkapan AMT (SIM, Seragam, dsb) => SESUAI / TIDAK, MENGGUNAKAN / TIDAK, BERLAKU / EXPIRED, LENGKAP / TIDAK
 */
export const getItemOptionLabels = (item) => {
  const name = (item?.name || '').trim().toLowerCase();

  // 1. Kondisi (Rem, Wiper, Kompartemen, dsb)
  if (name.startsWith('kondisi') || name.includes('kondisi rem') || name.includes('kondisi wiper')) {
    return { good: 'NORMAL', bad: 'RUSAK' };
  }

  // 2. Keberadaan (DCP/CO2, Surat, APAR, Kotak P3K, Selang, dsb)
  if (name.startsWith('keberadaan')) {
    return { good: 'ADA', bad: 'TIDAK ADA' };
  }

  // 3. Fluida & Mesin (Oli Mesin, Air Radiator)
  if (name.includes('oli') || name.includes('radiator') || name.includes('air')) {
    return { good: 'NORMAL', bad: 'KURANG' };
  }

  // 4. Membawa SIM Sesuai Kendaraan
  if (name.startsWith('membawa sim') || name.includes('sim ')) {
    return { good: 'SESUAI', bad: 'TIDAK' };
  }

  // 5. Membawa Jas Hujan, Buku Saku, dsb
  if (name.startsWith('membawa')) {
    return { good: 'MEMBAWA', bad: 'TIDAK' };
  }

  // 6. Menggunakan Seragam, Sepatu Safety, Helm, dsb
  if (name.startsWith('menggunakan') || name.startsWith('memakai')) {
    return { good: 'MENGGUNAKAN', bad: 'TIDAK' };
  }

  // 7. Masa berlaku (ID/ HSE Paspor Berlaku)
  if (name.includes('berlaku') || name.includes('paspor')) {
    return { good: 'BERLAKU', bad: 'EXPIRED' };
  }

  // 8. Kelengkapan dokumen (Dokumen KIM)
  if (name.includes('dokumen') || name.includes('kim')) {
    return { good: 'LENGKAP', bad: 'TIDAK' };
  }

  // 9. Item yang mengandung kata 'sesuai'
  if (name.includes('sesuai')) {
    return { good: 'SESUAI', bad: 'TIDAK' };
  }

  // 10. Fallback kategori B (Perlengkapan AMT)
  if (item?.category === 'B') {
    return { good: 'SESUAI', bad: 'TIDAK' };
  }

  // 11. Fallback default
  return { good: 'NORMAL', bad: 'RUSAK' };
};
