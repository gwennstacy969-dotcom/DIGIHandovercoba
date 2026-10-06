/**
 * Generator ID Bersih & Terstandarisasi untuk Seluruh Tabel HandoverApp
 * 
 * Aturan Penamaan:
 * - User: USR-0001, USR-0002, ...
 * - Vehicle: VH-001, VH-002, ...
 * - Handover: HO-YYYYMMDD-XXXX (contoh: HO-20261001-0001)
 * - HandoverItem: HI-000001, HI-000002, ...
 * - Issue: ISS-0001, ISS-0002, ...
 * - Photo: PHT-00001, PHT-00002, ...
 * - Notification: NTF-00001, NTF-00002, ...
 * - AuditLog: LOG-00001, LOG-00002, ...
 * - PasswordResetRequest: PRR-0001, PRR-0002, ...
 * - EmailNotificationLog: EML-0001, EML-0002, ...
 * - ChecklistItem: CHK-01, CHK-02, ...
 * - SystemSetting: SET-001, SET-002, ...
 */

const PREFIX_CONFIG = {
  User: { table: 'user', prefix: 'USR-', pad: 4 },
  Vehicle: { table: 'vehicle', prefix: 'VH-', pad: 3 },
  Handover: { table: 'handover', prefix: 'HO-', isDaily: true, pad: 4 },
  HandoverItem: { table: 'handoveritem', prefix: 'HI-', pad: 6 },
  Issue: { table: 'issue', prefix: 'ISS-', pad: 4 },
  Photo: { table: 'photo', prefix: 'PHT-', pad: 5 },
  Notification: { table: 'notification', prefix: 'NTF-', pad: 5 },
  AuditLog: { table: 'audit_log', prefix: 'LOG-', pad: 5 },
  PasswordResetRequest: { table: 'password_reset_request', prefix: 'PRR-', pad: 4 },
  EmailNotificationLog: { table: 'email_notification_log', prefix: 'EML-', pad: 4 },
  ChecklistItem: { table: 'checklistitem', prefix: 'CHK-', pad: 2 },
  SystemSetting: { table: 'system_setting', prefix: 'SET-', pad: 3 }
};

// Aliases agar bisa dipanggil dengan nama tabel atau nama model
const MODEL_ALIASES = {
  user: 'User',
  vehicle: 'Vehicle',
  handover: 'Handover',
  handoveritem: 'HandoverItem',
  issue: 'Issue',
  photo: 'Photo',
  notification: 'Notification',
  auditlog: 'AuditLog',
  audit_log: 'AuditLog',
  passwordresetrequest: 'PasswordResetRequest',
  password_reset_request: 'PasswordResetRequest',
  emailnotificationlog: 'EmailNotificationLog',
  email_notification_log: 'EmailNotificationLog',
  checklistitem: 'ChecklistItem',
  systemsetting: 'SystemSetting',
  system_setting: 'SystemSetting'
};

/**
 * Generate next formatted clean ID for a given model or table
 * @param {string} modelOrTable 
 * @param {object} prismaInstance 
 * @param {number} [batchOffset=0] Untuk pembuatan batch (createMany / nested creates)
 * @returns {Promise<string>}
 */
async function generateNextId(modelOrTable, prismaInstance, batchOffset = 0) {
  const prisma = prismaInstance || require('../config/prisma');
  const normalizedKey = MODEL_ALIASES[modelOrTable.toLowerCase()] || modelOrTable;
  const config = PREFIX_CONFIG[normalizedKey];

  if (!config) {
    // Fallback jika model tidak terdaftar
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `ID-${Date.now()}-${rand}`;
  }

  // Khusus Handover: HO-YYYYMMDD-XXXX
  if (config.isDaily) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePrefix = `HO-${y}${m}${d}-`;

    try {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT id FROM \`${config.table}\` 
        WHERE id LIKE ? 
        ORDER BY LENGTH(id) DESC, id DESC 
        LIMIT 1
      `, `${datePrefix}%`);

      let nextNum = 1;
      if (rows && rows.length > 0) {
        const lastId = rows[0].id;
        const match = lastId.match(/HO-\d+-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      return `${datePrefix}${String(nextNum + batchOffset).padStart(config.pad, '0')}`;
    } catch (e) {
      const fallbackSuffix = Math.floor(1000 + Math.random() * 9000);
      return `${datePrefix}${fallbackSuffix}`;
    }
  }

  // Model standar dengan auto-increment sequence prefix (e.g. USR-0001, HI-000001)
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id FROM \`${config.table}\` 
      WHERE id LIKE ? 
      ORDER BY LENGTH(id) DESC, id DESC 
      LIMIT 1
    `, `${config.prefix}%`);

    let nextNum = 1;
    if (rows && rows.length > 0) {
      const lastId = rows[0].id;
      const numPart = lastId.replace(config.prefix, '');
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    return `${config.prefix}${String(nextNum + batchOffset).padStart(config.pad, '0')}`;
  } catch (e) {
    const fallbackNum = Date.now().toString().slice(-config.pad);
    return `${config.prefix}${fallbackNum}`;
  }
}

module.exports = {
  generateNextId,
  PREFIX_CONFIG
};
