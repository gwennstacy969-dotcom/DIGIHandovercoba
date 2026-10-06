const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { userManageSchema } = require('../validators/schemas');

// 1. GET Workers (Pekerja AMT)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const workers = await prisma.user.findMany({
      where: {
        role: { in: ['AMT', 'USER'] },
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        jabatan: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(workers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST Worker (Tambah Pekerja - A4: Admin only, A1: Bcrypt hash)
router.post('/', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { error, value } = userManageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const { name, username, password, role, jabatan } = value;

    const existingUser = await prisma.user.findFirst({
      where: { username, deletedAt: null }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    // A1: Hash password menggunakan bcrypt
    const rawPassword = password && password.trim() !== '' ? password : username;
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newWorker = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role: role || 'AMT',
        jabatan: jabatan || null
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

    res.status(201).json({ success: true, worker: newWorker });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. PUT Worker (Ubah Data Pekerja - A4: Admin only, A1: Bcrypt hash if password updated)
router.put('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { name, username, role, password, jabatan } = req.body;

    const existingWorker = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });
    if (!existingWorker) {
      return res.status(404).json({ error: 'Data pekerja tidak ditemukan' });
    }

    const updateData = {
      name: name || existingWorker.name,
      username: username || existingWorker.username,
      role: role || existingWorker.role,
      jabatan: jabatan !== undefined ? jabatan : existingWorker.jabatan
    };

    // A1: Hash password jika diubah
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedWorker = await prisma.user.update({
      where: { id: req.params.id },
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

    res.json({ success: true, worker: updatedWorker });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. DELETE Worker (Hapus Pekerja - A4: Admin only, B7: Soft delete)
router.delete('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Data pekerja tidak ditemukan' });
    }

    // B7: Gunakan soft delete agar relasi riwayat handover masa lalu tidak rusak
    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        deletedAt: new Date(),
        refreshToken: null
      }
    });

    res.json({ success: true, message: 'Pekerja berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
