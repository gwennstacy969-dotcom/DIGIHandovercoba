const defaultPrisma = require('../config/prisma');

/**
 * Memeriksa apakah sebuah item checklist merupakan kerusakan Major pada kendaraan (Kategori A).
 * Temuan Kategori B (kepatuhan AMT) atau kerusakan Minor TIDAK memblokir operasional kendaraan.
 * 
 * @param {object} item 
 * @returns {boolean}
 */
const isMajorDamageItem = (item) => {
  if (!item || item.isGood) return false;
  const isVehicleCategory = item.category === 'A' || !item.category || item.category !== 'B';
  if (!isVehicleCategory) return false;

  const severity = String(item.severity || '').toLowerCase();
  const name = String(item.name || '');

  return severity === 'major' || name.includes('[MAJOR]');
};

/**
 * Mencari riwayat handover terakhir untuk kendaraan tertentu dengan pengurutan konsisten:
 * timestamp DESC, lalu createdAt DESC sebagai pembeda jika timestamp identik.
 * 
 * @param {string} noPolisi 
 * @param {object} client - Prisma client atau transaction instance
 * @returns {Promise<object|null>}
 */
const getLatestVehicleHandover = async (noPolisi, client = defaultPrisma) => {
  if (!noPolisi || !client.handover?.findFirst) return null;
  return await client.handover.findFirst({
    where: { noPolisi },
    orderBy: [
      { timestamp: 'desc' },
      { createdAt: 'desc' }
    ],
    include: {
      items: true,
      issue: true
    }
  });
};

/**
 * Membaca seluruh issue aktif milik kendaraan (ONGOING atau PENDING_APPROVAL),
 * tanpa dibatasi oleh filter user tertentu.
 * 
 * @param {string} noPolisi 
 * @param {object} client 
 * @returns {Promise<Array>}
 */
const getActiveVehicleIssues = async (noPolisi, client = defaultPrisma) => {
  if (!noPolisi || !client.issue?.findMany) return [];
  return await client.issue.findMany({
    where: {
      handover: { noPolisi },
      status: { in: ['ONGOING', 'PENDING_APPROVAL'] }
    },
    include: {
      handover: {
        include: { items: true }
      }
    },
    orderBy: [
      { createdAt: 'desc' }
    ]
  });
};

/**
 * Memeriksa apakah ada temuan Major yang masih aktif (ONGOING / PENDING_APPROVAL).
 * 
 * @param {Array} activeIssues 
 * @param {string} currentVehicleStatus 
 * @returns {boolean}
 */
const checkHasActiveMajorIssue = (activeIssues = [], currentVehicleStatus = '') => {
  for (const issue of activeIssues) {
    const items = issue.handover?.items || [];
    if (items.length === 0) {
      // Jika data item tidak ditemukan tetapi issue masih aktif dan kendaraan Maintenance,
      // amankan status Maintenance agar tidak terbuka prematur.
      if (currentVehicleStatus === 'Maintenance') return true;
    } else if (items.some(isMajorDamageItem)) {
      return true;
    }
  }
  return false;
};

/**
 * Menghitung status operasional kendaraan yang benar berdasarkan:
 * - Temuan Major aktif (ONGOING / PENDING_APPROVAL)
 * - Riwayat handover terakhir (akhiri vs mulai vs belum ada)
 * 
 * Aturan bisnis:
 * 1. Jika ada temuan Major aktif -> 'Maintenance'.
 * 2. Jika tidak ada temuan Major aktif:
 *    - Riwayat terakhir 'akhiri' -> 'READY_TO_START'
 *    - Riwayat terakhir 'mulai'  -> 'Active'
 *    - Belum ada riwayat handover -> 'READY_TO_START'
 * 
 * @param {object|null} lastHandover 
 * @param {boolean} hasActiveMajorIssue 
 * @returns {string} 'READY_TO_START' | 'Active' | 'Maintenance'
 */
const determineExpectedStatus = (lastHandover, hasActiveMajorIssue) => {
  if (hasActiveMajorIssue) {
    return 'Maintenance';
  }
  if (!lastHandover) {
    return 'READY_TO_START';
  }
  if (lastHandover.type === 'akhiri') {
    return 'READY_TO_START';
  }
  if (lastHandover.type === 'mulai') {
    return 'Active';
  }
  return 'READY_TO_START';
};

/**
 * Helper terpusat untuk merekonsiliasi status operasional kendaraan.
 * Menjamin keselarasan antara status di database dengan riwayat handover dan issue riil.
 * 
 * @param {string|object} noPolisiOrVehicle - Nomor polisi string atau object Vehicle
 * @param {object} [client=defaultPrisma]   - Prisma client atau instance transaksi
 * @param {object} [options={ persist: true }]
 * @returns {Promise<{
 *   vehicle: object,
 *   lastHandover: object|null,
 *   activeIssues: Array,
 *   hasActiveMajorIssue: boolean,
 *   expectedStatus: string,
 *   wasReconciled: boolean
 * }>}
 */
const reconcileVehicleOperationalStatus = async (
  noPolisiOrVehicle,
  client = defaultPrisma,
  options = { persist: true }
) => {
  if (!noPolisiOrVehicle) {
    return {
      vehicle: null,
      lastHandover: null,
      activeIssues: [],
      hasActiveMajorIssue: false,
      expectedStatus: 'READY_TO_START',
      wasReconciled: false
    };
  }

  let vehicle = null;
  let noPolisi = '';

  if (typeof noPolisiOrVehicle === 'string') {
    noPolisi = noPolisiOrVehicle.trim();
    vehicle = await client.vehicle.findUnique({ where: { noPolisi } });
    if (!vehicle) {
      // Coba fallback dengan noPolisi format bersih tanpa spasi
      const cleanPlate = noPolisi.replace(/\s+/g, '').toUpperCase();
      const allVeh = await client.vehicle.findMany({ select: { id: true, noPolisi: true, barcode: true, status: true } });
      vehicle = allVeh.find(v => v.noPolisi.replace(/\s+/g, '').toUpperCase() === cleanPlate) || null;
      if (vehicle) noPolisi = vehicle.noPolisi;
    }
  } else if (typeof noPolisiOrVehicle === 'object' && noPolisiOrVehicle.noPolisi) {
    vehicle = noPolisiOrVehicle;
    noPolisi = vehicle.noPolisi;
  }

  if (!vehicle) {
    return {
      vehicle: null,
      lastHandover: null,
      activeIssues: [],
      hasActiveMajorIssue: false,
      expectedStatus: 'READY_TO_START',
      wasReconciled: false
    };
  }

  // 1. Ambil riwayat handover terakhir dengan urutan konsisten
  const lastHandover = await getLatestVehicleHandover(noPolisi, client);

  // 2. Ambil seluruh issue aktif (ONGOING atau PENDING_APPROVAL) milik kendaraan ini
  const activeIssues = await getActiveVehicleIssues(noPolisi, client);
  const hasActiveMajorIssue = checkHasActiveMajorIssue(activeIssues, vehicle.status);

  // 3. Tentukan status operasional yang diharapkan
  const expectedStatus = determineExpectedStatus(lastHandover, hasActiveMajorIssue);

  // 4. Koreksi status database jika usang
  let wasReconciled = false;
  if (vehicle.status !== expectedStatus && options.persist !== false && client.vehicle?.update) {
    try {
      vehicle = await client.vehicle.update({
        where: { id: vehicle.id },
        data: { status: expectedStatus }
      });
      wasReconciled = true;
    } catch (err) {
      console.warn(`[RECONCILE] Gagal memperbarui status kendaraan ${noPolisi}:`, err.message);
      // Tetap gunakan status hasil rekonsiliasi di memori agar request aktif tidak terblokir
      vehicle = { ...vehicle, status: expectedStatus };
      wasReconciled = true;
    }
  } else if (vehicle.status !== expectedStatus) {
    vehicle = { ...vehicle, status: expectedStatus };
    wasReconciled = true;
  }

  return {
    vehicle,
    lastHandover,
    activeIssues,
    hasActiveMajorIssue,
    expectedStatus,
    wasReconciled
  };
};

module.exports = {
  isMajorDamageItem,
  getLatestVehicleHandover,
  getActiveVehicleIssues,
  checkHasActiveMajorIssue,
  determineExpectedStatus,
  reconcileVehicleOperationalStatus
};
