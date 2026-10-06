# 🚀 PANDUAN IMPLEMENTASI STEP-BY-STEP

## 📋 Daftar Isi
1. [Fase 1: Preparation](#fase-1-preparation)
2. [Fase 2: Backend Setup](#fase-2-backend-setup)
3. [Fase 3: Frontend Setup](#fase-3-frontend-setup)
4. [Fase 4: Testing](#fase-4-testing)
5. [Fase 5: Deployment](#fase-5-deployment)

---

## FASE 1: PREPARATION
**Estimasi: 30 menit**

### Step 1.1: Clone & Setup Repository

```bash
# 1. Clone repository (jika belum)
git clone https://github.com/kangharfebrin-dot/HandoverApp.git
cd HandoverApp

# 2. Create branch untuk feature baru
git checkout -b feature/password-reset-and-email-notifications

# 3. Install dependencies
npm install
```

### Step 1.2: Setup Environment Variables

```bash
# 1. Copy file .env.example ke .env
cp .env.example .env

# 2. Edit .env dengan konfigurasi Anda
# Tambahkan konfigurasi email:

EMAIL_SERVICE=gmail
EMAIL_USER=your-admin-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# atau jika menggunakan SMTP custom
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_USER=admin@yourdomain.com
EMAIL_PASSWORD=your_password

JWT_SECRET=your_very_secure_secret_min_32_chars_abcdefghijklmnop1234
```

### Step 1.3: Create Folder Structure

```bash
# Create folder struktur jika belum ada
mkdir -p src/controllers
mkdir -p src/services
mkdir -p src/middleware
mkdir -p src/helpers
mkdir -p src/models
mkdir -p src/routes
mkdir -p uploads/photos
mkdir -p uploads/documents
mkdir -p logs
mkdir -p scripts
```

### Step 1.4: Verify Dependencies

```bash
# Install additional packages yang diperlukan
npm install nodemailer
npm install express-validator
npm install winston
npm install bcrypt
npm install jsonwebtoken

# Verify installation
npm list nodemailer bcrypt jsonwebtoken
```

**✅ Checklist Fase 1:**
- [ ] Repository di-clone/sudah ada
- [ ] Branch baru dibuat
- [ ] .env file dikonfigurasi
- [ ] Folder structure sudah ada
- [ ] Dependencies terinstall

---

## FASE 2: BACKEND SETUP
**Estimasi: 2-3 jam**

### Step 2.1: Database Migration

```bash
# 1. Lihat file database_migration.sql
# 2. Jalankan migration ke database Anda

# Jika menggunakan MySQL CLI:
mysql -u root -p handover_app < database_migration.sql

# Atau jika ingin menjalankan per query, buka MySQL editor dan copy-paste
```

**Verify Database:**
```sql
-- Check if tables were created
SHOW TABLES LIKE '%password%';
SHOW TABLES LIKE '%email%';

-- Check table structure
DESC password_reset_requests;
DESC email_notification_logs;
```

### Step 2.2: Setup Email Configuration & Testing

```bash
# 1. Buat file test untuk email configuration
cat > scripts/test-email.js << 'EOF'
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
    await transporter.verify();
    console.log('✅ Email configuration verified!');

    const result = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: '✅ Test Email - HandoverApp',
      html: '<h2>Test Email</h2><p>Configuration berhasil!</p>'
    });

    console.log('✅ Test email sent:', result.messageId);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

testEmail();
EOF

# 2. Test email
node scripts/test-email.js
```

**Expected Output:**
```
🔄 Testing email connection...
✅ Email configuration verified!
✅ Test email sent: <message-id>
```

### Step 2.3: Create Email Service

**File: `src/services/emailService.js`**

Copy kode dari file `03_EMAIL_TEMPLATES.js` ke dalam project Anda:

```bash
# 1. Copy email templates
cp 03_EMAIL_TEMPLATES.js src/services/emailTemplates.js

# 2. Buat email service file
cat > src/services/emailService.js << 'EOF'
const nodemailer = require('nodemailer');
const { emailTemplates } = require('./emailTemplates');
const db = require('../config/database');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendPasswordResetNotification = async (adminEmail, user, reason, requestId) => {
  try {
    const html = emailTemplates.passwordResetNotification({
      adminName: 'Admin',
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      userRole: user.role,
      reason: reason,
      requestId: requestId
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: adminEmail,
      subject: `🔔 Notifikasi: User ${user.name} Lupa Password`,
      html: html
    });
    
    console.log(`✅ Password reset notification sent to ${adminEmail}`);
  } catch (error) {
    console.error('❌ Send notification error:', error);
  }
};

exports.sendPasswordResetCompletedEmail = async (userEmail, userName, newPassword) => {
  try {
    const html = emailTemplates.passwordResetCompleted({
      userName: userName,
      newPassword: newPassword
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: '✅ Password Anda Telah Direset',
      html: html
    });
    
    console.log(`✅ Password reset email sent to ${userEmail}`);
  } catch (error) {
    console.error('❌ Send email error:', error);
  }
};

exports.sendFindingReportEmail = async (adminEmail, finding, photoUrl) => {
  try {
    const html = emailTemplates.findingReportEmail({
      adminName: 'Admin',
      reporterName: finding.reporter_name,
      reporterEmail: finding.reporter_email,
      reporterPhone: finding.reporter_phone,
      location: finding.location,
      category: finding.category,
      description: finding.description,
      photoUrl: photoUrl,
      severity: finding.severity || 'MEDIUM',
      reportDate: finding.created_at
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: adminEmail,
      subject: `🚨 Laporan Baru: ${finding.category}`,
      html: html
    });
    
    console.log(`✅ Finding report email sent to ${adminEmail}`);
  } catch (error) {
    console.error('❌ Send finding email error:', error);
  }
};

module.exports = exports;
EOF
```

### Step 2.4: Create Password Reset Controller

**File: `src/controllers/passwordResetController.js`**

Copy dari dokumentasi lengkap (file `01_SOLUSI_LENGKAP.md`):

```bash
cat > src/controllers/passwordResetController.js << 'EOF'
const db = require('../config/database');
const bcrypt = require('bcrypt');
const { sendPasswordResetNotification, sendPasswordResetCompletedEmail } = require('../services/emailService');

// 1. User submit forgot password request
exports.submitPasswordResetRequest = async (req, res) => {
  try {
    const { email, reason } = req.body;
    
    // Validate email exists
    const user = await db.query(
      'SELECT id, name, email, phone, role FROM users WHERE email = ? AND status = "ACTIVE"',
      [email]
    );
    
    if (!user.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email tidak terdaftar' 
      });
    }
    
    const userId = user[0].id;
    
    // Check if already have pending request
    const existingRequest = await db.query(
      'SELECT id FROM password_reset_requests WHERE user_id = ? AND status = "PENDING"',
      [userId]
    );
    
    if (existingRequest.length) {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah memiliki permintaan reset yang pending'
      });
    }
    
    // Create password reset request
    const result = await db.query(
      `INSERT INTO password_reset_requests (user_id, email, reason, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [userId, email, reason || null]
    );
    
    // Send notification to admins
    const admins = await db.query('SELECT id, email FROM admins WHERE status = "ACTIVE"');
    
    for (const admin of admins) {
      await sendPasswordResetNotification(
        admin.email,
        user[0],
        reason,
        result.insertId
      );
    }
    
    return res.status(200).json({
      success: true,
      message: 'Permintaan reset password telah dikirim ke admin',
      requestId: result.insertId
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan'
    });
  }
};

// 2. Admin get pending requests
exports.getPendingRequests = async (req, res) => {
  try {
    const requests = await db.query(`
      SELECT 
        prr.id,
        prr.user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.phone,
        u.role,
        prr.reason,
        prr.status,
        prr.created_at
      FROM password_reset_requests prr
      JOIN users u ON prr.user_id = u.id
      WHERE prr.status = 'PENDING'
      ORDER BY prr.created_at DESC
    `);
    
    res.status(200).json({
      success: true,
      data: requests,
      count: requests.length
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan'
    });
  }
};

// 3. Admin verify & reset password
exports.verifyAndResetPassword = async (req, res) => {
  try {
    const { requestId, isApproved, notes } = req.body;
    const adminId = req.admin.id;
    
    // Get request
    const request = await db.query(
      'SELECT * FROM password_reset_requests WHERE id = ?',
      [requestId]
    );
    
    if (!request.length) {
      return res.status(404).json({
        success: false,
        message: 'Request tidak ditemukan'
      });
    }
    
    if (isApproved) {
      // Generate password
      const tempPassword = generateSecurePassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // Update user password
      await db.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, request[0].user_id]
      );
      
      // Update request status
      await db.query(
        `UPDATE password_reset_requests 
         SET status = 'COMPLETED', reset_by_admin_id = ?, admin_notes = ?, reset_at = NOW()
         WHERE id = ?`,
        [adminId, notes, requestId]
      );
      
      // Get user for notification
      const user = await db.query(
        'SELECT email, name FROM users WHERE id = ?',
        [request[0].user_id]
      );
      
      // Send email to user
      await sendPasswordResetCompletedEmail(
        user[0].email,
        user[0].name,
        tempPassword
      );
      
      return res.status(200).json({
        success: true,
        message: 'Password berhasil direset',
        data: {
          userId: request[0].user_id,
          userEmail: user[0].email,
          userName: user[0].name,
          newPassword: tempPassword
        }
      });
      
    } else {
      // Reject
      await db.query(
        'UPDATE password_reset_requests SET status = "REJECTED", admin_notes = ? WHERE id = ?',
        [notes, requestId]
      );
      
      return res.status(200).json({
        success: true,
        message: 'Permintaan ditolak'
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan'
    });
  }
};

// Helper
function generateSecurePassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

module.exports = exports;
EOF
```

### Step 2.5: Create Routes

**File: `src/routes/passwordReset.js`**

```bash
cat > src/routes/passwordReset.js << 'EOF'
const express = require('express');
const router = express.Router();
const { 
  submitPasswordResetRequest,
  getPendingRequests,
  verifyAndResetPassword
} = require('../controllers/passwordResetController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// User endpoints
router.post('/submit', submitPasswordResetRequest);

// Admin endpoints
router.get('/pending', adminMiddleware, getPendingRequests);
router.post('/verify', adminMiddleware, verifyAndResetPassword);

module.exports = router;
EOF
```

### Step 2.6: Update Main Server File

**File: `src/server.js` atau `app.js`** (Add to existing routes)

```javascript
// Add this to your main app file
const passwordResetRoutes = require('./routes/passwordReset');

// Add route
app.use('/api/password-reset', passwordResetRoutes);
```

**✅ Checklist Fase 2:**
- [ ] Database migration selesai
- [ ] Email configuration tested
- [ ] Email service dibuat
- [ ] Password reset controller dibuat
- [ ] Routes dibuat
- [ ] Server dapat start tanpa error

---

## FASE 3: FRONTEND SETUP
**Estimasi: 2-3 jam**

### Step 3.1: Create Forgot Password Component

**File: `src/components/ForgotPasswordModal.jsx`**

Copy dari file `01_SOLUSI_LENGKAP.md` dan sesuaikan dengan project Anda.

### Step 3.2: Integrate Forgot Password ke Login Page

```jsx
// Di login page, tambahkan:
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export default function LoginPage() {
  const [showForgotModal, setShowForgotModal] = useState(false);

  return (
    <div className="login-container">
      {/* Existing login form */}
      <form>
        <input type="email" placeholder="Email" />
        <input type="password" placeholder="Password" />
        <button type="submit">Login</button>
      </form>

      {/* Add forgot password link */}
      <p>
        <button
          type="button"
          onClick={() => setShowForgotModal(true)}
          style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer' }}
        >
          Lupa Password?
        </button>
      </p>

      {/* Add modal */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onSubmit={() => setShowForgotModal(false)}
      />
    </div>
  );
}
```

### Step 3.3: Create Admin Dashboard Component

**File: `src/components/AdminPasswordResetDashboard.jsx`**

Copy dari file `01_SOLUSI_LENGKAP.md`

### Step 3.4: Create Finding Report Email Service Hook

**File: `src/hooks/useFindingReportEmail.js`**

Copy dari file `01_SOLUSI_LENGKAP.md`

### Step 3.5: Integrate Email Notification ke Finding Report

Di component yang handle laporan temuan, tambahkan:

```jsx
import { useFindingReportEmail } from '../hooks/useFindingReportEmail';

export default function FindingReportForm() {
  const { sendFindingReportWithEmail } = useFindingReportEmail();

  const handleSubmitReport = async (formData, photoFile) => {
    const result = await sendFindingReportWithEmail(formData, photoFile);
    
    if (result.success) {
      alert('✅ Laporan berhasil dikirim ke admin (App + Email)');
    } else {
      alert('❌ ' + result.message);
    }
  };

  return (
    // Your form JSX
  );
}
```

**✅ Checklist Fase 3:**
- [ ] ForgotPasswordModal component dibuat
- [ ] Integrated ke login page
- [ ] AdminPasswordResetDashboard dibuat
- [ ] Integrated ke admin panel
- [ ] Finding report email hook dibuat
- [ ] Frontend dapat berkomunikasi dengan backend

---

## FASE 4: TESTING
**Estimasi: 2-3 jam**

### Step 4.1: Unit Testing

**File: `src/controllers/__tests__/passwordResetController.test.js`**

```javascript
const request = require('supertest');
const app = require('../../app');
const db = require('../../config/database');

describe('Password Reset Controller', () => {
  
  it('should submit password reset request', async () => {
    const response = await request(app)
      .post('/api/password-reset/submit')
      .send({
        email: 'user@test.com',
        reason: 'Lupa password'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should get pending requests for admin', async () => {
    const token = 'admin_token_here';
    
    const response = await request(app)
      .get('/api/password-reset/pending')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

});
```

Run test:
```bash
npm test
```

### Step 4.2: Manual Testing - Password Reset Flow

#### Test 1: User Submit Request

```bash
curl -X POST http://localhost:3000/api/password-reset/submit \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "reason": "Saya lupa password saya"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Permintaan reset password telah dikirim ke admin",
  "requestId": 1
}
```

#### Test 2: Admin Get Pending Requests

```bash
curl -X GET http://localhost:3000/api/password-reset/pending \
  -H "Authorization: Bearer admin_token"
```

Expected Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_name": "John Doe",
      "user_email": "user@test.com",
      "phone": "081234567890",
      "role": "USER",
      "reason": "Saya lupa password saya",
      "status": "PENDING",
      "created_at": "2024-01-15 10:30:00"
    }
  ],
  "count": 1
}
```

#### Test 3: Admin Verify & Reset Password

```bash
curl -X POST http://localhost:3000/api/password-reset/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin_token" \
  -d '{
    "requestId": 1,
    "isApproved": true,
    "notes": "Identitas sudah diverifikasi di kantor"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Password berhasil direset",
  "data": {
    "userId": 1,
    "userEmail": "user@test.com",
    "userName": "John Doe",
    "newPassword": "aB12!@#$%&*"
  }
}
```

### Step 4.3: Email Testing

#### Check Email Configuration

```bash
node scripts/test-email.js
```

#### Check Email Logs

```sql
SELECT * FROM email_notification_logs 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY created_at DESC
LIMIT 10;
```

### Step 4.4: Frontend Testing

#### Test Forgot Password Modal

1. Buka aplikasi di browser
2. Click "Lupa Password?"
3. Input email yang terdaftar
4. Input alasan (optional)
5. Click "Kirim Permintaan Reset"
6. Verify success message muncul

#### Test Admin Dashboard

1. Login sebagai admin
2. Buka menu "Password Reset"
3. Verify list pending requests muncul
4. Click pada request
5. Review user details
6. Click "Verifikasi & Reset Password"
7. Verify modal closes dan data update

### Step 4.5: End-to-End Testing

#### Complete Password Reset Flow

```
1. User side:
   ✅ Open login page
   ✅ Click "Lupa Password?"
   ✅ Submit email
   ✅ Receive confirmation message

2. Admin side:
   ✅ Receive email notification
   ✅ See notification in app
   ✅ Verify user identity offline
   ✅ Open admin dashboard
   ✅ Reset password
   ✅ Copy new password

3. User side (again):
   ✅ Receive confirmation email
   ✅ Login with new password
   ✅ Success
```

**✅ Checklist Fase 4:**
- [ ] Unit tests pass
- [ ] API endpoints tested dengan curl/Postman
- [ ] Email notifications received
- [ ] Frontend modals work
- [ ] End-to-end flow completed
- [ ] No errors in console/logs

---

## FASE 5: DEPLOYMENT
**Estimasi: 1 jam**

### Step 5.1: Code Review & Cleanup

```bash
# 1. Check for console.log statements
grep -r "console.log" src/ --include="*.js"

# 2. Check for TODO comments
grep -r "TODO\|FIXME\|HACK" src/ --include="*.js"

# 3. Run linter
npm run lint

# 4. Format code
npm run format
```

### Step 5.2: Security Check

- [ ] No credentials in code
- [ ] `.env` file in `.gitignore`
- [ ] SQL injections handled (using parameterized queries)
- [ ] CORS properly configured
- [ ] HTTPS enforced in production
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints

### Step 5.3: Database Backup

```bash
# Backup database sebelum deploy
mysqldump -u root -p handover_app > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 5.4: Deploy to Production

```bash
# 1. Merge branch ke main
git add .
git commit -m "feat: add password reset and email notifications"
git push origin feature/password-reset-and-email-notifications

# 2. Create Pull Request & review
# 3. Merge ke main branch

# 4. Deploy
git checkout main
git pull
npm install --production
npm run build  # if applicable

# 5. Restart server
pm2 restart handover-app
# atau
systemctl restart handover-app
```

### Step 5.5: Post-Deployment Testing

```bash
# 1. Check health endpoint
curl https://api.yourdomain.com/health

# 2. Test password reset flow
# (Repeat manual tests from Phase 4)

# 3. Check logs
tail -f logs/app.log
pm2 logs handover-app

# 4. Monitor errors
# Check error logs in database or logging service
```

### Step 5.6: Monitoring & Maintenance

Buat monitoring untuk:
- [ ] Email delivery status
- [ ] Failed notifications
- [ ] Server errors
- [ ] Performance metrics
- [ ] Database connections

Query untuk monitoring:

```sql
-- Email status summary
SELECT 
  email_type,
  email_status,
  COUNT(*) as total,
  DATE(created_at) as date
FROM email_notification_logs
GROUP BY email_type, email_status, DATE(created_at)
ORDER BY date DESC, email_type;

-- Failed emails yang perlu retry
SELECT * FROM email_notification_logs
WHERE email_status = 'FAILED' AND retry_count < 3
ORDER BY created_at ASC;

-- Password reset statistics
SELECT 
  DATE(created_at) as date,
  status,
  COUNT(*) as total
FROM password_reset_requests
GROUP BY DATE(created_at), status
ORDER BY date DESC;
```

**✅ Checklist Fase 5:**
- [ ] Code reviewed
- [ ] Security checked
- [ ] Database backed up
- [ ] Deployed to production
- [ ] All tests pass in production
- [ ] Monitoring setup
- [ ] Team notified

---

## 📊 FINAL CHECKLIST

### Backend
- [ ] Password reset controller implemented
- [ ] Email service setup & tested
- [ ] Database tables created
- [ ] Routes configured
- [ ] Error handling implemented
- [ ] Logging implemented

### Frontend
- [ ] Forgot password modal created
- [ ] Admin dashboard created
- [ ] Finding email integration done
- [ ] All components styled
- [ ] Mobile responsive

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing complete
- [ ] E2E flow verified
- [ ] Email delivery confirmed

### Deployment
- [ ] Code reviewed
- [ ] Security audit passed
- [ ] Database migration successful
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] Documentation updated

---

## 📞 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Email tidak terkirim | Check `.env` EMAIL_USER & PASSWORD, run test-email.js |
| Request gagal (500) | Check server logs, verify database connection |
| Admin tidak bisa verify | Check admin token in Authorization header |
| Password reset notification tidak diterima | Check spam folder, verify admin email address |
| Frontend tidak connect ke backend | Check CORS settings, verify API URL di frontend |
| Database query error | Check SQL syntax, verify field names |

---

Selesai! Anda sekarang siap untuk mengimplementasikan solusi lengkap. 🎉
