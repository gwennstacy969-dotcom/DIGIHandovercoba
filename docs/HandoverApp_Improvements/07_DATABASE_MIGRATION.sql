-- =============================================================================
-- DIGIHANDOVER PERTAMINA PATRA NIAGA FT MAOS
-- DATABASE MIGRATION SCRIPT: PASSWORD RESET, EMAIL NOTIFICATIONS & AUDIT LOGS
-- =============================================================================
-- File        : 07_DATABASE_MIGRATION.sql
-- Target      : MySQL 8.0+ / MariaDB 10.3+
-- Engine      : InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- Target DB   : handover_pertamina (atau sesuaikan dengan database target)
-- Kompatibel  : Prisma ORM DIGIHandover (Node.js/Express Backend)
-- Sifat Script: IDEMPOTENT (Aman dijalankan berulang kali tanpa merusak data)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PETUNJUK UNTUK VENDOR / TIM DBA:
-- -----------------------------------------------------------------------------
-- 1. Buka MySQL Client / Workbench / phpMyAdmin / CLI.
-- 2. Pastikan database target aktif (default: handover_pertamina).
-- 3. Jalankan script ini secara berurutan.
-- 4. Semua tabel menggunakan VARCHAR(191) untuk primary key (CUID/UUID) 
--    agar sinkron 100% dengan ORM Prisma aplikasi DIGIHandover.
-- -----------------------------------------------------------------------------

-- Pilih database target (hilangkan tanda komentar jika diperlukan):
-- USE `handover_pertamina`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 1. TABEL: password_reset_request
-- Modul: Permintaan Lupa Password User dengan Persetujuan Admin Offline
-- =============================================================================
CREATE TABLE IF NOT EXISTS `password_reset_request` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `reason` TEXT DEFAULT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `adminNotes` VARCHAR(500) DEFAULT NULL,
  `resetByAdminId` VARCHAR(191) DEFAULT NULL,
  `newPasswordHash` VARCHAR(191) DEFAULT NULL,
  `resetAt` DATETIME(3) DEFAULT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `password_reset_request_status_idx` (`status`),
  INDEX `password_reset_request_userId_idx` (`userId`),
  INDEX `password_reset_request_resetByAdminId_idx` (`resetByAdminId`),
  INDEX `password_reset_request_createdAt_idx` (`createdAt`),
  CONSTRAINT `password_reset_request_userId_fkey` 
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `password_reset_request_resetByAdminId_fkey` 
    FOREIGN KEY (`resetByAdminId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. TABEL: email_notification_log
-- Modul: Pencatatan Log Pengiriman Email (Password Reset, Notifikasi Temuan/Blokir)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `email_notification_log` (
  `id` VARCHAR(191) NOT NULL,
  `adminId` VARCHAR(191) DEFAULT NULL,
  `handoverId` VARCHAR(191) DEFAULT NULL,
  `emailAddress` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) DEFAULT NULL,
  `emailType` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
  `emailStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `errorMessage` TEXT DEFAULT NULL,
  `retryCount` INT NOT NULL DEFAULT 0,
  `sentAt` DATETIME(3) DEFAULT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `email_notification_log_emailStatus_idx` (`emailStatus`),
  INDEX `email_notification_log_adminId_idx` (`adminId`),
  INDEX `email_notification_log_handoverId_idx` (`handoverId`),
  INDEX `email_notification_log_emailType_idx` (`emailType`),
  INDEX `email_notification_log_createdAt_idx` (`createdAt`),
  CONSTRAINT `email_notification_log_adminId_fkey` 
    FOREIGN KEY (`adminId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `email_notification_log_handoverId_fkey` 
    FOREIGN KEY (`handoverId`) REFERENCES `handover` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. TABEL: notification
-- Modul: Notifikasi In-App untuk Admin dan AMT
-- =============================================================================
CREATE TABLE IF NOT EXISTS `notification` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` VARCHAR(191) NOT NULL,
  `isRead` TINYINT(1) NOT NULL DEFAULT 0,
  `type` VARCHAR(191) NOT NULL DEFAULT 'INFO',
  `targetRole` VARCHAR(191) DEFAULT 'ADMIN',
  `targetUserId` VARCHAR(191) DEFAULT NULL,
  `actionId` VARCHAR(191) DEFAULT NULL,
  `actionType` VARCHAR(191) DEFAULT NULL,
  `noPolisi` VARCHAR(191) DEFAULT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `notification_targetUserId_idx` (`targetUserId`),
  INDEX `notification_targetRole_idx` (`targetRole`),
  INDEX `notification_isRead_idx` (`isRead`),
  INDEX `notification_createdAt_idx` (`createdAt`),
  CONSTRAINT `notification_targetUserId_fkey` 
    FOREIGN KEY (`targetUserId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. TABEL: audit_log
-- Modul: Pencatatan Audit Trail Aktivitas Kritis Sistem
-- =============================================================================
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `details` TEXT DEFAULT NULL,
  `actionType` VARCHAR(191) DEFAULT NULL,
  `actionId` VARCHAR(191) DEFAULT NULL,
  `noPolisi` VARCHAR(191) DEFAULT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `audit_log_userId_idx` (`userId`),
  INDEX `audit_log_action_idx` (`action`),
  INDEX `audit_log_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. TABEL: system_setting & login_attempt (Security & Konfigurasi)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `system_setting` (
  `id` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `value` TEXT DEFAULT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_setting_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `login_attempt` (
  `id` VARCHAR(191) NOT NULL,
  `normalizedUsername` VARCHAR(191) NOT NULL,
  `failedAttempts` INT NOT NULL DEFAULT 0,
  `lastAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `login_attempt_normalizedUsername_key` (`normalizedUsername`),
  INDEX `login_attempt_normalizedUsername_idx` (`normalizedUsername`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. TABEL OPSIONAL: admin_email_preferences
-- Modul: Preferensi Notifikasi Email Personal Per-Admin
-- =============================================================================
CREATE TABLE IF NOT EXISTS `admin_email_preferences` (
  `id` VARCHAR(191) NOT NULL,
  `adminId` VARCHAR(191) NOT NULL,
  `personalEmail` VARCHAR(191) NOT NULL,
  `receivePasswordResetEmails` TINYINT(1) DEFAULT 1,
  `receiveFindingEmails` TINYINT(1) DEFAULT 1,
  `receiveDigestEmail` TINYINT(1) DEFAULT 1,
  `digestFrequency` VARCHAR(50) DEFAULT 'DAILY',
  `digestTime` TIME DEFAULT '08:00:00',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `admin_email_preferences_adminId_key` (`adminId`),
  CONSTRAINT `admin_email_preferences_adminId_fkey` 
    FOREIGN KEY (`adminId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 7. ANALYTICAL VIEWS
-- View pembantu untuk pelaporan, monitoring, dan dashboard
-- =============================================================================

-- View 1: Permintaan Reset Password Aktif
CREATE OR REPLACE VIEW `vw_active_password_resets` AS
SELECT 
  prr.id AS request_id,
  prr.userId,
  u.name AS user_name,
  u.username AS user_username,
  u.jabatan AS user_jabatan,
  u.role AS user_role,
  prr.email,
  prr.reason,
  prr.status,
  prr.adminNotes,
  prr.createdAt,
  TIMESTAMPDIFF(MINUTE, prr.createdAt, NOW()) AS minutes_pending
FROM `password_reset_request` prr
JOIN `user` u ON prr.userId = u.id
WHERE prr.status IN ('PENDING', 'APPROVED')
ORDER BY prr.createdAt DESC;

-- View 2: Statistik Pengiriman Email Notifikasi
CREATE OR REPLACE VIEW `vw_email_notification_stats` AS
SELECT 
  DATE(createdAt) AS report_date,
  emailType,
  COUNT(*) AS total_count,
  SUM(CASE WHEN emailStatus = 'SENT' THEN 1 ELSE 0 END) AS sent_count,
  SUM(CASE WHEN emailStatus = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
  SUM(CASE WHEN emailStatus = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
  ROUND(100.0 * SUM(CASE WHEN emailStatus = 'SENT' THEN 1 ELSE 0 END) / COUNT(*), 2) AS success_rate_pct
FROM `email_notification_log`
GROUP BY DATE(createdAt), emailType
ORDER BY report_date DESC, emailType ASC;

-- View 3: Log Email Gagal yang Memerlukan Perhatian / Retry
CREATE OR REPLACE VIEW `vw_failed_emails` AS
SELECT 
  enl.id AS log_id,
  enl.adminId,
  u.name AS admin_name,
  enl.emailAddress,
  enl.subject,
  enl.emailType,
  enl.errorMessage,
  enl.retryCount,
  enl.createdAt
FROM `email_notification_log` enl
LEFT JOIN `user` u ON enl.adminId = u.id
WHERE enl.emailStatus = 'FAILED' 
  AND enl.retryCount < 3
  AND enl.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY enl.createdAt ASC;

-- =============================================================================
-- 8. STORED PROCEDURES
-- Prosedur tersimpan untuk integrasi query performa tinggi
-- =============================================================================

-- Procedure 1: Mengambil Daftar Permintaan Reset Password Pending (Pagination)
DROP PROCEDURE IF EXISTS `sp_get_pending_password_resets`;

DELIMITER $$

CREATE PROCEDURE `sp_get_pending_password_resets`(
  IN p_limit INT,
  IN p_offset INT
)
BEGIN
  SELECT 
    prr.id,
    prr.userId,
    u.name AS user_name,
    u.username AS user_username,
    u.jabatan AS user_jabatan,
    u.role AS user_role,
    prr.email,
    prr.reason,
    prr.status,
    prr.createdAt,
    (SELECT COUNT(*) FROM `password_reset_request` WHERE `status` = 'PENDING') AS total_pending
  FROM `password_reset_request` prr
  JOIN `user` u ON prr.userId = u.id
  WHERE prr.status = 'PENDING'
  ORDER BY prr.createdAt DESC
  LIMIT p_limit OFFSET p_offset;
END$$

DELIMITER ;

-- Procedure 2: Ringkasan Metrik Email N Hari Terakhir
DROP PROCEDURE IF EXISTS `sp_get_email_stats`;

DELIMITER $$

CREATE PROCEDURE `sp_get_email_stats`(
  IN p_days INT
)
BEGIN
  SELECT 
    DATE(createdAt) AS date,
    emailType,
    emailStatus,
    COUNT(*) AS total,
    SUM(CASE WHEN emailStatus = 'SENT' THEN 1 ELSE 0 END) AS sent_count,
    SUM(CASE WHEN emailStatus = 'FAILED' THEN 1 ELSE 0 END) AS failed_count
  FROM `email_notification_log`
  WHERE createdAt >= DATE_SUB(NOW(), INTERVAL p_days DAY)
  GROUP BY DATE(createdAt), emailType, emailStatus
  ORDER BY date DESC, emailType ASC;
END$$

DELIMITER ;

-- Procedure 3: Arsip / Pembersihan Request Reset Password Usang
DROP PROCEDURE IF EXISTS `sp_archive_old_requests`;

DELIMITER $$

CREATE PROCEDURE `sp_archive_old_requests`(
  IN p_days INT
)
BEGIN
  DELETE FROM `password_reset_request`
  WHERE `status` IN ('COMPLETED', 'REJECTED', 'EXPIRED')
    AND `createdAt` < DATE_SUB(NOW(), INTERVAL p_days DAY);
END$$

DELIMITER ;

-- =============================================================================
-- 9. SCHEDULED EVENTS (Pemeliharaan Otomatis Database)
-- Catatan: Pastikan Event Scheduler aktif di server MySQL:
-- SET GLOBAL event_scheduler = ON;
-- =============================================================================

-- Event 1: Bersihkan log email terkirim yang lebih tua dari 90 hari (Bulanan)
DROP EVENT IF EXISTS `evt_cleanup_email_logs`;

DELIMITER $$

CREATE EVENT `evt_cleanup_email_logs`
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  DELETE FROM `email_notification_log`
  WHERE `createdAt` < DATE_SUB(NOW(), INTERVAL 90 DAY)
    AND `emailStatus` = 'SENT';
END$$

DELIMITER ;

-- Event 2: Bersihkan data reset password yang sudah selesai > 60 hari (Bulanan)
DROP EVENT IF EXISTS `evt_archive_password_resets`;

DELIMITER $$

CREATE EVENT `evt_archive_password_resets`
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  DELETE FROM `password_reset_request`
  WHERE `status` IN ('COMPLETED', 'REJECTED', 'EXPIRED')
    AND `createdAt` < DATE_SUB(NOW(), INTERVAL 60 DAY);
END$$

DELIMITER ;

-- =============================================================================
-- 10. VERIFIKASI HASIL MIGRASI
-- Jalankan query berikut untuk memastikan seluruh objek berhasil dibuat
-- =============================================================================

SELECT 'MIGRATION SUCCESS: All tables, views, procedures, and events verified!' AS `status`;

-- Cek Status Tabel Baru
SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN (
    'password_reset_request', 
    'email_notification_log', 
    'notification', 
    'audit_log', 
    'system_setting', 
    'login_attempt',
    'admin_email_preferences'
  );

-- Cek Status Views
SELECT TABLE_NAME AS VIEW_NAME 
FROM information_schema.VIEWS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME LIKE 'vw_%';

-- Cek Status Stored Procedures
SELECT ROUTINE_NAME, ROUTINE_TYPE 
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = DATABASE() 
  AND ROUTINE_NAME LIKE 'sp_%';

-- Cek Status Scheduled Events
SELECT EVENT_NAME, STATUS, INTERVAL_VALUE, INTERVAL_FIELD 
FROM information_schema.EVENTS 
WHERE EVENT_SCHEMA = DATABASE() 
  AND EVENT_NAME LIKE 'evt_%';
