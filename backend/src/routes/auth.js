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

// 1. Auth Login (Bcrypt verification, server-side attempt tracking, no 15-min lockout)
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const { username, password } = value;
    const normalizedUsername = (username || '').trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        username: username.trim(),
        deletedAt: null // Jangan izinkan user yang telah di-soft-delete login
      }
    });

    const isCredentialInvalid = !user || !(await bcrypt.compare(password, user.password));

    if (isCredentialInvalid) {
      // Hitung kegagalan secara andal di server-side untuk username ini
      let failedAttempts = 1;
      try {
        const attempt = await prisma.loginAttempt.upsert({
          where: { normalizedUsername },
          update: {
            failedAttempts: { increment: 1 },
            lastAttemptAt: new Date()
          },
          create: {
            normalizedUsername,
            failedAttempts: 1,
            lastAttemptAt: new Date()
          }
        });
        failedAttempts = attempt.failedAttempts;
      } catch (attErr) {
        console.error('Error tracking login attempt:', attErr.message);
      }

      const showForgotPasswordPrompt = failedAttempts >= 3;

      // Pesan tetap generik tanpa membocorkan eksistensi akun, tapi menyertakan failedAttempts & showForgotPasswordPrompt
      return res.status(401).json({
        error: 'Username atau password salah',
        failedAttempts,
        showForgotPasswordPrompt
      });
    }

    // Login Berhasil -> Reset penghitung kegagalan untuk username ini
    try {
      await prisma.loginAttempt.deleteMany({
        where: { normalizedUsername }
      });
    } catch (cleanErr) {
      console.warn('Non-critical: error cleaning login attempts:', cleanErr.message);
    }

    const payload = { id: user.id, username: user.username, role: user.role };
    
    // Access token berdurasi 1 hari (1d / 24 jam)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    });

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
