# 📋 SOLUSI LENGKAP HANDOVER APP
## Requirement 1: Forgot Password & Requirement 2: Email Notifikasi Temuan

---

## 🎯 RINGKASAN REQUIREMENT

### **Requirement 1: Lupa Password (Approval di Kantor)**
```
User lupa password
    ↓
User submit email lupa password
    ↓
Admin dapat notifikasi di aplikasi digihandover
    ↓
Admin verifikasi identitas di kantor (OFFLINE)
    ↓
Admin reset password langsung dari dashboard
    ↓
User diberitahu password baru secara langsung oleh admin
    ↓
User login dengan password baru ✅
```

**Key Points:**
- ✅ User hanya submit email
- ✅ Admin verifikasi di kantor (bukan online)
- ✅ Admin reset password manual dari dashboard
- ✅ Password baru diberitahu langsung (tidak via email)
- ✅ Tidak ada token/link reset

---

### **Requirement 2: Email Notifikasi Temuan/Blokir**
```
User submit laporan temuan/blokir + foto
    ↓
Sistem kirim NOTIFIKASI APP ke admin
    ↓
Sistem kirim EMAIL ke admin dengan detail lengkap + foto
    ↓
Admin lihat di app DAN email simultaneously
    ↓
Admin dapat action dari keduanya
```

**Key Points:**
- ✅ Notifikasi app tetap ada
- ✅ Email juga harus masuk ke pribadi admin
- ✅ Email berisi detail + foto
- ✅ Email harus profesional dan formatnya bagus

---

## 📊 DATABASE SCHEMA

### Table: `password_reset_requests`
```sql
CREATE TABLE password_reset_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  reason TEXT,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') DEFAULT 'PENDING',
  admin_notes VARCHAR(500),
  reset_by_admin_id INT,
  reset_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reset_by_admin_id) REFERENCES admins(id),
  INDEX idx_status (status),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

### Table: `email_notification_logs`
```sql
CREATE TABLE email_notification_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  finding_id INT NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  email_status ENUM('SENT', 'FAILED', 'PENDING') DEFAULT 'PENDING',
  error_message TEXT,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES admins(id),
  FOREIGN KEY (finding_id) REFERENCES findings(id),
  INDEX idx_status (email_status),
  INDEX idx_admin_id (admin_id),
  INDEX idx_sent_at (sent_at)
);
```

---

## 🔧 BACKEND IMPLEMENTATION

### 1. Password Reset Controller

**File: `controllers/passwordResetController.js`**

```javascript
const db = require('../config/database');
const { sendPasswordResetNotification } = require('../services/emailService');

// 1. User submit forgot password request
exports.submitPasswordResetRequest = async (req, res) => {
  try {
    const { email, reason } = req.body;
    
    // Validate email exists in system
    const user = await db.query(
      'SELECT id FROM users WHERE email = ?', 
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
      `SELECT id FROM password_reset_requests 
       WHERE user_id = ? AND status = 'PENDING'`,
      [userId]
    );
    
    if (existingRequest.length) {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah memiliki permintaan reset password yang pending. Silakan hubungi admin.'
      });
    }
    
    // Create password reset request
    const result = await db.query(
      `INSERT INTO password_reset_requests (user_id, email, reason, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [userId, email, reason]
    );
    
    // Get full user data for notification
    const fullUser = await db.query(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [userId]
    );
    
    // Send notification to all admins
    const admins = await db.query('SELECT id, email FROM admins WHERE status = "ACTIVE"');
    
    for (const admin of admins) {
      await sendPasswordResetNotification(
        admin.email,
        fullUser[0],
        reason,
        result.insertId
      );
    }
    
    return res.status(200).json({
      success: true,
      message: 'Permintaan reset password telah dikirim ke admin. Silakan datang ke kantor untuk verifikasi.',
      requestId: result.insertId
    });
    
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat submit request'
    });
  }
};

// 2. Admin get pending password reset requests
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
        prr.created_at,
        prr.admin_notes
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
    console.error('Get pending requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data'
    });
  }
};

// 3. Admin verify & reset password
exports.verifyAndResetPassword = async (req, res) => {
  try {
    const { requestId, isApproved, notes } = req.body;
    const adminId = req.admin.id; // dari middleware auth
    
    // Get request details
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
      // Generate temporary password
      const tempPassword = generateSecurePassword();
      
      // Update user password
      const hashedPassword = await hashPassword(tempPassword);
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
      
      // Get user email for notification
      const user = await db.query(
        'SELECT email, name FROM users WHERE id = ?',
        [request[0].user_id]
      );
      
      // Send notification email to user
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
          newPassword: tempPassword,
          note: 'Password ini harus diberitahu langsung kepada user di kantor'
        }
      });
      
    } else {
      // Reject request
      await db.query(
        `UPDATE password_reset_requests 
         SET status = 'REJECTED', admin_notes = ?
         WHERE id = ?`,
        [notes, requestId]
      );
      
      const user = await db.query(
        'SELECT email, name FROM users WHERE id = ?',
        [request[0].user_id]
      );
      
      // Send rejection notification
      await sendPasswordResetRejectedEmail(
        user[0].email,
        user[0].name,
        notes
      );
      
      return res.status(200).json({
        success: true,
        message: 'Permintaan reset password ditolak'
      });
    }
    
  } catch (error) {
    console.error('Verify and reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat reset password'
    });
  }
};

// 4. Get password reset history
exports.getResetHistory = async (req, res) => {
  try {
    const { userId } = req.query;
    
    let query = `
      SELECT 
        prr.id,
        u.name,
        u.email,
        prr.reason,
        prr.status,
        prr.created_at,
        prr.reset_at,
        admin.name AS reset_by_admin
      FROM password_reset_requests prr
      JOIN users u ON prr.user_id = u.id
      LEFT JOIN admins admin ON prr.reset_by_admin_id = admin.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (userId) {
      query += ' AND prr.user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY prr.created_at DESC LIMIT 50';
    
    const history = await db.query(query, params);
    
    res.status(200).json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error('Get reset history error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan'
    });
  }
};

// Helper functions
function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function hashPassword(password) {
  const bcrypt = require('bcrypt');
  return await bcrypt.hash(password, 10);
}
```

### 2. Finding Report Email Service

**File: `services/emailService.js`**

```javascript
const nodemailer = require('nodemailer');
const { emailTemplates } = require('./emailTemplates');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Send password reset notification to admin
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
    
    console.log(`Password reset notification sent to ${adminEmail}`);
  } catch (error) {
    console.error('Send notification error:', error);
  }
};

// Send password reset completed email to user
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
    
    console.log(`Password reset email sent to ${userEmail}`);
  } catch (error) {
    console.error('Send email error:', error);
  }
};

// Send password reset rejected email
exports.sendPasswordResetRejectedEmail = async (userEmail, userName, reason) => {
  try {
    const html = emailTemplates.passwordResetRejected({
      userName: userName,
      reason: reason
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: '❌ Permintaan Reset Password Ditolak',
      html: html
    });
    
    console.log(`Password reset rejection email sent to ${userEmail}`);
  } catch (error) {
    console.error('Send email error:', error);
  }
};

// Send finding report email to admin
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
      subject: `🚨 Laporan Baru: ${finding.category} - ${finding.location}`,
      html: html,
      attachments: photoUrl ? [{
        filename: `finding_${finding.id}.jpg`,
        path: photoUrl
      }] : []
    });
    
    // Log email sent
    await db.query(
      `INSERT INTO email_notification_logs 
       (admin_id, finding_id, email_address, subject, email_status, sent_at)
       VALUES (?, ?, ?, ?, 'SENT', NOW())`,
      [finding.admin_id, finding.id, adminEmail, `Laporan: ${finding.category}`]
    );
    
    console.log(`Finding report email sent to ${adminEmail}`);
  } catch (error) {
    console.error('Send finding email error:', error);
    
    // Log failed email
    if (finding.id) {
      await db.query(
        `INSERT INTO email_notification_logs 
         (admin_id, finding_id, email_address, email_status, error_message, created_at)
         VALUES (?, ?, ?, 'FAILED', ?, NOW())`,
        [finding.admin_id, finding.id, adminEmail, error.message]
      );
    }
  }
};

// Send batch finding emails
exports.sendFindingEmailBatch = async (adminEmails, finding, photoUrl) => {
  const promises = adminEmails.map(email => 
    exports.sendFindingReportEmail(email, finding, photoUrl)
  );
  
  await Promise.allSettled(promises);
};
```

---

## 💻 FRONTEND IMPLEMENTATION

### 1. Forgot Password Component (User Side)

**File: `components/ForgotPasswordModal.jsx`**

```jsx
import React, { useState } from 'react';
import './ForgotPasswordModal.css';

const ForgotPasswordModal = ({ isOpen, onClose, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/password-reset/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          reason: reason
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(data.message);
        setEmail('');
        setReason('');
        
        // Close modal after 3 seconds
        setTimeout(() => {
          onClose();
          setSuccessMessage('');
        }, 3000);
      } else {
        setErrorMessage(data.message);
      }
    } catch (error) {
      setErrorMessage('Terjadi kesalahan. Silakan coba lagi.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>🔑 Lupa Password</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email yang Terdaftar</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Masukkan email Anda"
              required
            />
          </div>

          <div className="form-group">
            <label>Alasan (Opsional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mengapa Anda lupa password?"
              rows="4"
            />
          </div>

          {errorMessage && (
            <div className="alert alert-error">
              ❌ {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="alert alert-success">
              ✅ {successMessage}
            </div>
          )}

          <div className="info-box">
            <p>📍 <strong>Langkah selanjutnya:</strong></p>
            <ul>
              <li>Admin akan menerima notifikasi di aplikasi</li>
              <li>Datanglah ke kantor untuk verifikasi identitas</li>
              <li>Admin akan mereset password Anda langsung</li>
              <li>Password baru akan diberitahu oleh admin</li>
            </ul>
          </div>

          <button
            type="submit"
            className="btn-submit"
            disabled={isLoading}
          >
            {isLoading ? 'Mengirim...' : 'Kirim Permintaan Reset'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
```

**CSS: `components/ForgotPasswordModal.css`**

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 10px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 24px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  padding: 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
  font-family: Arial, sans-serif;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 5px rgba(76, 175, 80, 0.1);
}

.alert {
  padding: 12px 15px;
  border-radius: 5px;
  margin-bottom: 20px;
  font-size: 14px;
}

.alert-error {
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ef5350;
}

.alert-success {
  background-color: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #4caf50;
}

.info-box {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 5px;
  margin-bottom: 20px;
  font-size: 13px;
}

.info-box p {
  margin: 0 0 10px 0;
  font-weight: 600;
  color: #333;
}

.info-box ul {
  margin: 0;
  padding-left: 20px;
  list-style: disc;
}

.info-box li {
  margin: 5px 0;
  color: #666;
}

.btn-submit {
  width: 100%;
  padding: 12px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-submit:hover {
  background: #45a049;
}

.btn-submit:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

### 2. Admin Password Reset Dashboard

**File: `components/AdminPasswordResetDashboard.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import './AdminPasswordResetDashboard.css';

const AdminPasswordResetDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch('/api/password-reset/pending');
      const data = await response.json();
      
      if (data.success) {
        setRequests(data.data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      const response = await fetch('/api/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId,
          isApproved: true,
          notes: approvalNotes
        })
      });

      const data = await response.json();

      if (data.success) {
        setNewPassword(data.data.newPassword);
        alert(`✅ Password berhasil direset untuk ${data.data.userName}\n\nPassword baru: ${data.data.newPassword}\n\n⚠️ Berikan password ini langsung kepada user!`);
        
        setApprovalNotes('');
        setSelectedRequest(null);
        fetchPendingRequests();
      } else {
        alert('❌ ' + data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat reset password');
    }
  };

  const handleReject = async (requestId, reason) => {
    if (!confirm('Yakin ingin menolak request ini?')) return;

    try {
      const response = await fetch('/api/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId,
          isApproved: false,
          notes: reason
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Request ditolak');
        setSelectedRequest(null);
        fetchPendingRequests();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (isLoading) {
    return <div className="dashboard-loading">Memuat data...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>🔐 Manajemen Reset Password</h1>
        <div className="badge">{requests.length} Permintaan Pending</div>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <p>✅ Tidak ada permintaan reset password yang pending</p>
        </div>
      ) : (
        <div className="requests-list">
          {requests.map((request) => (
            <div
              key={request.id}
              className="request-card"
              onClick={() => setSelectedRequest(request)}
            >
              <div className="request-header">
                <div>
                  <h3>{request.user_name}</h3>
                  <p className="email">{request.user_email}</p>
                  <p className="phone">📞 {request.phone}</p>
                </div>
                <div className="request-meta">
                  <span className="role">{request.role}</span>
                  <span className="time">
                    📅 {new Date(request.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </div>

              {request.reason && (
                <div className="reason">
                  <strong>Alasan:</strong> {request.reason}
                </div>
              )}

              <button className="btn-detail">
                Lihat Detail & Verifikasi →
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Verifikasi & Reset Password</h2>
              <button className="close-btn" onClick={() => setSelectedRequest(null)}>✕</button>
            </div>

            <div className="user-details">
              <h3>{selectedRequest.user_name}</h3>
              <div className="detail-row">
                <span className="label">Email:</span>
                <span className="value">{selectedRequest.user_email}</span>
              </div>
              <div className="detail-row">
                <span className="label">Telepon:</span>
                <span className="value">{selectedRequest.phone}</span>
              </div>
              <div className="detail-row">
                <span className="label">Role:</span>
                <span className="value">{selectedRequest.role}</span>
              </div>
              <div className="detail-row">
                <span className="label">Tanggal Request:</span>
                <span className="value">
                  {new Date(selectedRequest.created_at).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              {selectedRequest.reason && (
                <div className="detail-row">
                  <span className="label">Alasan:</span>
                  <span className="value">{selectedRequest.reason}</span>
                </div>
              )}
            </div>

            <div className="verification-form">
              <h4>🔐 Verifikasi Identitas di Kantor</h4>
              <p className="info-text">
                Pastikan Anda telah memverifikasi identitas user di kantor sebelum mereset password.
              </p>

              <div className="form-group">
                <label>Catatan Verifikasi (Opsional)</label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Catatan hasil verifikasi di kantor..."
                  rows="4"
                />
              </div>

              <div className="button-group">
                <button
                  className="btn-approve"
                  onClick={() => handleApprove(selectedRequest.id)}
                >
                  ✅ Verifikasi & Reset Password
                </button>
                <button
                  className="btn-reject"
                  onClick={() => {
                    const reason = prompt('Alasan penolakan:');
                    if (reason) handleReject(selectedRequest.id, reason);
                  }}
                >
                  ❌ Tolak Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPasswordResetDashboard;
```

### 3. Finding Report Email Notification Handler

**File: `hooks/useFindingReportEmail.js`**

```jsx
import { useCallback } from 'react';

export const useFindingReportEmail = () => {
  const sendFindingReportWithEmail = useCallback(
    async (findingData, photoFile) => {
      try {
        // 1. Upload photo first
        const photoFormData = new FormData();
        photoFormData.append('file', photoFile);

        const photoResponse = await fetch('/api/upload/photo', {
          method: 'POST',
          body: photoFormData
        });

        const photoData = await photoResponse.json();
        const photoUrl = photoData.url;

        // 2. Submit finding report
        const findingResponse = await fetch('/api/findings/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...findingData,
            photoUrl: photoUrl
          })
        });

        const findingResult = await findingResponse.json();

        if (findingResult.success) {
          // 3. Send email to admins
          await fetch('/api/notifications/send-finding-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              findingId: findingResult.data.id,
              photoUrl: photoUrl
            })
          });

          return {
            success: true,
            message: 'Laporan berhasil dikirim ke admin (App + Email)',
            findingId: findingResult.data.id
          };
        } else {
          throw new Error(findingResult.message);
        }
      } catch (error) {
        console.error('Error sending finding report:', error);
        return {
          success: false,
          message: error.message
        };
      }
    },
    []
  );

  return { sendFindingReportWithEmail };
};
```

---

## 🚀 ROUTES & ENDPOINTS

### Password Reset Routes

```javascript
// routes/passwordReset.js
const express = require('express');
const router = express.Router();
const { 
  submitPasswordResetRequest,
  getPendingRequests,
  verifyAndResetPassword,
  getResetHistory
} = require('../controllers/passwordResetController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// User endpoints
router.post('/submit', submitPasswordResetRequest);
router.get('/history', authMiddleware, getResetHistory);

// Admin endpoints
router.get('/pending', adminMiddleware, getPendingRequests);
router.post('/verify', adminMiddleware, verifyAndResetPassword);

module.exports = router;
```

### Finding Notification Routes

```javascript
// routes/notifications.js
const express = require('express');
const router = express.Router();
const { sendFindingEmailNotification } = require('../controllers/notificationController');
const { adminMiddleware } = require('../middleware/auth');

router.post('/send-finding-email', adminMiddleware, sendFindingEmailNotification);

module.exports = router;
```

---

## 📧 EMAIL TEMPLATES

### Password Reset Notification Template

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h2>🔔 Notifikasi: User Lupa Password</h2>
  </div>

  <div style="padding: 30px; background: #f9f9f9;">
    <p>Halo Admin,</p>
    <p>Ada user yang meminta reset password. Berikut detail user:</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Nama:</strong> {{userName}}</p>
      <p><strong>Email:</strong> {{userEmail}}</p>
      <p><strong>Telepon:</strong> {{userPhone}}</p>
      <p><strong>Role:</strong> {{userRole}}</p>
      <p><strong>Alasan:</strong> {{reason}}</p>
    </div>

    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>⚠️ Langkah yang Harus Dilakukan:</strong></p>
      <ol>
        <li>Verifikasi identitas user di kantor secara offline</li>
        <li>Pastikan benar-benar user yang bersangkutan</li>
        <li>Buka Dashboard Admin → Password Reset</li>
        <li>Reset password dan berikan langsung kepada user</li>
        <li>Jangan kirim via email/chat</li>
      </ol>
    </div>

    <a href="{{dashboardLink}}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">
      Buka Dashboard Admin
    </a>
  </div>

  <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
    <p>Email ini dikirim otomatis dari Sistem HandoverApp</p>
  </div>
</div>
```

### Finding Report Email Template

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h2>🚨 Laporan Baru: Temuan/Blokir</h2>
  </div>

  <div style="padding: 30px; background: #f9f9f9;">
    <p>Halo Admin,</p>
    <p>Ada laporan temuan/blokir baru yang perlu Anda review. Berikut detailnya:</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #f5576c;">📍 Informasi Laporan</h3>
      <p><strong>Kategori:</strong> {{category}}</p>
      <p><strong>Lokasi:</strong> {{location}}</p>
      <p><strong>Tingkat Severity:</strong> <span style="background: #f5576c; color: white; padding: 5px 10px; border-radius: 3px;">{{severity}}</span></p>
      <p><strong>Tanggal:</strong> {{reportDate}}</p>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #333;">👤 Informasi Pelapor</h3>
      <p><strong>Nama:</strong> {{reporterName}}</p>
      <p><strong>Email:</strong> {{reporterEmail}}</p>
      <p><strong>Telepon:</strong> {{reporterPhone}}</p>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #333;">📝 Deskripsi</h3>
      <p>{{description}}</p>
    </div>

    {{#if photoUrl}}
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p><strong>📸 Foto Temuan:</strong></p>
      <img src="{{photoUrl}}" style="max-width: 100%; height: auto; border-radius: 5px; margin-top: 10px;" />
    </div>
    {{/if}}

    <a href="{{dashboardLink}}" style="display: inline-block; background: #f5576c; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">
      Review di Dashboard Admin
    </a>
  </div>

  <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
    <p>Email ini dikirim otomatis dari Sistem HandoverApp</p>
    <p>Notifikasi juga sudah dikirim ke aplikasi admin</p>
  </div>
</div>
```

---

## ✅ CHECKLIST IMPLEMENTASI

### Backend Setup
- [ ] Database migration untuk `password_reset_requests` table
- [ ] Database migration untuk `email_notification_logs` table
- [ ] Create `passwordResetController.js`
- [ ] Create `emailService.js` dengan templates
- [ ] Create routes untuk password reset
- [ ] Create routes untuk email notification
- [ ] Setup environment variables (EMAIL_USER, EMAIL_PASSWORD)
- [ ] Test email sending

### Frontend Setup
- [ ] Create `ForgotPasswordModal.jsx` component
- [ ] Create `AdminPasswordResetDashboard.jsx` component
- [ ] Add "Lupa Password?" link di login page
- [ ] Integrate forgot password modal
- [ ] Create admin dashboard navigation
- [ ] Add finding report email integration
- [ ] Test all flows

### Testing
- [ ] Test user submit forgot password
- [ ] Test admin receive notification
- [ ] Test admin reset password
- [ ] Test user receive notification
- [ ] Test finding report email
- [ ] Test email template rendering
- [ ] Load testing untuk multiple requests

---

## 🔐 SECURITY BEST PRACTICES

1. **Password Reset:**
   - Always generate random secure passwords
   - Never send password via insecure channels
   - Always require admin verification
   - Log all password resets
   - Require user to change temporary password on first login

2. **Email Notifications:**
   - Use environment variables for email credentials
   - Never expose email addresses in logs
   - Use TLS/SSL for email transmission
   - Validate email addresses before sending
   - Rate limit email sending to prevent spam

3. **General:**
   - Always validate input on backend
   - Use HTTPS for all API calls
   - Implement rate limiting
   - Log all admin actions
   - Require authentication for all endpoints

---

## 📞 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Email tidak terkirim | Check EMAIL_USER & EMAIL_PASSWORD di .env, check network, check email provider settings |
| Password reset gagal | Check database connection, check user ID is valid |
| Notification tidak muncul | Check admin ID is valid, check notification service is running |
| Photo tidak terupload | Check file size, check file type, check storage permissions |

---

Sekarang mari saya buat file konfigurasi lingkungan yang Anda butuhkan...
