const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const prisma = require('../config/prisma');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { vehicleSchema } = require('../validators/schemas');

const { generateQrPosterBuffer } = require('../utils/qrPosterGenerator');
const scanTokenService = require('../services/scanTokenService');
const { reconcileVehicleOperationalStatus } = require('../services/vehicleStatusService');

const barcodesDir = path.join(__dirname, '../../barcodes');
if (!fs.existsSync(barcodesDir)) {
  fs.mkdirSync(barcodesDir, { recursive: true });
}

// 0. API Unduh / Lihat Poster Template QR Siap Cetak (Pertamina Layout)
router.get('/poster/:barcode', async (req, res) => {
  try {
    const rawBarcode = req.params.barcode;
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { barcode: rawBarcode },
          { noPolisi: rawBarcode }
        ]
      }
    });

    const noPolisi = vehicle ? vehicle.noPolisi : rawBarcode;
    const barcode = vehicle ? vehicle.barcode : rawBarcode;

    const posterBuffer = await generateQrPosterBuffer(noPolisi, barcode);

    res.setHeader('Content-Type', 'image/png');
    if (req.query.download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="QR_Handover_${noPolisi.replace(/\s+/g, '_')}.png"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="QR_Handover_${noPolisi.replace(/\s+/g, '_')}.png"`);
    }
    return res.send(posterBuffer);
  } catch (err) {
    console.error('Error generating QR poster:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 0. API Scan Barcode Kendaraan (A5: Terproteksi otentikasi)
// KEAMANAN: Hanya mencari berdasarkan barcode terdaftar.
// Plat nomor TIDAK digunakan sebagai fallback — scan QR fisik wajib dilakukan.
router.get('/scan/:barcode', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    const rawCode = decodeURIComponent(req.params.barcode || '').trim();

    // Normalisasi: handle prefix BC_ yang mungkin ada atau tidak ada di QR code
    const cleanCode = rawCode.replace(/\s+/g, '').toUpperCase();
    const withPrefix = cleanCode.startsWith('BC_') ? cleanCode : `BC_${cleanCode}`;
    const withoutPrefix = cleanCode.replace(/^BC_/i, '');
    const rawWithPrefix = rawCode.startsWith('BC_') ? rawCode : `BC_${rawCode}`;
    const rawWithoutPrefix = rawCode.replace(/^BC_/i, '').trim();

    // HANYA cari berdasarkan kolom barcode — TIDAK menggunakan noPolisi sebagai fallback.
    // Input berisi plat nomor saja akan ditolak karena bukan nilai barcode yang sah.
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { barcode: rawCode },
          { barcode: rawWithPrefix },
          { barcode: rawWithoutPrefix },
          { barcode: cleanCode },
          { barcode: withPrefix },
          { barcode: withoutPrefix }
        ]
      }
    });
    if (!vehicle) return res.status(404).json({ error: 'Barcode QR tidak terdaftar di sistem. Pastikan Anda memindai QR Code resmi yang tertera pada kendaraan.' });

    // 1. Rekonsiliasi status operasional kendaraan secara terpusat sebelum data dikirim ke frontend
    const {
      vehicle: reconciledVehicle,
      lastHandover,
      hasActiveMajorIssue
    } = await reconcileVehicleOperationalStatus(vehicle, prisma);

    const activeVehicle = reconciledVehicle || vehicle;

    // 2. Cek apakah user sedang memiliki pekerjaan "mulai" yang belum diakhiri dan tidak ada isu/kerusakan
    let activeUserHandover = null;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true }
      });
      const conditions = [{ userId: userId }];
      if (user?.name) {
        conditions.push({ amt1: user.name });
        conditions.push({ amt2: user.name });
      }

      const userLastHandover = await prisma.handover.findFirst({
        where: { OR: conditions },
        orderBy: [
          { timestamp: 'desc' },
          { createdAt: 'desc' }
        ],
        include: { issue: true, items: true }
      });

      if (userLastHandover && userLastHandover.type === 'mulai' && !userLastHandover.issue) {
        // Cek apakah kendaraan ini sudah diakhiri setelah handover mulai ini
        const subsequentAkhiri = await prisma.handover.findFirst({
          where: {
            noPolisi: userLastHandover.noPolisi,
            type: 'akhiri',
            OR: [
              { timestamp: { gt: userLastHandover.timestamp } },
              {
                timestamp: userLastHandover.timestamp,
                createdAt: { gt: userLastHandover.createdAt }
              }
            ]
          },
          orderBy: [
            { timestamp: 'desc' },
            { createdAt: 'desc' }
          ]
        });

        if (!subsequentAkhiri) {
          // Cek kerusakan Major (Hanya Kategori A)
          const hasMajorBlock = userLastHandover.items?.some(item => !item.isGood && (item.category === 'A' || !item.category || item.category !== 'B') && ((item.severity && item.severity.toLowerCase() === 'major') || (item.name && item.name.includes('[MAJOR]'))));
          if (!hasMajorBlock) {
            activeUserHandover = userLastHandover;
          }
        }
      }
    }

    // 3. Deteksi shift gantung (> 12 jam sejak mulai tanpa diakhiri)
    let isHangingShift = false;
    let elapsedHours = 0;
    if (lastHandover && lastHandover.type === 'mulai' && !hasActiveMajorIssue) {
      const lastTime = new Date(lastHandover.timestamp || lastHandover.createdAt).getTime();
      elapsedHours = Math.round(((Date.now() - lastTime) / (1000 * 60 * 60)) * 10) / 10;
      if (elapsedHours > 12) {
        isHangingShift = true;
      }
    }

    // 4. Issue scan token satu kali pakai — diikat pada userId + vehicleId + processType
    // Token ini harus disertakan saat submit handover untuk membuktikan scan telah dilakukan
    const processType = req.query.processType || 'mulai';
    const scanToken = scanTokenService.issue(
      String(userId || ''),
      activeVehicle.id,
      activeVehicle.noPolisi,
      processType
    );

    res.json({
      success: true,
      vehicle: activeVehicle,
      lastHandover,
      activeUserHandover,
      isHangingShift,
      elapsedHours,
      scanToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 1. GET All Vehicles (Untuk Pengawas / Admin / Seleksi)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST Vehicle (Tambah Truk Baru - A4: Khusus Admin)
router.post('/', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { error, value } = vehicleSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const { noPolisi, barcode, jenisKendaraan, kapasitas, brand, status } = value;

    const existingVehicle = await prisma.vehicle.findFirst({
      where: { OR: [{ noPolisi }, { barcode }] }
    });
    if (existingVehicle) {
      return res.status(400).json({ error: 'Nomor Polisi atau Barcode sudah terdaftar' });
    }

    // Auto-generate sequential ID VH-xxx
    const lastVehicle = await prisma.vehicle.findFirst({
      where: { id: { startsWith: 'VH-' } },
      orderBy: { id: 'desc' }
    });
    let nextNum = 1;
    if (lastVehicle && lastVehicle.id) {
      const match = lastVehicle.id.match(/VH-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const id = `VH-${String(nextNum).padStart(3, '0')}`;

    const vehicle = await prisma.vehicle.create({
      data: {
        id,
        noPolisi,
        barcode,
        jenisKendaraan,
        kapasitas,
        brand,
        status: status || 'READY_TO_START'
      }
    });

    // Generate QR Code image in HD
    const qrPath = path.join(barcodesDir, `${barcode}.png`);
    await QRCode.toFile(qrPath, barcode, {
      errorCorrectionLevel: 'H',
      width: 1024,
      margin: 4,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    res.status(201).json({ success: true, vehicle });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. PUT Vehicle (Ubah Data Truk - A4: Khusus Admin)
router.put('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { noPolisi, barcode, jenisKendaraan, kapasitas, brand, status } = req.body;
    const vehicleId = req.params.id;

    const oldVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!oldVehicle) {
      return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { noPolisi, barcode, jenisKendaraan, kapasitas, brand, status: status || oldVehicle.status }
    });

    if (oldVehicle.barcode !== barcode) {
      const oldQrPath = path.join(barcodesDir, `${oldVehicle.barcode}.png`);
      if (fs.existsSync(oldQrPath)) fs.unlinkSync(oldQrPath);

      const newQrPath = path.join(barcodesDir, `${barcode}.png`);
      await QRCode.toFile(newQrPath, barcode, {
        errorCorrectionLevel: 'H',
        width: 1024,
        margin: 4,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
    }

    res.json({
      success: true,
      vehicle,
      status: vehicle.status,
      isManualMaintenance: vehicle.isManualMaintenance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. DELETE Vehicle (Hapus Truk - A4: Khusus Admin)
router.delete('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
    }

    await prisma.vehicle.delete({ where: { id: vehicleId } });

    const qrPath = path.join(barcodesDir, `${vehicle.barcode}.png`);
    if (fs.existsSync(qrPath)) {
      fs.unlinkSync(qrPath);
    }

    res.json({ success: true, message: 'Kendaraan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. PUT Vehicle Status (Ubah ke Maintenance / Active / dll - Admin & Pengawas)
router.put('/:id/status', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN', 'PENGAWAS']), async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!status) return res.status(400).json({ error: 'Status wajib disertakan' });

    const updateData = { status };
    if (status === 'Maintenance') {
      updateData.isManualMaintenance = true;
      updateData.maintenanceReason = reason ? String(reason).trim() : 'MANUAL_MAINTENANCE_SUPERVISOR';
    } else {
      updateData.isManualMaintenance = false;
      updateData.maintenanceReason = null;
    }

    const targetVeh = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { noPolisi: req.params.id }
        ]
      }
    });

    if (!targetVeh) {
      return res.status(404).json({ error: 'Kendaraan tidak ditemukan' });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: targetVeh.id },
      data: updateData
    });

    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'UPDATE_VEHICLE_STATUS',
          actionType: 'VEHICLE',
          noPolisi: vehicle.noPolisi,
          details: JSON.stringify({
            vehicleId: vehicle.id,
            noPolisi: vehicle.noPolisi,
            status,
            isManualMaintenance: updateData.isManualMaintenance,
            reason: updateData.maintenanceReason,
            updatedBy: req.user.name || req.user.username
          })
        }
      });
    } catch (_) {}

    res.json({
      success: true,
      vehicle,
      status: vehicle.status,
      isManualMaintenance: vehicle.isManualMaintenance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
