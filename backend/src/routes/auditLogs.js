const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// GET All Audit Logs (KHUSUS SUPER_ADMIN)
router.get('/', authenticateToken, authorizeRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const { action, actionType, startDate, endDate, search } = req.query;

    const where = {};

    if (action) {
      where.action = action;
    }

    if (actionType) {
      where.actionType = actionType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { details: { contains: search } },
        { action: { contains: search } },
        { noPolisi: { contains: search } }
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      logs: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
