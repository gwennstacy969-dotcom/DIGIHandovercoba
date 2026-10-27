const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { validateSession } = require('../services/sessionService');
const TokenManager = require('../utils/TokenManager');

/**
 * Middleware Autentikasi:
 * 1. Memverifikasi validitas & masa kedaluwarsa JWT token.
 * 2. Menegakkan Single Active Session & Timeout (Idle & Absolut):
 *    - Memeriksa apakah sessionId pada token cocok dengan activeSessionId di database.
 *    - Memastikan sesi belum dicabut atau kedaluwarsa.
 * 3. Membaca data role terkini langsung dari database untuk mencegah manipulasi peran di sisi klien.
 * 4. Keamanan Query Token: Token via URL query string hanya diizinkan untuk endpoint unduhan/preview berkas
 *    (seperti /uploads dan /api/reports/excel|pdf). Endpoint API reguler wajib menggunakan Authorization Header.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = (authHeader && authHeader.split(' ')[1]) || null;

  // Izinkan req.query.token hanya untuk endpoint file / preview / download report
  if (!token && req.query && req.query.token) {
    const isFileOrReport = req.baseUrl === '/uploads' ||
      (req.path && (req.path.includes('/reports/excel') || req.path.includes('/reports/pdf') || req.path.includes('/uploads/'))) ||
      (req.originalUrl && (req.originalUrl.includes('/reports/excel') || req.originalUrl.includes('/reports/pdf') || req.originalUrl.includes('/uploads/')));

    if (isFileOrReport) {
      token = req.query.token;
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak: Token tidak ditemukan' });
  }

  let jwtSecret;
  try {
    jwtSecret = TokenManager.getJwtSecret();
  } catch (secErr) {
    console.error('JWT Secret configuration error:', secErr.message);
    return res.status(500).json({ error: 'Terjadi kesalahan konfigurasi keamanan server' });
  }

  jwt.verify(token, jwtSecret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({
        error: 'Akses ditolak: Token tidak valid atau kadaluarsa',
        isTokenExpired: err.name === 'TokenExpiredError'
      });
    }

    try {
      // Validasi sesi aktif terhadap database
      const validation = await validateSession(decoded.id, decoded.sessionId, prisma);
      if (!validation.valid) {
        return res.status(401).json({
          error: validation.message || 'Sesi Anda telah berakhir atau akun sedang aktif di perangkat lain. Silakan login kembali.',
          isSessionExpired: true,
          sessionTerminated: true,
          reason: validation.reason
        });
      }

      const freshUser = validation.user || {};

      // Pasang user terverifikasi dengan role resmi dari database (atau decoded payload di testing)
      req.user = {
        id: freshUser.id || decoded.id,
        username: freshUser.username || decoded.username,
        role: freshUser.role || decoded.role,
        name: freshUser.name || decoded.name,
        jabatan: freshUser.jabatan || decoded.jabatan,
        sessionId: decoded.sessionId || freshUser.activeSessionId
      };

      next();
    } catch (dbErr) {
      console.error('Session validation error in authMiddleware:', dbErr.message);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat memverifikasi sesi' });
    }
  });
};

/**
 * Role-Based Access Control (RBAC):
 * - SUPER_ADMIN mewarisi seluruh kewenangan operasional ADMIN biasa.
 * - Endpoint khusus SUPER_ADMIN (misal Kelola Admin, Audit Log, Revoke Sesi)
 *   DITOLAK secara ketat untuk ADMIN biasa (HTTP 403 Forbidden).
 */
const authorizeRole = (...allowedRoles) => {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Akses ditolak: Autentikasi diperlukan' });
    }

    const userRole = req.user.role;

    // Jika endpoint secara spesifik HANYA mengizinkan SUPER_ADMIN
    if (roles.includes('SUPER_ADMIN') && !roles.includes('ADMIN')) {
      if (userRole === 'SUPER_ADMIN') {
        return next();
      }
      return res.status(403).json({
        error: `Akses ditolak: Operasi ini memerlukan hak akses SUPER_ADMIN`
      });
    }

    // Untuk endpoint yang mengizinkan ADMIN (SUPER_ADMIN otomatis mewarisi)
    if (userRole === 'SUPER_ADMIN' || roles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      error: `Akses ditolak: Peran '${userRole}' tidak diizinkan mengakses resource ini`
    });
  };
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    authorizeRole('ADMIN', 'SUPER_ADMIN')(req, res, next);
  });
};

module.exports = {
  authMiddleware,
  authenticateToken: authMiddleware,
  authorizeRole,
  adminMiddleware
};