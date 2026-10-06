const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const prisma = require('../config/prisma');
const { loginSchema } = require('../validators/schemas');
const { authenticateToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!JWT_SECRET || !REFRESH_SECRET) {
  console.error('FATAL: JWT_SECRET or REFRESH_SECRET is missing from environment!');
}

// C5: Limiter khusus login (Maks 10 percobaan per 15 menit)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login yang gagal. Silakan coba lagi dalam 15 menit.' }
});

// 1. Auth Login (A1: Bcrypt only, C7: Token 1 jam)
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const { username, password } = value;

    const user = await prisma.user.findFirst({
      where: {
        username,
        deletedAt: null // B7: Jangan izinkan user yang telah di-soft-delete login
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    // A1: Verifikasi password secara aman via bcrypt tanpa plain-text fallback
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const payload = { id: user.id, username: user.username, role: user.role };
    
    // Access token berdurasi 1 hari (1d / 24 jam)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    });

    // Reset/selesaikan permohonan lupa password yang masih PENDING karena user berhasil login
    try {
      await prisma.passwordResetRequest.updateMany({
        where: {
          userId: user.id,
          status: 'PENDING'
        },
        data: {
          status: 'RESOLVED',
          adminNotes: 'Otomatis diselesaikan oleh sistem karena user berhasil mengingat password dan login.'
        }
      });

      // Tandai notifikasi lupa password terkait sebagai sudah terbaca
      await prisma.notification.updateMany({
        where: {
          type: 'AUTH',
          title: 'Permintaan Reset Password',
          message: { contains: `(${user.username})` },
          isRead: false
        },
        data: { isRead: true }
      });
    } catch (resetErr) {
      console.log('Non-critical: error resetting pending password reset on login:', resetErr.message);
    }

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        jabatan: user.jabatan
      }
    });
  } catch (error) {
    next(error);
  }
});

// 1a. Auth Refresh Token
router.post('/refresh', async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token diperlukan' });

  try {
    jwt.verify(refreshToken, REFRESH_SECRET, async (err, payload) => {
      if (err) return res.status(403).json({ error: 'Refresh token tidak valid atau kadaluarsa' });

      const user = await prisma.user.findFirst({
        where: { id: payload.id, deletedAt: null }
      });

      if (!user || user.refreshToken !== refreshToken) {
        return res.status(403).json({ error: 'Refresh token tidak cocok atau telah dicabut' });
      }

      const newPayload = { id: user.id, username: user.username, role: user.role };
      const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '1d' });

      res.json({ token: newToken });
    });
  } catch (error) {
    next(error);
  }
});

// 1b. Auth Logout
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null }
    });
    res.json({ success: true, message: 'Berhasil logout' });
  } catch (error) {
    next(error);
  }
});

// 1c. Register FCM Token
router.post('/fcm-token', authenticateToken, async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'FCM Token diperlukan' });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken }
    });
    res.json({ success: true, message: 'FCM Token berhasil disimpan' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
