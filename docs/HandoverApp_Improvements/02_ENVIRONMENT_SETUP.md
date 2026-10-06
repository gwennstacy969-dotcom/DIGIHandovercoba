# ⚙️ ENVIRONMENT SETUP & KONFIGURASI

## 🔧 File `.env` Configuration

Buat file `.env` di root project Anda dengan konfigurasi berikut:

```bash
# ============================================
# DATABASE CONFIGURATION
# ============================================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=handover_app
DB_PORT=3306

# ============================================
# EMAIL CONFIGURATION (Gmail)
# ============================================
EMAIL_SERVICE=gmail
EMAIL_USER=admin@yourcompany.com
EMAIL_PASSWORD=your_app_specific_password
EMAIL_FROM_NAME="HandoverApp Admin"

# Jika pakai Outlook:
# EMAIL_SERVICE=outlook
# EMAIL_USER=admin@company.com
# EMAIL_PASSWORD=your_outlook_password

# Jika pakai SMTP Custom:
# EMAIL_SERVICE=custom
# EMAIL_HOST=smtp.company.com
# EMAIL_PORT=587
# EMAIL_SECURE=true
# EMAIL_USER=admin@company.com
# EMAIL_PASSWORD=your_password

# ============================================
# APPLICATION CONFIGURATION
# ============================================
NODE_ENV=production
PORT=3000
API_URL=http://localhost:3000

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Admin Dashboard URL
ADMIN_DASHBOARD_URL=http://localhost:3000/admin

# ============================================
# JWT & SECURITY
# ============================================
JWT_SECRET=your_very_secure_jwt_secret_key_min_32_chars
JWT_EXPIRE=7d
REFRESH_TOKEN_SECRET=your_refresh_token_secret

# ============================================
# FILE UPLOAD
# ============================================
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880  # 5MB in bytes
ALLOWED_EXTENSIONS=jpg,jpeg,png,pdf

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# ============================================
# NOTIFICATION SETTINGS
# ============================================
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_PUSH_NOTIFICATIONS=true
NOTIFICATION_RETRY_ATTEMPTS=3
NOTIFICATION_RETRY_DELAY=5000  # 5 seconds
```

---

## 📦 NPM Packages yang Dibutuhkan

Jalankan perintah ini untuk install packages:

```bash
npm install express
npm install mysql2
npm install dotenv
npm install nodemailer
npm install bcrypt
npm install jsonwebtoken
npm install multer
npm install cors
npm install helmet
npm install express-validator
npm install winston  # untuk logging
npm install schedule  # untuk scheduled tasks
```

Atau copy-paste ke `package.json` dan run `npm install`:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.4.0",
    "dotenv": "^16.3.1",
    "nodemailer": "^6.9.4",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.1",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-validator": "^7.0.0",
    "winston": "^3.10.0",
    "schedule": "^0.6.0",
    "axios": "^1.5.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

---

## 🗄️ Database Migration

Jalankan perintah SQL berikut untuk membuat tables:

### 1. Password Reset Table

```sql
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  reason TEXT,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') DEFAULT 'PENDING',
  admin_notes VARCHAR(500),
  reset_by_admin_id INT,
  new_password_hash VARCHAR(255),
  reset_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reset_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_reset_by (reset_by_admin_id)
);
```

### 2. Email Notification Logs Table

```sql
CREATE TABLE IF NOT EXISTS email_notification_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT,
  finding_id INT,
  email_address VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  email_type ENUM('PASSWORD_RESET', 'FINDING_REPORT', 'SYSTEM') DEFAULT 'SYSTEM',
  email_status ENUM('SENT', 'FAILED', 'PENDING') DEFAULT 'PENDING',
  error_message TEXT,
  retry_count INT DEFAULT 0,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE SET NULL,
  INDEX idx_status (email_status),
  INDEX idx_admin_id (admin_id),
  INDEX idx_sent_at (sent_at),
  INDEX idx_created_at (created_at),
  INDEX idx_type (email_type)
);
```

### 3. Admin Email Preferences Table (Optional)

```sql
CREATE TABLE IF NOT EXISTS admin_email_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL UNIQUE,
  personal_email VARCHAR(255) NOT NULL,
  receive_password_reset_emails BOOLEAN DEFAULT true,
  receive_finding_emails BOOLEAN DEFAULT true,
  receive_digest_email BOOLEAN DEFAULT true,
  digest_frequency ENUM('DAILY', 'WEEKLY', 'MONTHLY') DEFAULT 'DAILY',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  INDEX idx_admin_id (admin_id)
);
```

### 4. Jalankan Migrations

```bash
# Jika Anda sudah connect ke database:
mysql -u root -p < database_migrations.sql

# Atau jalankan dari aplikasi menggunakan script initialization
node scripts/initialize-db.js
```

---

## 📧 Setup Email dengan Gmail

Jika menggunakan Gmail, ikuti langkah berikut:

### 1. Enable 2-Factor Authentication
- Buka https://myaccount.google.com/security
- Aktifkan 2-Factor Authentication

### 2. Generate App-Specific Password
- Buka https://myaccount.google.com/apppasswords
- Pilih "Mail" dan "Windows/Mac/Linux"
- Google akan generate password khusus untuk aplikasi

### 3. Gunakan di `.env`
```bash
EMAIL_SERVICE=gmail
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-generated-password  # Bukan password Gmail biasa!
```

---

## 📧 Setup Email dengan Outlook

Jika menggunakan Outlook/Office 365:

```bash
EMAIL_SERVICE=outlook
EMAIL_USER=admin@company.com
EMAIL_PASSWORD=your_outlook_password
```

---

## 📧 Setup Email dengan SMTP Custom (Hosting Email)

Jika menggunakan hosting email provider (Cpanel, Plesk, dll):

```bash
EMAIL_SERVICE=custom
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=admin@yourdomain.com
EMAIL_PASSWORD=your_email_password
```

---

## 🧪 Test Email Configuration

Jalankan script berikut untuk test apakah email configuration sudah benar:

**File: `scripts/test-email.js`**

```javascript
const nodemailer = require('nodemailer');
require('dotenv').config();

const testEmail = async () => {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    console.log('🔄 Testing email connection...');
    
    // Test connection
    await transporter.verify();
    console.log('✅ Email configuration verified!');

    // Send test email
    const result = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // kirim ke diri sendiri
      subject: '✅ Test Email - HandoverApp',
      html: `
        <h2>Test Email Configuration</h2>
        <p>Email configuration Anda sudah berhasil dikonfigurasi!</p>
        <p>Waktu: ${new Date().toLocaleString('id-ID')}</p>
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
    
  } catch (error) {
    console.error('❌ Email configuration error:');
    console.error(error.message);
    process.exit(1);
  }
};

testEmail();
```

Jalankan dengan:
```bash
node scripts/test-email.js
```

---

## 📁 Folder Structure

Buat struktur folder berikut di project Anda:

```
handover-app/
├── config/
│   ├── database.js
│   └── email.js
├── controllers/
│   ├── passwordResetController.js
│   ├── findingController.js
│   └── notificationController.js
├── services/
│   ├── emailService.js
│   ├── emailTemplates.js
│   └── notificationService.js
├── routes/
│   ├── passwordReset.js
│   ├── findings.js
│   └── notifications.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
├── models/
│   ├── User.js
│   ├── PasswordResetRequest.js
│   └── Finding.js
├── uploads/
│   ├── photos/
│   └── documents/
├── logs/
│   └── app.log
├── scripts/
│   ├── test-email.js
│   ├── initialize-db.js
│   └── seed-data.js
├── .env (jangan push ke git!)
├── .gitignore
├── server.js
├── package.json
└── README.md
```

---

## 🚀 Startup Script

**File: `server.js`**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./config/logger');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Logger middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/password-reset', require('./routes/passwordReset'));
app.use('/api/findings', require('./routes/findings'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  db.end(() => {
    logger.info('Database connection closed');
    process.exit(0);
  });
});
```

---

## 🧪 Testing dengan Postman

### 1. Password Reset - User Submit

```
POST /api/password-reset/submit
Content-Type: application/json

{
  "email": "user@example.com",
  "reason": "Saya lupa password saya"
}
```

### 2. Password Reset - Admin Get Pending

```
GET /api/password-reset/pending
Authorization: Bearer admin_token
```

### 3. Password Reset - Admin Verify & Reset

```
POST /api/password-reset/verify
Content-Type: application/json
Authorization: Bearer admin_token

{
  "requestId": 1,
  "isApproved": true,
  "notes": "Identitas sudah diverifikasi di kantor"
}
```

### 4. Password Reset - Get History

```
GET /api/password-reset/history?userId=1
Authorization: Bearer user_token
```

---

## 📊 Monitoring & Logging

### Winston Logger Setup

**File: `config/logger.js`**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'handover-app' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

module.exports = logger;
```

### View Email Logs

Query untuk melihat email notification logs:

```sql
-- Lihat semua email yang terkirim dalam 24 jam terakhir
SELECT 
  id,
  admin_id,
  email_address,
  email_type,
  email_status,
  sent_at,
  created_at
FROM email_notification_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY created_at DESC;

-- Lihat email yang gagal
SELECT 
  id,
  admin_id,
  email_address,
  email_type,
  error_message,
  retry_count,
  created_at
FROM email_notification_logs
WHERE email_status = 'FAILED'
ORDER BY created_at DESC;

-- Statistik email per admin
SELECT 
  admin_id,
  email_type,
  email_status,
  COUNT(*) as total
FROM email_notification_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY admin_id, email_type, email_status
ORDER BY admin_id, email_type;
```

---

## ✅ Pre-Launch Checklist

Sebelum go live, pastikan:

- [ ] `.env` file sudah dikonfigurasi dengan benar
- [ ] Database sudah dimigrasi
- [ ] Email configuration sudah tested dengan `test-email.js`
- [ ] Folder `uploads/` dan `logs/` sudah di-create
- [ ] All dependencies sudah di-install
- [ ] Server bisa start tanpa error
- [ ] API health check respond dengan OK
- [ ] Frontend bisa connect ke backend
- [ ] Email notifications bisa dikirim
- [ ] Admin bisa akses dashboard
- [ ] User bisa submit password reset request
- [ ] Admin bisa verify dan reset password
- [ ] Email diterima di inbox admin

---

Sekarang mari saya buat file konfigurasi database dan email templates...
