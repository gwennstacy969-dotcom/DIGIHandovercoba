/**
 * Professional Email Templates for HandoverApp
 * Digunakan untuk password reset dan finding report notifications
 */

const emailTemplates = {
  /**
   * PASSWORD RESET REQUEST NOTIFICATION - Notifikasi ke Admin
   */
  passwordResetNotification: (data) => {
    const {
      adminName = 'Admin',
      userName,
      userEmail,
      userPhone,
      userRole,
      reason,
      requestId,
      dashboardLink = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'
    } = data;

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notifikasi Password Reset</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h2 { font-size: 28px; margin: 0; font-weight: 700; }
        .header p { font-size: 14px; opacity: 0.9; margin-top: 5px; }
        .content { padding: 30px; background: white; }
        .greeting { font-size: 16px; margin-bottom: 20px; }
        .info-section {
          background: #f5f5f5;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e0e0e0;
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-weight: 600; color: #667eea; width: 30%; }
        .info-value { color: #333; word-break: break-all; }
        .warning-box {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-left: 4px solid #ffc107;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .warning-box h4 { color: #856404; margin-bottom: 10px; font-size: 16px; }
        .warning-box ol { padding-left: 20px; color: #856404; }
        .warning-box li { margin: 8px 0; }
        .action-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 14px 40px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .action-button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
        .note-section {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
          font-size: 14px;
          color: #1565c0;
        }
        .footer {
          background: #f0f0f0;
          padding: 20px 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-radius: 0 0 10px 10px;
        }
        .footer p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🔔 Notifikasi: User Lupa Password</h2>
          <p>Request ID: #${requestId}</p>
        </div>

        <div class="content">
          <p class="greeting">Halo ${adminName},</p>
          
          <p>Ada user yang telah mengajukan permintaan untuk reset password. Berikut adalah detail lengkap user:</p>

          <div class="info-section">
            <div class="info-row">
              <span class="info-label">👤 Nama</span>
              <span class="info-value">${userName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">📧 Email</span>
              <span class="info-value">${userEmail}</span>
            </div>
            <div class="info-row">
              <span class="info-label">📱 Telepon</span>
              <span class="info-value">${userPhone || '-'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">👔 Role</span>
              <span class="info-value">${userRole}</span>
            </div>
            ${reason ? `
            <div class="info-row">
              <span class="info-label">💬 Alasan</span>
              <span class="info-value">${reason}</span>
            </div>
            ` : ''}
          </div>

          <div class="warning-box">
            <h4>⚠️ Langkah yang Harus Dilakukan:</h4>
            <ol>
              <li><strong>Verifikasi Identitas</strong> - Minta user datang ke kantor dan verifikasi identitas secara langsung</li>
              <li><strong>Pastikan Keamanan</strong> - Pastikan benar-benar user yang bersangkutan, bukan orang lain</li>
              <li><strong>Reset Password</strong> - Buka Dashboard Admin dan klik tombol di bawah</li>
              <li><strong>Berikan Password Baru</strong> - Berikan password baru langsung kepada user (JANGAN via email/chat)</li>
              <li><strong>Minta Update Password</strong> - Minta user untuk update password saat login pertama kali</li>
            </ol>
          </div>

          <center>
            <a href="${dashboardLink}/password-reset" class="action-button">
              ➜ Buka Dashboard Admin
            </a>
          </center>

          <div class="note-section">
            <strong>ℹ️ Catatan Penting:</strong><br>
            Password baru harus diberikan LANGSUNG kepada user di kantor, bukan melalui email atau chat untuk keamanan data.
          </div>

          <hr style="border: 1px solid #e0e0e0; margin: 20px 0;">
          
          <p style="font-size: 13px; color: #999;">
            Jika Anda menerima email ini tetapi tidak mengharapkannya, mohon abaikan email ini.
          </p>
        </div>

        <div class="footer">
          <p>📧 Email ini dikirim otomatis dari Sistem HandoverApp</p>
          <p>⏰ ${new Date().toLocaleString('id-ID', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
        </div>
      </div>
    </body>
    </html>
    `;
  },

  /**
   * PASSWORD RESET COMPLETED - Notifikasi ke User
   */
  passwordResetCompleted: (data) => {
    const {
      userName,
      newPassword,
      loginLink = process.env.FRONTEND_URL || 'http://localhost:3000'
    } = data;

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Telah Direset</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; }
        .header {
          background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h2 { font-size: 28px; margin: 0; font-weight: 700; }
        .content { padding: 30px; background: white; }
        .greeting { font-size: 16px; margin-bottom: 20px; }
        .success-box {
          background: #e8f5e9;
          border: 2px solid #4CAF50;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
          text-align: center;
        }
        .success-box p { color: #2e7d32; font-weight: 600; }
        .password-box {
          background: #f5f5f5;
          border: 2px dashed #999;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
          border-radius: 5px;
        }
        .password-box .label { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
        .password-box .password {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          font-family: 'Courier New', monospace;
          letter-spacing: 2px;
          margin: 10px 0;
          user-select: all;
        }
        .instructions {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .instructions h4 { color: #1565c0; margin-bottom: 10px; }
        .instructions ol { padding-left: 20px; }
        .instructions li { margin: 8px 0; color: #1565c0; }
        .action-button {
          display: inline-block;
          background: #4CAF50;
          color: white;
          padding: 14px 40px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
        }
        .warning-box {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          font-size: 14px;
          color: #856404;
        }
        .footer {
          background: #f0f0f0;
          padding: 20px 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-radius: 0 0 10px 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✅ Password Anda Telah Direset</h2>
        </div>

        <div class="content">
          <p class="greeting">Halo ${userName},</p>
          
          <p>Password Anda telah berhasil direset oleh admin. Berikut adalah password baru Anda:</p>

          <div class="success-box">
            <p>🎉 Password Baru Tersedia</p>
          </div>

          <div class="password-box">
            <div class="label">Gunakan password berikut untuk login:</div>
            <div class="password">${newPassword}</div>
            <div class="label" style="font-size: 11px; margin-top: 10px;">*Pilih dan copy password di atas</div>
          </div>

          <div class="instructions">
            <h4>📝 Langkah Login Selanjutnya:</h4>
            <ol>
              <li>Buka aplikasi HandoverApp</li>
              <li>Masukkan email Anda: <strong>${userName}</strong></li>
              <li>Gunakan password baru yang di atas</li>
              <li>Klik tombol "Login"</li>
              <li>Setelah login pertama kali, Anda akan diminta untuk update password</li>
            </ol>
          </div>

          <center>
            <a href="${loginLink}" class="action-button">
              ➜ Buka Aplikasi
            </a>
          </center>

          <div class="warning-box">
            <strong>🔒 Keamanan:</strong><br>
            • Segera update password Anda dengan password yang lebih mudah diingat<br>
            • Jangan bagikan password ini kepada siapapun<br>
            • Jangan simpan password di tempat yang mudah diakses<br>
            • Jika ada aktivitas mencurigakan, hubungi admin segera
          </div>

          <hr style="border: 1px solid #e0e0e0; margin: 20px 0;">
          
          <p style="font-size: 13px; color: #999;">
            Jika Anda tidak meminta reset password, hubungi admin segera.
          </p>
        </div>

        <div class="footer">
          <p>📧 Email ini dikirim otomatis dari Sistem HandoverApp</p>
          <p>⏰ ${new Date().toLocaleString('id-ID')}</p>
        </div>
      </div>
    </body>
    </html>
    `;
  },

  /**
   * PASSWORD RESET REJECTED - Notifikasi ke User
   */
  passwordResetRejected: (data) => {
    const {
      userName,
      reason = 'Tidak ada penjelasan',
      contactEmail = process.env.EMAIL_USER
    } = data;

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Permintaan Reset Password Ditolak</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; }
        .header {
          background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h2 { font-size: 28px; margin: 0; font-weight: 700; }
        .content { padding: 30px; background: white; }
        .info-box {
          background: #ffebee;
          border: 1px solid #ef5350;
          border-left: 4px solid #f5576c;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .info-box h4 { color: #c62828; margin-bottom: 10px; }
        .info-box p { color: #b71c1c; }
        .action-button {
          display: inline-block;
          background: #f5576c;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: 600;
          font-size: 14px;
          margin: 20px 0;
        }
        .footer {
          background: #f0f0f0;
          padding: 20px 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-radius: 0 0 10px 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>❌ Permintaan Ditolak</h2>
        </div>

        <div class="content">
          <p>Halo ${userName},</p>
          
          <p>Permintaan reset password Anda telah ditolak oleh admin dengan alasan berikut:</p>

          <div class="info-box">
            <h4>Alasan Penolakan</h4>
            <p>${reason}</p>
          </div>

          <p>Jika Anda merasa ada kesalahpahaman atau ingin mengajukan request ulang, silakan hubungi admin:</p>
          
          <center>
            <a href="mailto:${contactEmail}" class="action-button">
              📧 Hubungi Admin
            </a>
          </center>
        </div>

        <div class="footer">
          <p>📧 Email ini dikirim otomatis dari Sistem HandoverApp</p>
        </div>
      </div>
    </body>
    </html>
    `;
  },

  /**
   * FINDING REPORT EMAIL - Notifikasi ke Admin
   */
  findingReportEmail: (data) => {
    const {
      adminName = 'Admin',
      reporterName,
      reporterEmail,
      reporterPhone,
      location,
      category,
      description,
      photoUrl,
      severity = 'MEDIUM',
      reportDate,
      dashboardLink = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'
    } = data;

    const severityColor = {
      'LOW': '#4CAF50',
      'MEDIUM': '#ff9800',
      'HIGH': '#f44336'
    };

    const severityText = {
      'LOW': 'Rendah',
      'MEDIUM': 'Sedang',
      'HIGH': 'Tinggi'
    };

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Laporan Temuan Baru</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; }
        .header {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h2 { font-size: 28px; margin: 0; font-weight: 700; }
        .content { padding: 30px; background: white; }
        .alert-banner {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-left: 5px solid #ffc107;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 5px;
          font-size: 14px;
          color: #856404;
        }
        .info-section {
          background: #f5f5f5;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .info-section h4 { color: #333; margin-bottom: 15px; font-size: 16px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e0e0e0;
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-weight: 600; color: #666; width: 35%; }
        .info-value { color: #333; word-break: break-all; }
        .severity-badge {
          display: inline-block;
          background: ${severityColor[severity]};
          color: white;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .photo-section {
          background: white;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
          border: 1px solid #ddd;
        }
        .photo-section h4 { margin-bottom: 15px; color: #333; }
        .photo-section img {
          max-width: 100%;
          height: auto;
          border-radius: 5px;
          display: block;
          margin: 10px 0;
        }
        .description-box {
          background: #f9f9f9;
          border-left: 4px solid #f5576c;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .description-box h4 { color: #333; margin-bottom: 10px; }
        .description-box p { color: #666; line-height: 1.8; white-space: pre-wrap; word-wrap: break-word; }
        .action-button {
          display: inline-block;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          padding: 14px 40px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
        }
        .action-button:hover { transform: translateY(-2px); }
        .footer {
          background: #f0f0f0;
          padding: 20px 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-radius: 0 0 10px 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🚨 Laporan Temuan Baru</h2>
          <p>Kategori: ${category}</p>
        </div>

        <div class="content">
          <div class="alert-banner">
            ⚠️ Ada laporan temuan/blokir baru yang memerlukan perhatian Anda.
          </div>

          <div class="info-section">
            <h4>📍 Detail Laporan</h4>
            <div class="info-row">
              <span class="info-label">Kategori</span>
              <span class="info-value">${category}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Lokasi</span>
              <span class="info-value">${location}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tingkat Severity</span>
              <span class="info-value"><span class="severity-badge">${severityText[severity]}</span></span>
            </div>
            <div class="info-row">
              <span class="info-label">Tanggal Laporan</span>
              <span class="info-value">${new Date(reportDate).toLocaleString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
          </div>

          <div class="info-section">
            <h4>👤 Informasi Pelapor</h4>
            <div class="info-row">
              <span class="info-label">Nama</span>
              <span class="info-value">${reporterName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email</span>
              <span class="info-value">${reporterEmail}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Telepon</span>
              <span class="info-value">${reporterPhone || '-'}</span>
            </div>
          </div>

          <div class="description-box">
            <h4>📝 Deskripsi Lengkap</h4>
            <p>${description}</p>
          </div>

          ${photoUrl ? `
          <div class="photo-section">
            <h4>📸 Foto Temuan</h4>
            <img src="${photoUrl}" alt="Foto temuan" />
          </div>
          ` : ''}

          <center>
            <a href="${dashboardLink}/findings" class="action-button">
              ➜ Review di Dashboard Admin
            </a>
          </center>

          <hr style="border: 1px solid #e0e0e0; margin: 20px 0;">
          
          <p style="font-size: 13px; color: #999;">
            Notifikasi ini juga telah dikirim ke aplikasi admin HandoverApp.
          </p>
        </div>

        <div class="footer">
          <p>📧 Email ini dikirim otomatis dari Sistem HandoverApp</p>
          <p>⏰ ${new Date().toLocaleString('id-ID')}</p>
        </div>
      </div>
    </body>
    </html>
    `;
  },

  /**
   * DAILY DIGEST EMAIL - Summary laporan harian
   */
  dailyDigestEmail: (data) => {
    const {
      adminName = 'Admin',
      date,
      totalFindings,
      totalPasswordResets,
      findings = [],
      dashboardLink = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'
    } = data;

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Digest - HandoverApp</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 20px 0;
        }
        .stat-card {
          background: rgba(255, 255, 255, 0.1);
          padding: 15px;
          border-radius: 5px;
          text-align: center;
        }
        .stat-number { font-size: 32px; font-weight: bold; }
        .stat-label { font-size: 12px; opacity: 0.9; margin-top: 5px; }
        .content { padding: 30px; background: white; }
        .finding-item {
          background: #f5f5f5;
          padding: 15px;
          margin: 10px 0;
          border-left: 4px solid #667eea;
          border-radius: 5px;
        }
        .finding-category { font-weight: 600; color: #667eea; }
        .finding-location { color: #999; font-size: 13px; }
        .action-button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: 600;
          margin: 20px 0;
        }
        .footer {
          background: #f0f0f0;
          padding: 20px 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-radius: 0 0 10px 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>📊 Daily Digest</h2>
          <p>${new Date(date).toLocaleDateString('id-ID', { 
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</p>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">🚨 ${totalFindings}</div>
              <div class="stat-label">Laporan Baru</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">🔐 ${totalPasswordResets}</div>
              <div class="stat-label">Reset Password</div>
            </div>
          </div>
        </div>

        <div class="content">
          <p>Halo ${adminName},</p>
          <p>Berikut adalah ringkasan aktivitas HandoverApp untuk hari ini:</p>

          ${findings.length > 0 ? `
          <h3 style="margin: 20px 0; color: #333;">📝 Laporan Terbaru</h3>
          ${findings.map(finding => `
            <div class="finding-item">
              <div class="finding-category">📍 ${finding.category}</div>
              <div class="finding-location">${finding.location}</div>
              <p style="margin: 5px 0; font-size: 14px;">${finding.description.substring(0, 100)}...</p>
            </div>
          `).join('')}
          ` : `
          <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; color: #2e7d32;">
            ✅ Tidak ada laporan baru hari ini
          </div>
          `}

          <center>
            <a href="${dashboardLink}" class="action-button">
              ➜ Buka Dashboard Lengkap
            </a>
          </center>
        </div>

        <div class="footer">
          <p>📧 Email ini dikirim otomatis setiap pukul 08:00 pagi</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
};

module.exports = { emailTemplates };
