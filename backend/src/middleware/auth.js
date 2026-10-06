const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not defined in environment variables!');
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak: Token tidak ditemukan' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({
        error: 'Akses ditolak: Token tidak valid atau kadaluarsa',
        isTokenExpired: err.name === 'TokenExpiredError'
      });
    }
    req.user = user;
    next();
  });
};

const authorizeRole = (...allowedRoles) => {
  // Support both authorizeRole(['ADMIN', 'PENGAWAS']) and authorizeRole('ADMIN', 'PENGAWAS')
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Akses ditolak: Autentikasi diperlukan' });
    }

    // SUPER_ADMIN has full permissions for any ADMIN endpoint
    const userRole = req.user.role;
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
