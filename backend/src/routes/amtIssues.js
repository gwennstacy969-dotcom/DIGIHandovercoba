const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// 1. GET All AMT Compliance Issues
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, id: userId, name: userName } = req.user;
    const { status, handoverId, search } = req.query;

    const where = {};
    if (status && status !== 'ALL' && status !== 'Semua') {
      if (status === 'OPEN' || status === 'PENDING') {
        where.status = { in: ['OPEN', 'PENDING'] };
      } else {
        where.status = status;
      }
    }
    if (handoverId) {
      where.handoverId = handoverId;
    }

    // Role-based scoping: AMT only sees their own findings
    if (role === 'AMT' || role === 'USER') {
      where.OR = [
        { userId: userId },
        { amtName: userName },
        { handover: { userId: userId } }
      ];
    }

    let amtIssues = await prisma.amtIssue.findMany({
      where,
      include: {
        handover: {
          include: {
            user: { select: { id: true, name: true, role: true, jabatan: true } }
          }
        },
        user: { select: { id: true, name: true, role: true, jabatan: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      amtIssues = amtIssues.filter(item =>
        (item.itemName && item.itemName.toLowerCase().includes(q)) ||
        (item.amtName && item.amtName.toLowerCase().includes(q)) ||
        (item.handover?.noPolisi && item.handover.noPolisi.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q))
      );
    }

    res.json(amtIssues);
  } catch (error) {
    console.error('Error fetching AMT issues:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. GET Single AMT Compliance Issue
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const amtIssue = await prisma.amtIssue.findUnique({
      where: { id },
      include: {
        handover: {
          include: {
            user: { select: { id: true, name: true, role: true, jabatan: true } }
          }
        },
        user: { select: { id: true, name: true, role: true, jabatan: true } }
      }
    });

    if (!amtIssue) {
      return res.status(404).json({ error: 'Temuan kepatuhan AMT tidak ditemukan' });
    }

    // Role check
    if (['USER', 'AMT'].includes(req.user.role)) {
      const isOwner = amtIssue.userId === req.user.id ||
        amtIssue.amtName === req.user.name ||
        amtIssue.handover?.userId === req.user.id;
      if (!isOwner) {
        return res.status(403).json({ error: 'Tidak ada akses untuk temuan ini' });
      }
    }

    res.json(amtIssue);
  } catch (error) {
    console.error('Error fetching single AMT issue:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. PUT Resolve AMT Compliance Issue (Admin & Pengawas)
router.put('/:id/resolve', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN', 'PENGAWAS']), async (req, res) => {
  try {
    const { id } = req.params;
    const { actionTaken, notes } = req.body;

    const existing = await prisma.amtIssue.findUnique({
      where: { id },
      include: { handover: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Temuan kepatuhan AMT tidak ditemukan' });
    }

    const resolver = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, username: true }
    });
    const resolverName = resolver?.name || req.user?.name || req.user?.username || 'ADMIN';

    const updated = await prisma.amtIssue.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        actionTaken: actionTaken || 'Perlengkapan telah dilengkapi dan diverifikasi oleh pengawas',
        notes: notes !== undefined ? notes : existing.notes,
        resolvedAt: new Date(),
        resolvedBy: resolverName
      }
    });

    // Kirim notifikasi konfirmasi ke AMT terkait
    try {
      const targetUserId = existing.userId || existing.handover?.userId;
      if (targetUserId) {
        await prisma.notification.create({
          data: {
            title: 'Isu Perlengkapan AMT Diselesaikan',
            message: `Temuan perlengkapan "${existing.itemName}" untuk ${existing.amtName} telah diverifikasi selesai oleh ${req.user.name}.`,
            type: 'SUCCESS',
            targetRole: 'USER',
            targetUserId: targetUserId,
            actionType: 'VIEW_AMT_ISSUE',
            actionId: existing.id,
            noPolisi: existing.handover?.noPolisi || null,
            isRead: false
          }
        });
      }
    } catch (notifErr) {
      console.warn('Failed to send resolve notification for AMT issue:', notifErr.message);
    }

    res.json({ success: true, amtIssue: updated });
  } catch (error) {
    console.error('Error resolving AMT issue:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. PUT Resolve All AMT Issues for a Handover
router.put('/handover/:handoverId/resolve', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN', 'PENGAWAS']), async (req, res) => {
  try {
    const { handoverId } = req.params;
    const { actionTaken } = req.body;

    const countResult = await prisma.amtIssue.updateMany({
      where: { handoverId, status: 'PENDING' },
      data: {
        status: 'RESOLVED',
        actionTaken: actionTaken || 'Seluruh perlengkapan AMT telah dilengkapi dan diverifikasi',
        resolvedAt: new Date(),
        resolvedBy: req.user ? req.user.name : 'ADMIN'
      }
    });

    res.json({ success: true, count: countResult.count, message: 'Seluruh temuan kepatuhan AMT pada handover ini telah diselesaikan' });
  } catch (error) {
    console.error('Error resolving all AMT issues for handover:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
