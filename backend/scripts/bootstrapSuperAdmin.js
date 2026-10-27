/**
 * CLI Bootstrap Script Aman untuk Inisialisasi Akun SUPER_ADMIN DIGIHandover
 * 
 * ATURAN KEAMANAN:
 * - DILARANG menggunakan default hardcoded username/password (tidak ada fallback superadmin/admin123).
 * - Menghindari penulisan password pada argumen command-line (--password) agar tidak tercatat di shell history.
 * - Mendukung input interaktif terenkripsi/masked saat dijalankan langsung di terminal (TTY),
 *   atau melalui Environment Variables (SUPERADMIN_USERNAME & SUPERADMIN_PASSWORD) pada sistem otomatis/Secret Manager.
 * - Idempoten: Tidak akan mengganti password akun yang sudah ada secara diam-diam.
 * 
 * Penggunaan Aman:
 * 1. Mode Interaktif (Direkomendasikan di server):
 *    node scripts/bootstrapSuperAdmin.js
 * 
 * 2. Mode CI/Secret Manager (Non-interaktif):
 *    SUPERADMIN_USERNAME=adminpusat SUPERADMIN_PASSWORD=RahasiaPanjang123! node scripts/bootstrapSuperAdmin.js
 * 
 * 3. Mode Promosi Akun yang Sudah Ada (Eksplisit):
 *    node scripts/bootstrapSuperAdmin.js --promote-user=yoan
 */

const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper untuk membaca input tersembunyi (password masking)
function promptHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const stdin = process.openStdin();
    const onData = (char) => {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          break;
        default:
          process.stdout.clearLine(0);
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(query + '*'.repeat(rl.line ? rl.line.length : 0));
          break;
      }
    };

    process.stdin.on('data', onData);

    rl.question(query, (value) => {
      process.stdin.removeListener('data', onData);
      rl.close();
      console.log('');
      resolve(value ? value.trim() : '');
    });
  });
}

// Helper untuk membaca input teks biasa
function promptText(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(query, (value) => {
      rl.close();
      resolve(value ? value.trim() : '');
    });
  });
}

async function main() {
  console.log('====================================================');
  console.log('   DIGIHandover — Super Admin Bootstrap Protocol   ');
  console.log('====================================================\n');

  // Parse CLI args (hanya untuk flag non-sensitif)
  const args = process.argv.slice(2);
  const argMap = {};
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      argMap[key] = value || true;
    }
  });

  const isInteractive = Boolean(process.stdin.isTTY);
  let username = process.env.SUPERADMIN_USERNAME || argMap.username || '';
  let password = process.env.SUPERADMIN_PASSWORD || '';
  let name = process.env.SUPERADMIN_NAME || argMap.name || '';
  let jabatan = process.env.SUPERADMIN_JABATAN || argMap.jabatan || 'Super Administrator Pusat';
  const promoteUser = argMap['promote-user'] || process.env.SUPERADMIN_PROMOTE_USER || null;

  // 1. Tangani Mode Promosi Akun yang Sudah Ada
  if (promoteUser) {
    console.log(`[PROMOSI] Mencari akun "${promoteUser}" untuk dijadikan SUPER_ADMIN...`);
    const targetUser = await prisma.user.findFirst({
      where: { username: String(promoteUser).trim(), deletedAt: null }
    });

    if (!targetUser) {
      console.error(`❌ Pengguna dengan username "${promoteUser}" tidak ditemukan.`);
      process.exit(1);
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      console.log(`ℹ️ Pengguna "${targetUser.username}" (${targetUser.name}) sudah memiliki role SUPER_ADMIN.`);
      process.exit(0);
    }

    const updated = await prisma.user.update({
      where: { id: targetUser.id },
      data: { role: 'SUPER_ADMIN' }
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'BOOTSTRAP_PROMOTED_SUPER_ADMIN',
          actionType: 'SECURITY',
          userId: updated.id,
          details: JSON.stringify({
            promotedUsername: updated.username,
            promotedName: updated.name,
            previousRole: targetUser.role,
            newRole: 'SUPER_ADMIN',
            timestamp: new Date().toISOString()
          })
        }
      });
    } catch (_) {}

    console.log(`✅ Berhasil mempromosikan "${updated.username}" (${updated.name}) menjadi SUPER_ADMIN.`);
    process.exit(0);
  }

  // 2. Periksa apakah sistem sudah memiliki Super Admin aktif (Idempotensi Aman)
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', deletedAt: null }
  });

  if (existingSuperAdmin && !argMap.force) {
    console.log(`ℹ️ [IDEMPOTEN] Super Admin sudah terdaftar di sistem: "${existingSuperAdmin.username}" (${existingSuperAdmin.name}).`);
    console.log('ℹ️ Tidak ada perubahan yang dilakukan. Gunakan menu Kelola Admin di Dashboard untuk mengelola administrator.');
    process.exit(0);
  }

  // 3. Pengambilan Kredensial Aman (Interaktif vs Non-Interaktif)
  if (!username) {
    if (isInteractive) {
      username = await promptText('Masukkan Username Super Admin baru: ');
    } else {
      console.error('❌ [KEAMANAN] SUPERADMIN_USERNAME tidak didefinisikan. Bootstrap dihentikan.');
      console.error('   Silakan set variabel lingkungan SUPERADMIN_USERNAME atau jalankan di sesi interaktif.');
      process.exit(1);
    }
  }

  if (!username || username.trim().length < 3) {
    console.error('❌ Username harus minimal 3 karakter.');
    process.exit(1);
  }

  if (!password) {
    if (isInteractive) {
      password = await promptHidden('Masukkan Password Super Admin (min 8 karakter): ');
      const confirmPassword = await promptHidden('Konfirmasi Password: ');
      if (password !== confirmPassword) {
        console.error('❌ Konfirmasi password tidak cocok.');
        process.exit(1);
      }
    } else {
      console.error('❌ [KEAMANAN] SUPERADMIN_PASSWORD tidak didefinisikan. Script bootstrap menolak password default.');
      console.error('   Harap sediakan SUPERADMIN_PASSWORD via environment variable dari Secret Manager.');
      process.exit(1);
    }
  }

  if (!password || password.length < 8) {
    console.error('❌ Password Super Admin harus minimal 8 karakter demi keamanan sistem.');
    process.exit(1);
  }

  if (!name) {
    name = isInteractive ? (await promptText('Nama Lengkap [Super Administrator]: ') || 'Super Administrator') : 'Super Administrator';
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // 4. Buat atau perbarui akun secara eksplisit
  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  let resultUser;
  if (existingUser) {
    console.log(`[PERBARUI] Memperbarui akun "${username}" menjadi SUPER_ADMIN...`);
    resultUser = await prisma.user.update({
      where: { username },
      data: {
        role: 'SUPER_ADMIN',
        name: name || existingUser.name,
        jabatan,
        password: hashedPassword,
        deletedAt: null
      }
    });
  } else {
    console.log(`[BUAT] Membuat akun baru "${username}" sebagai SUPER_ADMIN...`);
    resultUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: 'SUPER_ADMIN',
        jabatan
      }
    });
  }

  // 5. Catat ke AuditLog tanpa password/token
  try {
    await prisma.auditLog.create({
      data: {
        action: 'BOOTSTRAP_SUPER_ADMIN_CREATED',
        actionType: 'SECURITY',
        userId: resultUser.id,
        details: JSON.stringify({
          username: resultUser.username,
          name: resultUser.name,
          role: resultUser.role,
          jabatan: resultUser.jabatan,
          createdAt: new Date().toISOString()
        })
      }
    });
  } catch (_) {}

  console.log('\n====================================================');
  console.log('✅ SUPER_ADMIN berhasil diinisialisasi secara aman!');
  console.log(`   ID       : ${resultUser.id}`);
  console.log(`   Username : ${resultUser.username}`);
  console.log(`   Name     : ${resultUser.name}`);
  console.log(`   Role     : ${resultUser.role}`);
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Gagal menjalankan bootstrap Super Admin:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
