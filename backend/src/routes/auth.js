const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { loginSchema } = require('../validators/schemas');
const { authenticateToken } = require('../middleware/auth');
const {
  createSessionAtomic,
  validateSession,
  touchSessionActivity,
  getSessionStatus,
  terminateSession
} = require('../services/sessionService');
const TokenManager = require('../utils/TokenManager');

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_negara_pertamina_123';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh_rahasia_negara_pertamina_123';

// 1. Auth Login (Single Active Session + Rate Limit attempt tracking)
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

      // Catat ke AuditLog jika user ditemukan
      if (user) {
        try {
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'LOGIN_FAILED',
              actionType: 'AUTH',
              details: JSON.stringify({
                username: user.username,
                reason: 'Password salah',
                failedAttempts
              })
            }
          });
        } catch (_) {}
      }

      return res.status(401).json({
        error: 'Username atau password salah',
        failedAttempts,
        showForgotPasswordPrompt
      });
    }

    // Reset penghitung kegagalan login untuk username ini
    try {
      await prisma.loginAttempt.deleteMany({
        where: { normalizedUsername }
      });
    } catch (cleanErr) {
      console.warn('Non-critical: error cleaning login attempts:', cleanErr.message);
    }

    // ==============================================================
    // SINGLE ACTIVE SESSION: Buat sesi baru secara atomik & cegah login ganda
    // ==============================================================
    const sessionResult = await createSessionAtomic(user.id, prisma);

    if (!sessionResult.success) {
      if (sessionResult.conflict) {
        // Catat ke AuditLog penolakan login karena sesi aktif lain
        try {
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'LOGIN_REJECTED_ACTIVE_SESSION',
              actionType: 'SECURITY',
              details: JSON.stringify({
                username: user.username,
                reason: 'Akun sedang memiliki sesi aktif di perangkat lain'
              })
            }
          });
        } catch (_) {}

        return res.status(409).json({
          error: sessionResult.error,
          isSessionConflict: true
        });
      }

      return res.status(400).json({ error: sessionResult.error || 'Gagal membuat sesi login' });
    }

    const { sessionId } = sessionResult;

    // Terbitkan Access Token (1d) dan Refresh Token (7d) yang terikat pada sessionId
    const token = TokenManager.generateAccessToken(user, sessionId);
    const refreshToken = TokenManager.generateRefreshToken(user, sessionId);

    // Simpan refreshToken ke database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    });

    // Catat login berhasil ke AuditLog
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_SUCCESS',
          actionType: 'AUTH',
          details: JSON.stringify({
            username: user.username,
            role: user.role,
            sessionId
          })
        }
      });
    } catch (_) {}

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        jabatan: user.jabatan,
        sessionId
      }
    });
  } catch (error) {
    next(error);
  }
});

// 2. Auth Refresh Token (Terikat Sesi & Tidak Memperpanjang Absolute Timeout)
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

      // Verifikasi sesi aktif
      const sessionCheck = await validateSession(user.id, payload.sessionId, prisma);
      if (!sessionCheck.valid) {
        return res.status(401).json({
          error: sessionCheck.message || 'Sesi telah kedaluwarsa atau dicabut. Silakan login kembali.',
          isSessionExpired: true,
          sessionTerminated: true
        });
      }

      // Terbitkan access token baru dengan sessionId yang sama
      const newToken = TokenManager.generateAccessToken(user, payload.sessionId || user.activeSessionId);

      res.json({ token: newToken });
    });
  } catch (error) {
    next(error);
  }
});

// 3. Auth Logout (Menghapus Sesi Aktif di Database Secara Bersih)
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.user.sessionId;

    // Ambil data user untuk memastikan kita hanya menghapus jika sessionId cocok
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeSessionId: true }
    });

    if (user && (!user.activeSessionId || user.activeSessionId === currentSessionId)) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          activeSessionId: null,
          refreshToken: null
        }
      });
    }

    // Catat ke AuditLog
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'LOGOUT_MANUAL',
          actionType: 'AUTH',
          details: JSON.stringify({
            username: req.user.username,
            sessionId: currentSessionId
          })
        }
      });
    } catch (_) {}

    res.json({ success: true, message: 'Berhasil logout' });
  } catch (error) {
    next(error);
  }
});

// 4. Update Waktu Aktivitas Sesi (Throttled Ping dari Interaksi Pengguna Nyata)
router.post('/session/activity', authenticateToken, async (req, res, next) => {
  try {
    const result = await touchSessionActivity(req.user.id, req.user.sessionId, prisma);
    if (!result.success) {
      return res.status(401).json({
        error: result.message || 'Sesi tidak valid atau telah berakhir',
        isSessionExpired: true
      });
    }

    res.json({
      success: true,
      remainingIdleMs: result.remainingIdleMs,
      remainingAbsoluteMs: result.remainingAbsoluteMs
    });
  } catch (error) {
    next(error);
  }
});

// 5. Cek Status Waktu Sesi (Untuk Warning Countdown Modal di Frontend Tanpa Reset Idle)
router.get('/session/status', authenticateToken, async (req, res, next) => {
  try {
    const status = await getSessionStatus(req.user.id, req.user.sessionId, prisma);
    if (!status.valid) {
      return res.status(401).json({
        error: status.message || 'Sesi telah berakhir',
        isSessionExpired: true
      });
    }

    res.json({
      success: true,
      remainingIdleMs: status.remainingIdleMs,
      remainingAbsoluteMs: status.remainingAbsoluteMs,
      idleTimeoutMs: status.idleTimeoutMs
    });
  } catch (error) {
    next(error);
  }
});

// 6. Register FCM Token
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
