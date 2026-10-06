-- ============================================
-- DATABASE MIGRATION: PASSWORD RESET & EMAIL NOTIFICATIONS
-- ============================================
-- Run this script ke database Anda untuk setup tables yang diperlukan

USE handover_app;

-- ============================================
-- 1. PASSWORD RESET REQUESTS TABLE
-- ============================================

DROP TABLE IF EXISTS password_reset_requests;

CREATE TABLE password_reset_requests (
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
  INDEX idx_reset_by (reset_by_admin_id),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. EMAIL NOTIFICATION LOGS TABLE
-- ============================================

DROP TABLE IF EXISTS email_notification_logs;

CREATE TABLE email_notification_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT,
  finding_id INT,
  email_address VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  email_type ENUM('PASSWORD_RESET', 'FINDING_REPORT', 'SYSTEM', 'DIGEST') DEFAULT 'SYSTEM',
  email_status ENUM('SENT', 'FAILED', 'PENDING', 'BOUNCED') DEFAULT 'PENDING',
  error_message TEXT,
  retry_count INT DEFAULT 0,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE SET NULL,
  
  INDEX idx_status (email_status),
  INDEX idx_admin_id (admin_id),
  INDEX idx_finding_id (finding_id),
  INDEX idx_sent_at (sent_at),
  INDEX idx_created_at (created_at),
  INDEX idx_type (email_type),
  INDEX idx_email (email_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. ADMIN EMAIL PREFERENCES TABLE (Optional)
-- ============================================

DROP TABLE IF EXISTS admin_email_preferences;

CREATE TABLE admin_email_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL UNIQUE,
  personal_email VARCHAR(255) NOT NULL,
  receive_password_reset_emails BOOLEAN DEFAULT true,
  receive_finding_emails BOOLEAN DEFAULT true,
  receive_digest_email BOOLEAN DEFAULT true,
  digest_frequency ENUM('DAILY', 'WEEKLY', 'MONTHLY') DEFAULT 'DAILY',
  digest_time TIME DEFAULT '08:00:00',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  INDEX idx_admin_id (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. NOTIFICATIONS TABLE (untuk in-app notifications)
-- ============================================

DROP TABLE IF EXISTS notifications;

CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  type ENUM('PASSWORD_RESET', 'FINDING_REPORT', 'SYSTEM', 'OTHER') DEFAULT 'OTHER',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSON,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  INDEX idx_admin_id (admin_id),
  INDEX idx_type (type),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. AUDIT LOG TABLE
-- ============================================

DROP TABLE IF EXISTS audit_logs;

CREATE TABLE audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id INT,
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_admin_id (admin_id),
  INDEX idx_action (action),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. STORED PROCEDURES
-- ============================================

-- Procedure: Get pending password reset requests
DROP PROCEDURE IF EXISTS sp_get_pending_password_resets;

DELIMITER $$

CREATE PROCEDURE sp_get_pending_password_resets(
  IN p_limit INT,
  IN p_offset INT
)
BEGIN
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
    (SELECT COUNT(*) FROM password_reset_requests WHERE status='PENDING') as total_count
  FROM password_reset_requests prr
  JOIN users u ON prr.user_id = u.id
  WHERE prr.status = 'PENDING'
  ORDER BY prr.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END$$

DELIMITER ;

-- Procedure: Get email notification statistics
DROP PROCEDURE IF EXISTS sp_get_email_stats;

DELIMITER $$

CREATE PROCEDURE sp_get_email_stats(
  IN p_days INT
)
BEGIN
  SELECT 
    DATE(created_at) as date,
    email_type,
    email_status,
    COUNT(*) as total,
    SUM(CASE WHEN email_status='SENT' THEN 1 ELSE 0 END) as sent_count,
    SUM(CASE WHEN email_status='FAILED' THEN 1 ELSE 0 END) as failed_count
  FROM email_notification_logs
  WHERE created_at >= DATE_SUB(NOW(), INTERVAL p_days DAY)
  GROUP BY DATE(created_at), email_type, email_status
  ORDER BY date DESC, email_type;
END$$

DELIMITER ;

-- Procedure: Archive old password reset requests
DROP PROCEDURE IF EXISTS sp_archive_old_requests;

DELIMITER $$

CREATE PROCEDURE sp_archive_old_requests(
  IN p_days INT
)
BEGIN
  -- This procedure archives requests older than p_days
  -- In production, implement with archival table
  DELETE FROM password_reset_requests
  WHERE status = 'COMPLETED' 
  AND created_at < DATE_SUB(NOW(), INTERVAL p_days DAY);
END$$

DELIMITER ;

-- ============================================
-- 7. VIEWS
-- ============================================

-- View: Active password reset requests
DROP VIEW IF EXISTS vw_active_password_resets;

CREATE VIEW vw_active_password_resets AS
SELECT 
  prr.id,
  u.name as user_name,
  u.email as user_email,
  prr.reason,
  prr.status,
  prr.created_at,
  TIMESTAMPDIFF(MINUTE, prr.created_at, NOW()) as minutes_pending
FROM password_reset_requests prr
JOIN users u ON prr.user_id = u.id
WHERE prr.status IN ('PENDING', 'APPROVED')
ORDER BY prr.created_at DESC;

-- View: Email notification statistics
DROP VIEW IF EXISTS vw_email_notification_stats;

CREATE VIEW vw_email_notification_stats AS
SELECT 
  DATE(created_at) as date,
  email_type,
  COUNT(*) as total_count,
  SUM(CASE WHEN email_status='SENT' THEN 1 ELSE 0 END) as sent_count,
  SUM(CASE WHEN email_status='FAILED' THEN 1 ELSE 0 END) as failed_count,
  ROUND(100.0 * SUM(CASE WHEN email_status='SENT' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM email_notification_logs
GROUP BY DATE(created_at), email_type
ORDER BY date DESC;

-- View: Failed emails requiring attention
DROP VIEW IF EXISTS vw_failed_emails;

CREATE VIEW vw_failed_emails AS
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
AND retry_count < 3
AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY created_at ASC;

-- ============================================
-- 8. EVENTS (Scheduled Tasks)
-- ============================================

-- Event: Cleanup old email logs (monthly)
DROP EVENT IF EXISTS evt_cleanup_email_logs;

CREATE EVENT evt_cleanup_email_logs
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  DELETE FROM email_notification_logs
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
  AND email_status = 'SENT';
END;

-- Event: Archive completed password resets (monthly)
DROP EVENT IF EXISTS evt_archive_password_resets;

CREATE EVENT evt_archive_password_resets
ON SCHEDULE EVERY 1 MONTH
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  -- Archive completed requests after 60 days
  -- In production, implement with archival table
  DELETE FROM password_reset_requests
  WHERE status = 'COMPLETED' 
  AND created_at < DATE_SUB(NOW(), INTERVAL 60 DAY);
END;

-- ============================================
-- 9. SAMPLE DATA (untuk testing)
-- ============================================

-- Insert sample data jika diperlukan

-- Example: Add test user (jika belum ada)
-- INSERT INTO users (name, email, password, phone, role, status)
-- VALUES (
--   'Test User',
--   'testuser@test.com',
--   '$2b$10$...',  -- hashed password
--   '081234567890',
--   'USER',
--   'ACTIVE'
-- );

-- Example: Add test admin (jika belum ada)
-- INSERT INTO admins (name, email, password, role, status)
-- VALUES (
--   'Test Admin',
--   'admin@test.com',
--   '$2b$10$...',  -- hashed password
--   'ADMIN',
--   'ACTIVE'
-- );

-- ============================================
-- 10. VERIFY MIGRATION
-- ============================================

-- Run queries berikut untuk verify
-- SELECT 'Tables created successfully!' as status;
-- SHOW TABLES LIKE '%password%';
-- SHOW TABLES LIKE '%email%';
-- SHOW PROCEDURES LIKE 'sp_%';
-- SHOW EVENTS;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Summary: 
-- ✅ 5 tables created (password_reset_requests, email_notification_logs, etc)
-- ✅ 3 stored procedures created
-- ✅ 3 views created for analytics
-- ✅ 2 events for automated cleanup
-- 
-- Next Steps:
-- 1. Update application .env file with email configuration
-- 2. Deploy backend code with email service
-- 3. Deploy frontend components
-- 4. Run integration tests
-- 5. Monitor email delivery

SHOW TABLES;
SHOW VIEWS;
SHOW PROCEDURES;
SHOW EVENTS;
