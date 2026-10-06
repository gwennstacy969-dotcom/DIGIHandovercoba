const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { userManageSchema } = require('../validators/schemas');

// 1. GET All Admins (Khusus Admin & Super Admin)
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
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST Tambah Admin Baru (Khusus Admin & Super Admin)
router.post('/', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { error, value } = userManageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const { name, username, password, role, jabatan } = value;

    const existingUser = await prisma.user.findFirst({
      where: { username, deletedAt: null }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Username sudah digunakan oleh akun lain' });
    }

    // Hash password dengan bcrypt
    const rawPassword = password && password.trim() !== '' ? password : 'admin123';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newAdmin = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role: role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
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

    res.status(201).json({ success: true, admin: newAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. PUT Ubah Data Admin (Khusus Admin & Super Admin)
router.put('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { name, username, role, password, jabatan } = req.body;
    const targetId = req.params.id;

    const existingAdmin = await prisma.user.findFirst({
      where: { id: targetId, deletedAt: null }
    });
    if (!existingAdmin) {
      return res.status(404).json({ error: 'Data admin tidak ditemukan' });
    }

    // Jika username diubah, pastikan tidak duplikat dengan akun lain
    if (username && username !== existingAdmin.username) {
      const duplicate = await prisma.user.findFirst({
        where: { username, id: { not: targetId }, deletedAt: null }
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Username baru sudah digunakan oleh akun lain' });
      }
    }

    const updateData = {
      name: name || existingAdmin.name,
      username: username || existingAdmin.username,
      role: role ? (role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN') : existingAdmin.role,
      jabatan: jabatan !== undefined ? jabatan : existingAdmin.jabatan
    };

    // Update password jika diisi
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
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

    res.json({ success: true, admin: updatedAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. DELETE Hapus Admin (Soft Delete - Khusus Admin & Super Admin)
router.delete('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
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

    // Proteksi 2: Pastikan setidaknya ada 1 Admin yang tetap aktif di sistem
    const activeAdminsCount = await prisma.user.count({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletedAt: null }
    });
    if (activeAdminsCount <= 1) {
      return res.status(400).json({
        error: 'Tidak dapat menghapus Admin terakhir. Sistem memerlukan minimal 1 Admin aktif.'
      });
    }

    // Soft delete
    await prisma.user.update({
      where: { id: targetId },
      data: {
        deletedAt: new Date(),
        refreshToken: null
      }
    });

    res.json({ success: true, message: 'Admin berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
