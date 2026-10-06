require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const promClient = require('prom-client');
const fs = require('fs');
const path = require('path');

// Core Singletons & Configurations
const prisma = require('./src/config/prisma');
const logger = require('./src/config/logger');
const { authenticateToken, authorizeRole } = require('./src/middleware/auth');
const errorHandler = require('./src/middleware/errorHandler');

// Startup Environment Validation (A2)
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  logger.error(`FATAL: Variabel lingkungan penting tidak ditemukan: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Pastikan direktori asset statis ada
const uploadsDir = path.join(__dirname, 'uploads');
const barcodesDir = path.join(__dirname, 'barcodes');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(barcodesDir)) fs.mkdirSync(barcodesDir, { recursive: true });

const app = express();

// Security Headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// A6: Konfigurasi CORS dengan Whitelist
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3000', 'http://127.0.0.1:8081'];

app.use(cors({
  origin: (origin, callback) => {
    // Izinkan permintaan dari aplikasi mobile native (origin null/undefined) atau yang tercantum di whitelist
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Akses diblokir oleh kebijakan CORS untuk origin: ${origin}`));
    }
  },
  credentials: true
}));

// Logging & Monitoring (Prometheus Metrics)
app.use(morgan('combined', { stream: logger.stream }));
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ register: promClient.register });

app.get('/metrics', authenticateToken, authorizeRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  res.setHeader('Content-Type', promClient.register.contentType);
  res.send(await promClient.register.metrics());
});

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', message: 'Service is healthy' });
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    res.status(503).json({ status: 'DOWN', message: 'Database connection failed' });
  }
});

// Global Rate Limiter untuk proteksi API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan ke server, silakan coba lagi beberapa saat lagi.' }
});
app.use('/api', apiLimiter);

// Body Parsing & Static Assets
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', authenticateToken, express.static(uploadsDir));
app.use('/barcodes', express.static(barcodesDir));

// Route Controllers untuk Laporan & Analitik
const { exportExcel, exportPdf } = require('./src/controllers/reportController');
const { getAnalytics } = require('./src/controllers/analyticsController');

app.get('/api/reports/excel', authenticateToken, authorizeRole('ADMIN', 'SUPER_ADMIN'), exportExcel);
app.get('/api/reports/pdf', authenticateToken, authorizeRole('ADMIN', 'SUPER_ADMIN'), exportPdf);
app.get('/api/dashboard/analytics', authenticateToken, getAnalytics);

// Import Modular Routes (C1)
const authRoutes = require('./src/routes/auth');
const vehicleRoutes = require('./src/routes/vehicles');
const handoverRoutes = require('./src/routes/handovers');
const workerRoutes = require('./src/routes/workers');
const pengawasRoutes = require('./src/routes/pengawas');
const adminRoutes = require('./src/routes/admins');
const checklistRoutes = require('./src/routes/checklists');
const issueRoutes = require('./src/routes/issues');
const notificationRoutes = require('./src/routes/notifications');
const passwordResetRoutes = require('./src/routes/passwordReset');

// Mount Modular Routes
app.use('/api/auth', authRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/handovers', handoverRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/pengawas', pengawasRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/notifications', notificationRoutes);

// Global Error Handler Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Backend server running on port ${PORT} (0.0.0.0)`);
  console.log(`Backend server running on port ${PORT} (0.0.0.0)`);
});

module.exports = app;
