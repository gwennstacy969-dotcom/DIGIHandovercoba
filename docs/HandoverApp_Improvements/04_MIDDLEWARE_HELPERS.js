/**
 * MIDDLEWARE & HELPER FUNCTIONS
 * Untuk authentication, validation, dan error handling
 */

// ============================================
// 1. AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * File: middleware/auth.js
 */
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user data
    const user = await db.query(
      'SELECT id, email, name, role FROM users WHERE id = ? AND status = "ACTIVE"',
      [decoded.userId]
    );

    if (!user.length) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    req.user = user[0];
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

const adminMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get admin data
    const admin = await db.query(
      'SELECT id, email, name, role FROM admins WHERE id = ? AND status = "ACTIVE"',
      [decoded.adminId]
    );

    if (!admin.length) {
      return res.status(401).json({
        success: false,
        message: 'Admin not found or inactive'
      });
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(admin[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    req.admin = admin[0];
    next();

  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token or insufficient permissions'
    });
  }
};

// ============================================
// 2. ERROR HANDLING MIDDLEWARE
// ============================================

/**
 * File: middleware/errorHandler.js
 */
const errorHandler = (err, req, res, next) => {
  const logger = require('../config/logger');
  
  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.path,
    method: req.method
  });

  // Default error
  let statusCode = 500;
  let message = 'Internal server error';
  let details = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    details = err.details;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
};

// ============================================
// 3. VALIDATION HELPER
// ============================================

/**
 * File: helpers/validator.js
 */
const { body, validationResult } = require('express-validator');

const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const validatePhoneNumber = (phone) => {
  const regex = /^[\d\s\-\+\(\)]+$/;
  return regex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

const validatePassword = (password) => {
  // Min 8 chars, 1 uppercase, 1 number
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  
  next();
};

const passwordResetValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email tidak valid'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Alasan terlalu panjang (max 500 karakter)'),
  handleValidationErrors
];

const verifyPasswordResetValidation = [
  body('requestId')
    .isInt()
    .withMessage('Request ID harus berupa angka'),
  body('isApproved')
    .isBoolean()
    .withMessage('isApproved harus berupa boolean'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Catatan terlalu panjang'),
  handleValidationErrors
];

// ============================================
// 4. PASSWORD HELPER
// ============================================

/**
 * File: helpers/passwordHelper.js
 */
const bcrypt = require('bcrypt');

const generateSecurePassword = (length = 12) => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%&*';
  
  const all = uppercase + lowercase + numbers + special;
  let password = '';
  
  // Ensure at least 1 of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// ============================================
// 5. EMAIL HELPER
// ============================================

/**
 * File: helpers/emailHelper.js
 */
const db = require('../config/database');

const getAdminEmails = async (excludeAdminId = null) => {
  try {
    let query = `
      SELECT DISTINCT a.email
      FROM admins a
      WHERE a.status = 'ACTIVE'
    `;
    
    const params = [];
    
    if (excludeAdminId) {
      query += ' AND a.id != ?';
      params.push(excludeAdminId);
    }
    
    const admins = await db.query(query, params);
    return admins.map(admin => admin.email);
  } catch (error) {
    console.error('Error getting admin emails:', error);
    return [];
  }
};

const getAdminPersonalEmails = async () => {
  try {
    const result = await db.query(`
      SELECT a.id, COALESCE(aep.personal_email, a.email) as email
      FROM admins a
      LEFT JOIN admin_email_preferences aep ON a.id = aep.admin_id
      WHERE a.status = 'ACTIVE' AND aep.receive_finding_emails = true
    `);
    
    return result.map(row => row.email);
  } catch (error) {
    console.error('Error getting admin personal emails:', error);
    return [];
  }
};

const logEmailSent = async (adminId, findingId, email, subject, status = 'SENT') => {
  try {
    await db.query(
      `INSERT INTO email_notification_logs 
       (admin_id, finding_id, email_address, subject, email_status, sent_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [adminId, findingId, email, subject, status]
    );
  } catch (error) {
    console.error('Error logging email:', error);
  }
};

const logEmailFailed = async (adminId, findingId, email, error) => {
  try {
    await db.query(
      `INSERT INTO email_notification_logs 
       (admin_id, finding_id, email_address, email_status, error_message)
       VALUES (?, ?, ?, 'FAILED', ?)`,
      [adminId, findingId, email, error.message]
    );
  } catch (err) {
    console.error('Error logging failed email:', err);
  }
};

// ============================================
// 6. RESPONSE HELPER
// ============================================

/**
 * File: helpers/responseHelper.js
 */
const sendSuccess = (res, statusCode, message, data = null) => {
  res.status(statusCode).json({
    success: true,
    message,
    ...(data && { data })
  });
};

const sendError = (res, statusCode, message, details = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details })
  });
};

// ============================================
// 7. PAGINATION HELPER
// ============================================

/**
 * File: helpers/paginationHelper.js
 */
const getPaginationParams = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 10);
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

const formatPaginatedResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

// ============================================
// 8. DATE HELPER
// ============================================

/**
 * File: helpers/dateHelper.js
 */
const formatDate = (date, format = 'id-ID') => {
  return new Date(date).toLocaleDateString(format, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatDateTime = (date, format = 'id-ID') => {
  return new Date(date).toLocaleString(format, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' tahun lalu';
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' bulan lalu';
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' hari lalu';
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' jam lalu';
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' menit lalu';
  
  return 'Baru saja';
};

// ============================================
// 9. FILE UPLOAD HELPER
// ============================================

/**
 * File: helpers/fileHelper.js
 */
const path = require('path');
const fs = require('fs').promises;

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const validateFile = (file) => {
  if (!file) {
    return { valid: false, error: 'File tidak ditemukan' };
  }
  
  const ext = path.extname(file.originalname).slice(1).toLowerCase();
  
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { 
      valid: false, 
      error: `Format file tidak diizinkan. Format yang diizinkan: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Ukuran file terlalu besar. Maksimal: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }
  
  return { valid: true };
};

const generateFileName = (originalName) => {
  const timestamp = Date.now();
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  return `${name}_${timestamp}${ext}`;
};

const ensureUploadDir = async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directory:', error);
  }
};

// ============================================
// 10. NOTIFICATION HELPER
// ============================================

/**
 * File: helpers/notificationHelper.js
 */
const createNotification = async (adminId, type, title, message, data = {}) => {
  try {
    const result = await db.query(
      `INSERT INTO notifications (admin_id, type, title, message, data, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [adminId, type, title, message, JSON.stringify(data)]
    );
    
    return {
      success: true,
      notificationId: result.insertId
    };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
};

const createBulkNotifications = async (adminIds, type, title, message, data = {}) => {
  try {
    const promises = adminIds.map(adminId =>
      createNotification(adminId, type, title, message, data)
    );
    
    await Promise.all(promises);
    return { success: true };
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Middleware
  authMiddleware,
  adminMiddleware,
  errorHandler,
  
  // Validators
  validateEmail,
  validatePhoneNumber,
  validatePassword,
  passwordResetValidation,
  verifyPasswordResetValidation,
  
  // Password helpers
  generateSecurePassword,
  hashPassword,
  comparePassword,
  
  // Email helpers
  getAdminEmails,
  getAdminPersonalEmails,
  logEmailSent,
  logEmailFailed,
  
  // Response helpers
  sendSuccess,
  sendError,
  
  // Pagination
  getPaginationParams,
  formatPaginatedResponse,
  
  // Date helpers
  formatDate,
  formatDateTime,
  getTimeAgo,
  
  // File helpers
  validateFile,
  generateFileName,
  ensureUploadDir,
  
  // Notification helpers
  createNotification,
  createBulkNotifications
};
