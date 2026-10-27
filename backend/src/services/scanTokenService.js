/**
 * ScanTokenService — Mekanisme otorisasi scan satu kali pakai (in-memory).
 *
 * TUJUAN:
 * Mencegah akses langsung ke endpoint submit handover tanpa melalui proses scan QR.
 * Token diikat pada: userId + vehicleId + processType (mulai/akhiri) + hanya 1x pakai.
 *
 * KETERBATASAN (catatan kejujuran):
 * - Token ini bersifat in-memory, hilang saat server restart.
 * - Tidak membuktikan bahwa scan fisik benar-benar terjadi — hanya bahwa endpoint
 *   /scan/:barcode berhasil dipanggil dengan barcode yang valid.
 * - Klien yang dimodifikasi masih dapat memanggil /scan/:barcode langsung via API
 *   tanpa kamera nyata. Perlindungan terhadap ini memerlukan mekanisme tambahan
 *   seperti QR dinamis (tantangan per-sesi) atau server-side challenge-response.
 * - Untuk konteks operasional internal (bukan publik), level ini sudah cukup untuk
 *   mencegah bypass accidental dari UI.
 */

const crypto = require('crypto');

class ScanTokenService {
  constructor() {
    // Map: token -> { userId, vehicleId, noPolisi, processType, expiresAt, used }
    this.tokens = new Map();
    
    // Bersihkan token kedaluwarsa setiap 5 menit (unref agar tidak menahan proses exit / Jest)
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupTimer && this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Issue token baru setelah scan QR berhasil tervalidasi.
   * @param {string} userId - ID pengguna yang scan
   * @param {string} vehicleId - ID kendaraan yang di-scan
   * @param {string} noPolisi - Nomor polisi kendaraan
   * @param {string} processType - 'mulai' atau 'akhiri'
   * @param {number} ttlMs - Time-to-live dalam milidetik (default 15 menit)
   */
  issue(userId, vehicleId, noPolisi, processType, ttlMs = 15 * 60 * 1000) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + ttlMs;

    this.tokens.set(token, {
      userId,
      vehicleId,
      noPolisi,
      processType,
      expiresAt,
      used: false
    });

    return token;
  }

  /**
   * Verifikasi dan konsumsi token.
   * Token hanya dapat digunakan SATU KALI.
   * @returns {{ valid: boolean, reason?: string, payload?: object }}
   */
  consume(token, userId, vehicleId, processType) {
    if (!token) {
      return { valid: false, reason: 'Token scan tidak ditemukan. Lakukan scan QR kendaraan terlebih dahulu.' };
    }

    const entry = this.tokens.get(token);

    if (!entry) {
      return { valid: false, reason: 'Token scan tidak valid atau sudah kedaluwarsa. Lakukan scan ulang.' };
    }

    if (entry.used) {
      this.tokens.delete(token);
      return { valid: false, reason: 'Token scan sudah digunakan. Lakukan scan ulang.' };
    }

    if (Date.now() > entry.expiresAt) {
      this.tokens.delete(token);
      return { valid: false, reason: 'Token scan sudah kedaluwarsa. Lakukan scan ulang (batas 15 menit).' };
    }

    if (entry.userId !== userId) {
      return { valid: false, reason: 'Token scan tidak cocok dengan pengguna yang login.' };
    }

    if (entry.vehicleId !== vehicleId) {
      return { valid: false, reason: 'Token scan tidak cocok dengan kendaraan yang dimaksud.' };
    }

    if (entry.processType !== processType) {
      return { valid: false, reason: `Token scan untuk proses "${entry.processType}", bukan "${processType}". Scan ulang.` };
    }

    // Konsumsi token — tandai sebagai sudah dipakai
    entry.used = true;
    this.tokens.set(token, entry);

    // Hapus setelah dikonsumsi (cleanup langsung)
    const cleanupTimer = setTimeout(() => this.tokens.delete(token), 1000);
    if (cleanupTimer && cleanupTimer.unref) cleanupTimer.unref();

    return { valid: true, payload: entry };
  }

  /**
   * Bersihkan token kedaluwarsa.
   */
  cleanup() {
    const now = Date.now();
    for (const [token, entry] of this.tokens.entries()) {
      if (now > entry.expiresAt || entry.used) {
        this.tokens.delete(token);
      }
    }
  }

  /**
   * Jumlah token aktif (untuk monitoring/debugging).
   */
  activeCount() {
    return this.tokens.size;
  }
}

// Singleton — satu instance untuk seluruh proses server
module.exports = new ScanTokenService();

