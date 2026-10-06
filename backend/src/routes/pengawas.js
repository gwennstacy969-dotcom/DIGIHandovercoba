const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { userManageSchema } = require('../validators/schemas');

// 1. GET Pengawas & Admin List
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pengawas = await prisma.user.findMany({
      where: {
        role: 'PENGAWAS',
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
    res.json(pengawas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST Pengawas (Tambah Pengawas - A4: Admin only, A1: Bcrypt hash)
router.post('/', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { error, value } = userManageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const { name, username, password, role, jabatan } = value;

    const existingUser = await prisma.user.findFirst({
      where: { username, deletedAt: null }
    });
    if (existingUser) return res.status(400).json({ error: 'Username sudah digunakan' });

    // A1: Hash password menggunakan bcrypt
    const rawPassword = password && password.trim() !== '' ? password : username;
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newPengawas = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role: role || 'PENGAWAS',
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

    res.status(201).json({ success: true, pengawas: newPengawas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. PUT Pengawas (Ubah Data Pengawas - A4: Admin only, A1: Bcrypt hash if password updated)
router.put('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { name, username, role, password, jabatan } = req.body;

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Data pengawas tidak ditemukan' });
    }

    const updateData = {
      name: name || existing.name,
      username: username || existing.username,
      role: role || existing.role,
      jabatan: jabatan !== undefined ? jabatan : existing.jabatan
    };

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedPengawas = await prisma.user.update({
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

    res.json({ success: true, pengawas: updatedPengawas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. DELETE Pengawas (Hapus Pengawas - A4: Admin only, B7: Soft delete)
router.delete('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Data pengawas tidak ditemukan' });
    }

    // B7: Soft delete
    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        deletedAt: new Date(),
        refreshToken: null
      }
    });

    res.json({ success: true, message: 'Pengawas berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
