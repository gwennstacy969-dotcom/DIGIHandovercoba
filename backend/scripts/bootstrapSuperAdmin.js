/**
 * CLI Bootstrap Script untuk Inisialisasi Akun SUPER_ADMIN DIGIHandover
 * 
 * Penggunaan:
 *   node scripts/bootstrapSuperAdmin.js
 * Atau dengan environment variables:
 *   SUPERADMIN_USERNAME=superadmin SUPERADMIN_PASSWORD=RahasiaSuper123! node scripts/bootstrapSuperAdmin.js
 * Atau dengan argumen:
 *   node scripts/bootstrapSuperAdmin.js --username=superadmin --password=RahasiaSuper123! --name="Super Administrator"
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- DIGIHandover Super Admin Bootstrap ---');

  // Parse args
  const args = process.argv.slice(2);
  const argMap = {};
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      argMap[key] = value || true;
    }
  });

  const username = argMap.username || process.env.SUPERADMIN_USERNAME || 'superadmin';
  const password = argMap.password || process.env.SUPERADMIN_PASSWORD || 'SuperAdminPertamina123!';
  const name = argMap.name || process.env.SUPERADMIN_NAME || 'Super Administrator';
  const jabatan = argMap.jabatan || process.env.SUPERADMIN_JABATAN || 'Super Administrator Pusat';
  const isForce = Boolean(argMap.force || process.env.SUPERADMIN_FORCE);

  // Periksa apakah SUPER_ADMIN sudah terdaftar di sistem
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });

  if (existingSuperAdmin && !isForce) {
    console.log(`[INFO] Super Admin sudah ada di sistem: "${existingSuperAdmin.username}" (${existingSuperAdmin.name}).`);
    console.log('[INFO] Gunakan argumen --force jika ingin membuat/memperbarui akun Super Admin.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Periksa apakah user dengan username ini sudah ada
  const existingUserByUsername = await prisma.user.findUnique({
    where: { username }
  });

  let superAdminUser;
  if (existingUserByUsername) {
    console.log(`[UPDATE] Memperbarui akun "${username}" menjadi SUPER_ADMIN...`);
    superAdminUser = await prisma.user.update({
      where: { username },
      data: {
        name,
        jabatan,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        deletedAt: null
      }
    });
  } else {
    console.log(`[CREATE] Membuat akun baru "${username}" sebagai SUPER_ADMIN...`);
    superAdminUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: 'SUPER_ADMIN',
        jabatan
      }
    });
  }

  // Catat ke AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        action: 'BOOTSTRAP_SUPER_ADMIN',
        userId: superAdminUser.id,
        details: JSON.stringify({
          username: superAdminUser.username,
          name: superAdminUser.name,
          role: superAdminUser.role,
          executedAt: new Date().toISOString()
        })
      }
    });
  } catch (err) {
    // AuditLog opsional jika tabel belum dibuat
  }

  console.log('====================================================');
  console.log('✅ SUPER_ADMIN berhasil diinisialisasi!');
  console.log(`   ID       : ${superAdminUser.id}`);
  console.log(`   Username : ${superAdminUser.username}`);
  console.log(`   Name     : ${superAdminUser.name}`);
  console.log(`   Role     : ${superAdminUser.role}`);
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error('❌ Gagal menjalankan bootstrap Super Admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
