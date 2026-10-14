const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');

// 1. GET Notifications (B3: User-targeted & role-based)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    let targetRoles = [];
    if (role === 'AMT' || role === 'USER') {
      targetRoles = ['USER', 'AMT', 'ALL'];
    } else if (role === 'PENGAWAS') {
      targetRoles = ['PENGAWAS', 'ALL'];
    } else {
      // ADMIN, SUPER_ADMIN
      targetRoles = ['ADMIN', 'SUPER_ADMIN', 'ALL'];
    }

    const limit = parseInt(req.query.limit) || 250;
    const { date, noPolisi, search } = req.query;

    const where = {
      OR: [
        { targetUserId: userId },
        {
          targetRole: { in: targetRoles },
          targetUserId: null
        }
      ]
    };

    if (noPolisi) {
      where.noPolisi = { contains: noPolisi.replace(/\s+/g, '') };
    }

    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      where.createdAt = { gte: start, lte: end };
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search } },
            { message: { contains: search } },
            { noPolisi: { contains: search.replace(/\s+/g, '') } }
          ]
        }
      ];
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. PUT Mark Single Notification as Read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: 'Notifikasi tidak ditemukan' });

    const role = req.user.role;
    const userId = req.user.id;
    let targetRoles = [];
    if (role === 'AMT' || role === 'USER') {
      targetRoles = ['USER', 'AMT', 'ALL'];
    } else if (role === 'PENGAWAS') {
      targetRoles = ['PENGAWAS', 'ALL'];
    } else {
      targetRoles = ['ADMIN', 'SUPER_ADMIN', 'ALL'];
    }

    const isTargetUser = notification.targetUserId === userId;
    const isTargetRole = !notification.targetUserId && targetRoles.includes(notification.targetRole);

    if (!isTargetUser && !isTargetRole) {
      return res.status(403).json({ error: 'Tidak ada akses untuk notifikasi ini' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
    res.json({ success: true, notification: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. PUT Mark All Notifications as Read for current user
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    let targetRoles = [];
    if (role === 'AMT' || role === 'USER') {
      targetRoles = ['USER', 'AMT', 'ALL'];
    } else if (role === 'PENGAWAS') {
      targetRoles = ['PENGAWAS', 'ALL'];
    } else {
      targetRoles = ['ADMIN', 'SUPER_ADMIN', 'ALL'];
    }

    await prisma.notification.updateMany({
      where: {
        isRead: false,
        OR: [
          { targetUserId: userId },
          {
            targetRole: { in: targetRoles },
            targetUserId: null
          }
        ]
      },
      data: { isRead: true }
    });

    res.json({ success: true, message: 'Semua notifikasi ditandai telah dibaca' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
