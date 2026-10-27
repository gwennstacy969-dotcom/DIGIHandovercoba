const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
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

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 menit lockout

// IP-based Rate Limiter khusus endpoint login untuk mencegah brute force distributed spray
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 200 : 30, // 30 percobaan per 15 menit per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Terlalu banyak permintaan login dari alamat IP ini. Silakan tunggu 15 menit.'
  }
});

// 1. Auth Login (Single Active Session + Account-Level Brute Force Lockout)
router.post('/login', loginIpLimiter, async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const { username, password } = value;
    const normalizedUsername = (username || '').trim().toLowerCase();

    // 1. Periksa apakah akun sedang dalam masa lockout sementara
    try {
      const existingAttempt = await prisma.loginAttempt.findUnique({
        where: { normalizedUsername }
      });

      if (existingAttempt && existingAttempt.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        const elapsed = Date.now() - new Date(existingAttempt.lastAttemptAt).getTime();
        if (elapsed < LOCKOUT_DURATION_MS) {
          const remainingSeconds = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 1000);
          return res.status(429).json({
            error: `Akun ini ditangguhkan sementara karena terlalu banyak percobaan login yang gagal. Silakan coba lagi dalam ${remainingSeconds} detik atau hubungi Super Admin.`,
            isLockedOut: true,
            remainingSeconds
          });
        } else {
          // Lockout 5 menit telah selesai, reset hitungan kegagalan
          await prisma.loginAttempt.update({
            where: { normalizedUsername },
            data: { failedAttempts: 0, lastAttemptAt: new Date() }
          });
        }
      }
    } catch (lockCheckErr) {
      console.warn('Non-critical: error checking loginAttempt lockout:', lockCheckErr.message);
    }

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

      // Jika mencapai batas maksimal percobaan, berlakukan lockout 5 menit
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        try {
          await prisma.auditLog.create({
            data: {
              userId: user ? user.id : 'SYSTEM',
              action: 'ACCOUNT_LOCKOUT_TRIGGERED',
              actionType: 'SECURITY',
              details: JSON.stringify({
                username: normalizedUsername,
                failedAttempts,
                lockoutMinutes: 5,
                timestamp: new Date().toISOString()
              })
            }
          });
        } catch (_) {}

        return res.status(429).json({
          error: 'Akun ditangguhkan sementara selama 5 menit karena 5 kali percobaan login gagal berturut-turut.',
          isLockedOut: true,
          remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000)
        });
      }

      const showForgotPasswordPrompt = failedAttempts >= 3;

      // Catat ke AuditLog kegagalan login tanpa mencatat password
      if (user) {
        try {
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'LOGIN_FAILED',
              actionType: 'AUTH',
              details: JSON.stringify({
                username: user.username,
                reason: 'Kredensial tidak valid',
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

    // Reset penghitung kegagalan login untuk username ini setelah kredensial benar
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
    let refreshSecret;
    try {
      refreshSecret = TokenManager.getRefreshSecret();
    } catch (secErr) {
      console.error('Refresh Secret configuration error:', secErr.message);
      return res.status(500).json({ error: 'Terjadi kesalahan konfigurasi keamanan server' });
    }

    jwt.verify(refreshToken, refreshSecret, async (err, payload) => {
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

// 3. Auth Logout (Menghapus Sesi Aktif di Database Secara Bersih & Atomik)
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.user.sessionId;

    // Cabut sesi spesifik sessionId ini secara atomik.
    // Jika akun telah login di sesi baru S2, pencabutan S1 TIDAK akan menghapus S2.
    await terminateSession(userId, currentSessionId, prisma);

    // Catat ke AuditLog tanpa password/token
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'LOGOUT_MANUAL',
          actionType: 'AUTH',
          details: JSON.stringify({
            username: req.user.username,
            sessionId: currentSessionId,
            loggedOutAt: new Date().toISOString()
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
      remainingAbsoluteMs: result.remainingAbsoluteMs,
      session: {
        remainingIdleSeconds: Math.max(0, Math.floor(result.remainingIdleMs / 1000)),
        remainingAbsoluteSeconds: Math.max(0, Math.floor(result.remainingAbsoluteMs / 1000)),
        isExpired: false
      }
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
      idleTimeoutMs: status.idleTimeoutMs,
      session: {
        remainingIdleSeconds: Math.max(0, Math.floor(status.remainingIdleMs / 1000)),
        remainingAbsoluteSeconds: Math.max(0, Math.floor(status.remainingAbsoluteMs / 1000)),
        isExpired: false
      }
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
