const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanGarbage() {
  try {
    console.log('====================================================');
    console.log('🧹 PEMBERSIHAN DATA SAMPAH PRODUKSI AMAN (SAFE CLEANUP)');
    console.log(`Waktu Eksekusi: ${new Date().toISOString()}`);
    console.log('====================================================');
    console.log('ℹ️  Aturan Ketat: Data bisnis, users, armada, handover, foto,');
    console.log('    dan audit trail TIDAK AKAN DISENTUH SAMA SEKALI.\n');

    // 1. Bersihkan Login Attempt yang sudah lebih lama dari 30 hari
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedLoginAttempts = await prisma.loginAttempt.deleteMany({
      where: {
        updatedAt: {
          lt: thirtyDaysAgo
        }
      }
    });
    console.log(`[1] Login Attempts kadaluarsa (>30 hari) dibersihkan: ${deletedLoginAttempts.count} record`);

    // 2. Bersihkan Password Reset Request yang sudah selesai/ditolak (>60 hari)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const deletedPasswordResets = await prisma.passwordResetRequest.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'REJECTED'] },
        updatedAt: {
          lt: sixtyDaysAgo
        }
      }
    });
    console.log(`[2] Riwayat Password Reset selesai/ditolak (>60 hari) dibersihkan: ${deletedPasswordResets.count} record`);

    console.log('\n====================================================');
    console.log('✅ PEMBERSIHAN AMAN SELESAI');
    console.log('   Seluruh data transaksi dan data master perusahaan 100% utuh.');
    console.log('====================================================\n');
  } catch (error) {
    console.error('Terjadi kesalahan saat pembersihan:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  cleanGarbage();
}

module.exports = { cleanGarbage };
