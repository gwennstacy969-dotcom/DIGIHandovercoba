const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { userManageSchema } = require('../validators/schemas');
const { revokeUserSessionByAdmin, isSessionLive } = require('../services/sessionService');

// 1. GET All Admins (Khusus Super Admin & Admin)
router.get('/', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        jabatan: true,
        createdAt: true,
        updatedAt: true,
        activeSessionId: true,
        sessionStartedAt: true,
        sessionLastActivityAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST Tambah Admin Baru (KHUSUS SUPER_ADMIN)
// ADMIN biasa DITOLAK (HTTP 403 Forbidden)
router.post('/', authenticateToken, authorizeRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { error, value } = userManageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const { name, username, password, jabatan } = value;

    const existingUser = await prisma.user.findFirst({
      where: { username: username.trim(), deletedAt: null }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Username sudah digunakan oleh akun lain' });
    }

    // Role yang dibuat melalui modul ini selalu ADMIN biasa (SUPER_ADMIN tidak boleh dipilih publik/form biasa)
    const rawPassword = password && password.trim() !== '' ? password : 'admin123';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newAdmin = await prisma.user.create({
      data: {
        name,
        username: username.trim(),
        password: hashedPassword,
        role: 'ADMIN',
        jabatan: jabatan || 'Administrator Distribusi'
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        jabatan: true,
        createdAt: true
      }
    });

    // Catat ke AuditLog
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATE_ADMIN',
          actionType: 'ADMIN_MANAGEMENT',
          actionId: newAdmin.id,
          details: JSON.stringify({
            createdAdminId: newAdmin.id,
            createdUsername: newAdmin.username,
            createdBy: req.user.username
          })
        }
      });
    } catch (_) {}

    res.status(201).json({ success: true, admin: newAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. PUT Ubah Data Admin (KHUSUS SUPER_ADMIN)
// ADMIN biasa DITOLAK (HTTP 403 Forbidden)
router.put('/:id', authenticateToken, authorizeRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, username, password, jabatan } = req.body;
    const targetId = req.params.id;

    const existingAdmin = await prisma.user.findFirst({
      where: { id: targetId, deletedAt: null }
    });
    if (!existingAdmin) {
      return res.status(404).json({ error: 'Data admin tidak ditemukan' });
    }

    // Jika username diubah, pastikan tidak duplikat dengan akun lain
    if (username && username.trim() !== existingAdmin.username) {
      const duplicate = await prisma.user.findFirst({
        where: { username: username.trim(), id: { not: targetId }, deletedAt: null }
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Username baru sudah digunakan oleh akun lain' });
      }
    }

    const updateData = {
      name: name ? name.trim() : existingAdmin.name,
      username: username ? username.trim() : existingAdmin.username,
      jabatan: jabatan !== undefined ? jabatan : existingAdmin.jabatan
    };

    // Update password jika diisi
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    const updatedAdmin = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        jabatan: true,
        updatedAt: true
      }
    });

    // Catat ke AuditLog
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'UPDATE_ADMIN',
          actionType: 'ADMIN_MANAGEMENT',
          actionId: targetId,
          details: JSON.stringify({
            targetId,
            targetUsername: updatedAdmin.username,
            updatedBy: req.user.username
          })
        }
      });
    } catch (_) {}

    res.json({ success: true, admin: updatedAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. DELETE Hapus/Nonaktifkan Admin (KHUSUS SUPER_ADMIN)
// ADMIN biasa DITOLAK (HTTP 403 Forbidden)
router.delete('/:id', authenticateToken, authorizeRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const targetId = req.params.id;

    // Proteksi 1: Tidak boleh menghapus diri sendiri yang sedang login
    if (req.user && req.user.id === targetId) {
      return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif' });
    }

    const existing = await prisma.user.findFirst({
      where: { id: targetId, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Data admin tidak ditemukan' });
    }

    // Proteksi 2: Jika target adalah SUPER_ADMIN, pastikan bukan Super Admin terakhir
    if (existing.role === 'SUPER_ADMIN') {
      const superAdminsCount = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', deletedAt: null }
      });
      if (superAdminsCount <= 1) {
        return res.status(400).json({
          error: 'Tidak dapat menghapus Super Admin terakhir. Sistem memerlukan minimal 1 Super Admin aktif.'
        });
      }
    }

    // Proteksi 3: Pastikan setidaknya ada 1 Admin/Super Admin yang tetap aktif di sistem
    const activeAdminsCount = await prisma.user.count({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletedAt: null }
    });
    if (activeAdminsCount <= 1) {
      return res.status(400).json({
        error: 'Tidak dapat menghapus Admin terakhir. Sistem memerlukan minimal 1 administrator aktif.'
      });
    }

    // Soft delete & bersihkan sesi aktif pengguna target
    await prisma.user.update({
      where: { id: targetId },
      data: {
        deletedAt: new Date(),
        activeSessionId: null,
        refreshToken: null
      }
    });

    // Catat ke AuditLog
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'DEACTIVATE_ADMIN',
          actionType: 'ADMIN_MANAGEMENT',
          actionId: targetId,
          details: JSON.stringify({
            targetId,
            targetUsername: existing.username,
            targetRole: existing.role,
            deactivatedBy: req.user.username
          })
        }
      });
    } catch (_) {}

    res.json({ success: true, message: `Admin ${existing.username} berhasil dinonaktifkan` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. GET All Active Sessions (KHUSUS SUPER_ADMIN)
router.get('/sessions/active', authenticateToken, authorizeRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const usersWithSessions = await prisma.user.findMany({
      where: {
        activeSessionId: { not: null },
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        jabatan: true,
        activeSessionId: true,
        sessionStartedAt: true,
        sessionLastActivityAt: true,
        sessionExpiresAt: true
      },
      orderBy: { sessionLastActivityAt: 'desc' }
    });

    const now = Date.now();
    const result = usersWithSessions.map(u => {
      const live = isSessionLive(u, now);
      return {
        ...u,
        isLive: live.isActive,
        idleExpired: live.reason === 'IDLE_TIMEOUT',
        absoluteExpired: live.reason === 'ABSOLUTE_TIMEOUT'
      };
    });

    res.json({
      success: true,
      sessions: result,
      activeSessions: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. POST Revoke Sesi Pengguna Lain (KHUSUS SUPER_ADMIN)
router.post('/sessions/:userId/revoke', authenticateToken, authorizeRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Alasan pencabutan sesi wajib disertakan untuk catatan audit' });
    }

    const result = await revokeUserSessionByAdmin(
      targetUserId,
      req.user.id,
      reason.trim(),
      prisma
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
