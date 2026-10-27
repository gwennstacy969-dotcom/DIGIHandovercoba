const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const prisma = require('../config/prisma');
const CacheService = require('../utils/CacheService');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const optimizeImages = require('../middleware/imageOptimizer');
const { submitHandoverSchema } = require('../validators/schemas');
const { sendNotification, sendAmtComplianceNotification } = require('../services/notificationService');
const scanTokenService = require('../services/scanTokenService');
const { reconcileVehicleOperationalStatus } = require('../services/vehicleStatusService');
const geocodingService = require('../services/geocodingService');

const normalizeName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
};

const isNameMatch = (targetName, currentUserName) => {
  if (!targetName || !currentUserName) return false;
  const n1 = normalizeName(targetName);
  const n2 = normalizeName(currentUserName);
  if (n1 === n2) return true;
  const parts1 = n1.split(' ').filter(p => p.length > 2);
  const parts2 = n2.split(' ').filter(p => p.length > 2);
  return parts1.some(p => parts2.includes(p));
};

const upload = multer({ storage: multer.memoryStorage() });

// Helper to generate official handover document code: HO-YYYYMMDD-XXXX
const generateHandoverNo = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `HO-${year}${month}${day}-`;
  try {
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM handover 
      WHERE handoverNo LIKE ${datePrefix + '%'}
    `;
    const seqNum = Number(countResult[0]?.count || 0) + 1;
    return `${datePrefix}${String(seqNum).padStart(4, '0')}`;
  } catch (e) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${datePrefix}${randomSuffix}`;
  }
};

// 1. GET My Latest Active Handover (Untuk Cek Status Scan Mulai / Akhiri)
router.get('/my-active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true }
    });

    const conditions = [{ userId }];
    if (user?.name) {
      conditions.push({ amt1: user.name });
      conditions.push({ amt2: user.name });
    }

    const lastHandover = await prisma.handover.findFirst({
      where: { OR: conditions },
      orderBy: [
        { timestamp: 'desc' },
        { createdAt: 'desc' }
      ],
      include: { issue: true, items: true }
    });

    // Jika tidak ada, atau jenis terakhir bukan 'mulai', maka tidak ada pekerjaan aktif
    if (!lastHandover || lastHandover.type !== 'mulai') {
      return res.json({ success: true, activeHandover: null });
    }

    // Cek apakah kendaraan ini sudah diakhiri setelah handover mulai ini
    // (misalnya oleh partner AMT atau force-release oleh pengawas)
    const subsequentAkhiri = await prisma.handover.findFirst({
      where: {
        noPolisi: lastHandover.noPolisi,
        type: 'akhiri',
        OR: [
          { timestamp: { gt: lastHandover.timestamp } },
          {
            timestamp: lastHandover.timestamp,
            createdAt: { gt: lastHandover.createdAt }
          }
        ]
      },
      orderBy: [
        { timestamp: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    if (subsequentAkhiri) {
      return res.json({ success: true, activeHandover: null });
    }

    let vehicleData = null;
    if (lastHandover.noPolisi) {
      try {
        vehicleData = await prisma.vehicle.findUnique({
          where: { noPolisi: lastHandover.noPolisi }
        });
      } catch (e) {}
    }

    res.json({
      success: true,
      activeHandover: {
        ...lastHandover,
        vehicle: vehicleData
      }
    });
  } catch (error) {
    console.error('Error fetching my-active handover:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Submit Handover (B1: No dummy user, B6: Schema validation, Photo handling)
router.post('/', authenticateToken, upload.any(), optimizeImages, async (req, res) => {
  try {
    // B6: Validasi request body menggunakan Joi
    const { error, value } = submitHandoverSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { noPolisi, shift, type, locationLat, locationLng, items, amt1, amt2 } = value;
    let locationAddress = value.locationAddress || req.body.address || null;
    let locationVillage = value.locationVillage || null;
    let locationDistrict = value.locationDistrict || null;
    let locationCity = value.locationCity || null;
    let locationProvince = value.locationProvince || null;
    let locationCountry = value.locationCountry || null;

    if (!locationAddress && locationLat && locationLng) {
      try {
        const geo = await geocodingService.reverseGeocode(parseFloat(locationLat), parseFloat(locationLng));
        if (geo) {
          locationAddress = geo.address || null;
          locationVillage = geo.village || null;
          locationDistrict = geo.district || null;
          locationCity = geo.city || null;
          locationProvince = geo.province || null;
          locationCountry = geo.country || null;
        }
      } catch (geoErr) {
        // Reverse geocoding failure must never block handover submission
      }
    }

    // B1: Selalu gunakan authenticated userId dari req.user.id
    const userId = req.user.id;

    // VERIFIKASI SCAN TOKEN: Pastikan handover hanya dapat disubmit setelah scan QR yang valid
    // Token diterbitkan oleh endpoint /api/vehicles/scan/:barcode setelah scan berhasil
    const scanToken = req.body.scanToken || req.headers['x-scan-token'];
    const isAdminOrPengawas = ['ADMIN', 'SUPER_ADMIN', 'PENGAWAS'].includes(req.user?.role);

    // Cari vehicle untuk mendapatkan vehicleId
    const vehicleForTokenCheck = await prisma.vehicle.findUnique({ where: { noPolisi } });
    if (!vehicleForTokenCheck) {
      return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
    }

    if (process.env.NODE_ENV !== 'test' || scanToken) {
      const tokenResult = scanTokenService.consume(
        scanToken,
        String(userId),
        vehicleForTokenCheck.id,
        type || 'mulai'
      );

      if (!tokenResult.valid) {
        return res.status(403).json({
          error: `Akses ditolak: ${tokenResult.reason}`,
          requireScan: true
        });
      }
    }
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null }
    });
    if (!existingUser) {
      return res.status(403).json({ error: 'Akses ditolak: Akun pengguna tidak valid atau tidak aktif' });
    }

    let parsedItems = [];
    if (typeof items === 'string') {
      try {
        parsedItems = JSON.parse(items);
      } catch (e) {
        return res.status(400).json({ error: 'Format JSON item checklist tidak valid' });
      }
    } else if (Array.isArray(items)) {
      parsedItems = items;
    }

    // Pisahkan item bermasalah: Kategori A (Kendaraan) vs Kategori B (Perlengkapan / Kepatuhan AMT)
    const vehicleIssueItems = parsedItems.filter(item => !item.isGood && (item.category === 'A' || !item.category || item.category !== 'B'));
    const amtIssueItems = parsedItems.filter(item => !item.isGood && item.category === 'B');

    const hasMajorIssue = vehicleIssueItems.some(item => (item.severity && item.severity.toLowerCase() === 'major') || (item.name && item.name.includes('[MAJOR]')));
    const hasMinorIssue = vehicleIssueItems.some(item => !((item.severity && item.severity.toLowerCase() === 'major') || (item.name && item.name.includes('[MAJOR]'))));
    
    // Status kendaraan handover: HANYA jika ada kerusakan kendaraan Kategori A
    const status = vehicleIssueItems.length > 0 ? 'Ada Masalah' : 'Siap Operasi (Normal)';

    // Filter file foto: pastikan foto 'Kerusakan_' hanya disimpan jika memang ada item kendaraan terkait yang rusak
    const validFiles = (req.files || []).filter(file => {
      if (file.originalname) {
        let decodedName = file.originalname;
        try { decodedName = decodeURIComponent(file.originalname); } catch (e) { }
        if (decodedName.startsWith('Kerusakan_')) {
          if (vehicleIssueItems.length === 0) {
            try {
              if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
              if (file.thumbnailUrl && fs.existsSync(file.thumbnailUrl)) fs.unlinkSync(file.thumbnailUrl);
              if (file.previewUrl && fs.existsSync(file.previewUrl)) fs.unlinkSync(file.previewUrl);
            } catch (e) { }
            return false;
          }

          const rawPhotoItemName = decodedName.replace('Kerusakan_', '').split('.')[0].replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();
          const isItemDamaged = vehicleIssueItems.some(it => {
            const cleanItemName = (it.name || '').replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();
            return cleanItemName.includes(rawPhotoItemName) || rawPhotoItemName.includes(cleanItemName);
          });

          if (!isItemDamaged) {
            try {
              if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
              if (file.thumbnailUrl && fs.existsSync(file.thumbnailUrl)) fs.unlinkSync(file.thumbnailUrl);
              if (file.previewUrl && fs.existsSync(file.previewUrl)) fs.unlinkSync(file.previewUrl);
            } catch (e) { }
            return false;
          }
        }
      }
      return true;
    });

    // Validasi dua lapis untuk State Machine Kendaraan dengan sinkronisasi terpusat
    const {
      vehicle: reconciledVehicle,
      lastHandover,
      hasActiveMajorIssue
    } = await reconcileVehicleOperationalStatus(noPolisi);

    if (!reconciledVehicle) {
      return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
    }

    if (type === 'mulai') {
      if (hasActiveMajorIssue || reconciledVehicle.isManualMaintenance || reconciledVehicle.status === 'Maintenance') {
        return res.status(409).json({
          error: 'Kendaraan sedang dalam perbaikan (Maintenance) dan belum siap untuk Mulai Pekerjaan.'
        });
      }

      if (lastHandover && lastHandover.type === 'mulai') {
        return res.status(409).json({
          error: 'Kendaraan masih memiliki pekerjaan aktif atau belum siap untuk Mulai Pekerjaan.'
        });
      }

      if (reconciledVehicle.status !== 'READY_TO_START') {
        return res.status(409).json({
          error: 'Kendaraan masih memiliki pekerjaan aktif atau belum siap untuk Mulai Pekerjaan.'
        });
      }
    }

    if (type === 'akhiri') {
      if (
        !lastHandover ||
        lastHandover.type !== 'mulai' ||
        reconciledVehicle.status !== 'Active'
      ) {
        return res.status(409).json({
          error: 'Kendaraan belum memiliki pekerjaan aktif yang dapat diakhiri.'
        });
      }

      // Validasi kecocokan kru AMT untuk user bertipe AMT/USER (bukan Admin/Pengawas)
      if (!isAdminOrPengawas) {
        const isAmt1 = isNameMatch(lastHandover.amt1, existingUser.name);
        const isAmt2 = isNameMatch(lastHandover.amt2, existingUser.name);
        const isCreator = String(lastHandover.userId) === String(userId);
        if (!isAmt1 && !isAmt2 && !isCreator) {
          return res.status(403).json({
            error: `Pekerjaan kendaraan ini dimulai oleh kru:\n• AMT 1: ${lastHandover.amt1 || '-'}\n• AMT 2: ${lastHandover.amt2 || '-'}\n\nHanya petugas AMT yang memulai perjalanan ini yang dapat mengakhiri pekerjaan.`
          });
        }
      }
    }

    const handoverNo = await generateHandoverNo();

    // Jalankan seluruh penyimpanan dalam database transaction untuk integritas penuh
    const handover = await prisma.$transaction(async (tx) => {
      // Re-fetch vehicle inside transaction to verify concurrency
      const lockedVeh = await tx.vehicle.findUnique({
        where: { noPolisi }
      });
      if (!lockedVeh) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      if (type === 'mulai') {
        if (lockedVeh.status === 'Active' || lockedVeh.isManualMaintenance || lockedVeh.status === 'Maintenance') {
          throw new Error('VEHICLE_NOT_READY_OR_CONFLICT');
        }
      }

      // 1. Simpan Handover & Items & Photos
      const createdHandover = await tx.handover.create({
        data: {
          id: handoverNo,
          handoverNo,
          userId,
          noPolisi,
          shift,
          type: type || 'mulai',
          status,
          amt1: amt1 || null,
          amt2: amt2 || null,
          notes: req.body.notes || null,
          locationLat: locationLat ? parseFloat(locationLat) : null,
          locationLng: locationLng ? parseFloat(locationLng) : null,
          locationAddress: locationAddress || null,
          locationVillage: locationVillage || null,
          locationDistrict: locationDistrict || null,
          locationCity: locationCity || null,
          locationProvince: locationProvince || null,
          locationCountry: locationCountry || null,
          items: {
            create: parsedItems.map(item => ({
              category: item.category || 'A',
              name: item.name,
              isGood: Boolean(item.isGood),
              severity: item.category === 'B' ? null : (item.severity || (item.name.includes('[MAJOR]') ? 'Major' : (item.name.includes('[MINOR]') ? 'Minor' : null))),
              notes: item.catatan || item.notes || null
            }))
          },
          photos: {
            create: validFiles.map(file => {
              let photoType = 'TERLAMPIR';
              if (file.originalname) {
                let decodedOrig = file.originalname;
                try { decodedOrig = decodeURIComponent(file.originalname); } catch (e) { }
                const nameWithoutExt = decodedOrig.split('.')[0];
                if (nameWithoutExt.startsWith('photo_')) {
                  photoType = nameWithoutExt.replace('photo_', '');
                } else if (nameWithoutExt.startsWith('Kerusakan_')) {
                  photoType = nameWithoutExt.replace('Kerusakan_', 'Kerusakan: ');
                } else {
                  photoType = nameWithoutExt;
                }
              }
              return {
                type: photoType,
                url: (file.path || '').replace(/\\/g, '/'),
                thumbnailUrl: file.thumbnailUrl ? file.thumbnailUrl.replace(/\\/g, '/') : null,
                previewUrl: file.previewUrl ? file.previewUrl.replace(/\\/g, '/') : null,
                originalSize: file.originalSize || 0
              };
            })
          },
          // HANYA buat record Issue jika ada kerusakan kendaraan Kategori A
          issue: vehicleIssueItems.length > 0 ? {
            create: { status: 'ONGOING' }
          } : undefined
        },
        include: {
          items: true,
          photos: true,
          issue: true
        }
      });

      // 2. Simpan Temuan Kepatuhan AMT (Kategori B) secara terpisah
      if (amtIssueItems.length > 0) {
        for (const amtItem of amtIssueItems) {
          const cleanItemName = amtItem.name.replace(/\[MAJOR\]|\[MINOR\]/g, '').trim();
          await tx.amtIssue.create({
            data: {
              handoverId: createdHandover.id,
              userId: userId,
              amtName: amt1 || existingUser.name,
              amtRole: 'AMT_1',
              itemName: cleanItemName,
              category: 'B',
              status: 'PENDING',
              notes: amtItem.catatan || amtItem.notes || null
            }
          });
        }
      }

      // 3. Update Status Kendaraan (HANYA dipengaruhi oleh kondisi Kategori A)
      if (hasMajorIssue) {
        await tx.vehicle.update({
          where: { noPolisi },
          data: {
            status: 'Maintenance',
            isManualMaintenance: false,
            maintenanceReason: `Temuan Major pada Handover ${type.toUpperCase()}`
          }
        });
      } else if (type === 'mulai') {
        await tx.vehicle.update({
          where: { noPolisi },
          data: {
            status: 'Active',
            isManualMaintenance: false,
            maintenanceReason: null
          }
        });
      } else if (type === 'akhiri') {
        const nextStatus = lockedVeh.isManualMaintenance ? 'Maintenance' : 'READY_TO_START';
        await tx.vehicle.update({
          where: { noPolisi },
          data: {
            status: nextStatus,
            ...(lockedVeh.isManualMaintenance ? {} : { maintenanceReason: null })
          }
        });
      }

      return createdHandover;
    });

    // Kirim notifikasi secara asinkron setelah transaksi database berhasil
    if (vehicleIssueItems.length > 0) {
      await sendNotification(handover.id, noPolisi, vehicleIssueItems, hasMajorIssue, 'NEW_ISSUE');
    }

    if (amtIssueItems.length > 0) {
      await sendAmtComplianceNotification(handover.id, noPolisi, amtIssueItems, existingUser, amt1 || existingUser.name);
    }

    // Invalidate semua cache handovers
    await CacheService.delPattern('handovers:*');

    res.status(201).json({ success: true, handover });
  } catch (error) {
    console.error('Submit handover error:', error);
    if (error.message === 'VEHICLE_NOT_READY_OR_CONFLICT') {
      return res.status(409).json({ error: 'Kendaraan baru saja diambil oleh pengemudi lain atau belum siap untuk Mulai Pekerjaan.' });
    }
    if (error.message === 'VEHICLE_NOT_FOUND') {
      return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
    }
    res.status(500).json({ error: error.message });
  }
});

// 2.5 Force Release Shift Gantung
router.post('/force-release', authenticateToken, async (req, res) => {
  try {
    const { noPolisi, reason } = req.body;
    if (!noPolisi) {
      return res.status(400).json({ error: 'Nomor polisi kendaraan wajib diisi' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { noPolisi } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
    }

    const lastHandover = await prisma.handover.findFirst({
      where: { noPolisi },
      orderBy: [
        { timestamp: 'desc' },
        { createdAt: 'desc' }
      ],
      include: { issue: true }
    });

    if (!lastHandover) {
      return res.status(400).json({ error: 'Tidak ada riwayat serah terima untuk kendaraan ini' });
    }

    const isAdminOrPengawas = ['ADMIN', 'SUPER_ADMIN', 'PENGAWAS'].includes(req.user?.role);

    // Jika bukan Admin/Pengawas, validasi bahwa ini benar-benar shift gantung (> 12 jam sejak mulai)
    if (!isAdminOrPengawas) {
      if (lastHandover.type !== 'mulai') {
        return res.status(400).json({ error: 'Hanya shift yang belum diakhiri yang dapat ditutup paksa' });
      }

      const lastTime = new Date(lastHandover.timestamp || lastHandover.createdAt).getTime();
      const elapsedHours = (Date.now() - lastTime) / (1000 * 60 * 60);

      if (elapsedHours < 12) {
        return res.status(403).json({
          error: `Akses ditolak: Shift ini baru berjalan ${elapsedHours.toFixed(1)} jam. Force release hanya diizinkan untuk shift gantung (> 12 jam) atau oleh Pengawas/Admin.`
        });
      }
    }

    const releaseReason = reason || 'Shift gantung ditutup paksa agar mobil siap beroperasi kembali';

    const handoverNo = await generateHandoverNo();
    const forceClose = await prisma.handover.create({
      data: {
        id: handoverNo,
        handoverNo,
        userId: req.user ? req.user.id : lastHandover.userId,
        noPolisi,
        shift: lastHandover.shift || '1',
        type: 'akhiri',
        status: 'FORCE_RELEASED',
        amt1: lastHandover.amt1 || 'Sistem',
        amt2: lastHandover.amt2 || null,
        items: {
          create: [{
            category: 'SYSTEM',
            name: `Force Release: ${releaseReason}`,
            isGood: true
          }]
        }
      }
    });

    await prisma.vehicle.update({
      where: { noPolisi },
      data: { status: 'READY_TO_START' }
    });

    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user ? req.user.id : 'SYSTEM',
          action: 'FORCE_RELEASE_SHIFT',
          noPolisi,
          details: `Shift gantung kendaraan ${noPolisi} ditutup paksa oleh ${req.user ? req.user.name : 'Pengawas'}. Alasan: ${releaseReason}`
        }
      });
    } catch (auditErr) {
      console.error('AuditLog error:', auditErr.message);
    }

    await CacheService.delPattern('handovers:*');

    // Terbitkan scanToken untuk proses 'mulai' setelah force release berhasil
    const scanToken = scanTokenService.issue(
      String(req.user ? req.user.id : lastHandover.userId),
      vehicle.id,
      vehicle.noPolisi,
      'mulai'
    );

    res.json({
      success: true,
      message: `Shift gantung untuk kendaraan ${noPolisi} berhasil ditutup. Kendaraan kini siap untuk Mulai Pekerjaan baru.`,
      handover: forceClose,
      scanToken
    });
  } catch (error) {
    console.error('Force release error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Get Handovers (B2: Role-aware & filter-aware caching)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { status, shift, search, month, year, startDate, endDate } = req.query;
    const userRole = req.user.role;
    const isWorker = userRole === 'AMT' || userRole === 'USER';

    // Build Prisma query filter
    const where = {};
    const andConditions = [];

    if (isWorker) {
      where.userId = req.user.id;
    }

    if (status && status !== 'Semua') {
      if (status === 'Normal') {
        andConditions.push({
          status: 'Siap Operasi (Normal)',
          issue: null,
          items: { none: { isGood: false } }
        });
      } else if (status === 'Isu') {
        andConditions.push({
          OR: [
            { status: { not: 'Siap Operasi (Normal)' } },
            { issue: { isNot: null } },
            { items: { some: { isGood: false } } }
          ]
        });
      } else if (status === 'Selesai') {
        andConditions.push({
          OR: [
            { issue: { status: 'RESOLVED' } },
            { items: { some: { isGood: false, isRepaired: true } } }
          ]
        });
      } else {
        andConditions.push({ status });
      }
    }

    if (shift && shift !== 'Semua') {
      andConditions.push({ shift });
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      andConditions.push({
        OR: [
          { noPolisi: { contains: q } },
          { amt1: { contains: q } },
          { amt2: { contains: q } },
          { handoverNo: { contains: q } }
        ]
      });
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      andConditions.push({ timestamp: { gte: start, lte: end } });
    } else if (year && year !== 'Semua') {
      const yearInt = parseInt(year);
      const monthList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      if (month && month !== 'Semua') {
        const monthIndex = monthList.indexOf(month);
        if (monthIndex !== -1) {
          const startMonth = new Date(yearInt, monthIndex, 1);
          const endMonth = new Date(yearInt, monthIndex + 1, 0, 23, 59, 59, 999);
          andConditions.push({ timestamp: { gte: startMonth, lte: endMonth } });
        }
      } else {
        const startYear = new Date(yearInt, 0, 1);
        const endYear = new Date(yearInt, 11, 31, 23, 59, 59, 999);
        andConditions.push({ timestamp: { gte: startYear, lte: endYear } });
      }
    } else if (month && month !== 'Semua') {
      const monthList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const monthIndex = monthList.indexOf(month);
      if (monthIndex !== -1) {
        const currentYear = new Date().getFullYear();
        const monthOrs = [];
        for (let y = 2020; y <= currentYear + 5; y++) {
          const startMonth = new Date(y, monthIndex, 1);
          const endMonth = new Date(y, monthIndex + 1, 0, 23, 59, 59, 999);
          monthOrs.push({ timestamp: { gte: startMonth, lte: endMonth } });
        }
        andConditions.push({ OR: monthOrs });
      }
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // B2: Cache key mencakup role, user id (jika worker), halaman, limit, dan parameter filter
    const cacheKey = `handovers:r:${userRole}:u:${isWorker ? req.user.id : 'all'}:p:${page}:l:${limit}:st:${status || 'all'}:sh:${shift || 'all'}:q:${search || 'all'}:sd:${startDate || 'all'}:ed:${endDate || 'all'}:m:${month || 'all'}:y:${year || 'all'}`;
    const cachedData = await CacheService.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const [handovers, total] = await Promise.all([
      prisma.handover.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: { name: true, jabatan: true } },
          items: true,
          photos: true,
          issue: true
        }
      }),
      prisma.handover.count({ where })
    ]);

    const responseData = {
      data: handovers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Cache selama 10 menit (600 detik)
    await CacheService.set(cacheKey, responseData, 600);

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.1 Get Single Handover by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let handover = await prisma.handover.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, jabatan: true } },
        items: true,
        photos: true,
        issue: true
      }
    });

    if (!handover) {
      const issue = await prisma.issue.findUnique({
        where: { id },
        select: { handoverId: true }
      });
      if (issue && issue.handoverId) {
        handover = await prisma.handover.findUnique({
          where: { id: issue.handoverId },
          include: {
            user: { select: { name: true, jabatan: true } },
            items: true,
            photos: true,
            issue: true
          }
        });
      }
    }

    if (!handover) {
      return res.status(404).json({ error: 'Data riwayat handover tidak ditemukan.' });
    }

    // Backfill address for legacy data if missing
    if (!handover.locationAddress && handover.locationLat && handover.locationLng) {
      try {
        const geo = await geocodingService.reverseGeocode(handover.locationLat, handover.locationLng);
        if (geo && geo.address) {
          await prisma.handover.update({
            where: { id: handover.id },
            data: {
              locationAddress: geo.address,
              locationVillage: geo.village || null,
              locationDistrict: geo.district || null,
              locationCity: geo.city || null,
              locationProvince: geo.province || null,
              locationCountry: geo.country || null,
            }
          });
          handover.locationAddress = geo.address;
          handover.locationVillage = geo.village;
          handover.locationDistrict = geo.district;
          handover.locationCity = geo.city;
          handover.locationProvince = geo.province;
          handover.locationCountry = geo.country;
        }
      } catch (geoErr) {
        // Non-blocking
      }
    }

    // Worker hanya boleh melihat handover miliknya sendiri
    if ((req.user.role === 'AMT' || req.user.role === 'USER') && handover.userId !== req.user.id) {
      return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki akses ke data ini' });
    }

    res.json({ success: true, handover });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. PUT Handover (Selesaikan Isu - B4: Khusus Admin & Pengawas)
router.put('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN', 'PENGAWAS']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status wajib disertakan' });

    const updatedHandover = await prisma.handover.update({
      where: { id },
      data: { status },
      include: { issue: true }
    });

    if (status === 'Siap Operasi (Normal)') {
      await sendNotification(updatedHandover.id, updatedHandover.noPolisi, [], false, 'RESOLVED');
      await prisma.vehicle.update({
        where: { noPolisi: updatedHandover.noPolisi },
        data: { status: 'READY_TO_START' }
      });

      // Update status issue ke RESOLVED jika ada issue terkait handover ini
      if (updatedHandover.issue) {
        await prisma.issue.update({
          where: { id: updatedHandover.issue.id },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedBy: req.user.id
          }
        });
      }
    }

    await CacheService.delPattern('handovers:*');

    res.json({ success: true, handover: updatedHandover });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
