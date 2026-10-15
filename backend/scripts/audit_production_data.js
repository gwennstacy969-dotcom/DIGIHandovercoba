const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function auditData() {
  try {
    console.log('====================================================');
    console.log('📊 AUDIT INTEGRITAS DATA DATABASE PERTAMINA HANDOVER');
    console.log(`Waktu Audit: ${new Date().toISOString()}`);
    console.log('====================================================');

    // 1. Users
    const totalUsers = await prisma.user.count();
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true }
    });
    const rolesMap = {};
    usersByRole.forEach(r => rolesMap[r.role] = r._count.id);

    // 2. Vehicles
    const totalVehicles = await prisma.vehicle.count();
    const vehiclesByStatus = await prisma.vehicle.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    const vehicleStatusMap = {};
    vehiclesByStatus.forEach(v => vehicleStatusMap[v.status] = v._count.id);

    // 3. Checklist Items
    const totalChecklist = await prisma.checklistItem.count();

    // 4. Handovers & Items
    const totalHandovers = await prisma.handover.count();
    const totalHandoverItems = await prisma.handoverItem.count();
    const itemsGood = await prisma.handoverItem.count({ where: { isGood: true } });
    const itemsDamaged = await prisma.handoverItem.count({ where: { isGood: false } });

    // 5. Issues
    const totalIssues = await prisma.issue.count();
    const totalAmtIssues = await prisma.amtIssue.count();

    // 6. Photos
    const totalPhotos = await prisma.photo.count();

    // 7. Audit Logs & Notifications
    const totalAuditLogs = await prisma.auditLog.count();
    const totalNotifications = await prisma.notification.count();

    // 8. Ephemeral Data
    const totalLoginAttempts = await prisma.loginAttempt.count();
    const totalPasswordResets = await prisma.passwordResetRequest.count();

    const summary = {
      timestamp: new Date().toISOString(),
      businessData: {
        users: {
          total: totalUsers,
          byRole: rolesMap
        },
        vehicles: {
          total: totalVehicles,
          byStatus: vehicleStatusMap
        },
        checklists: totalChecklist,
        handovers: {
          total: totalHandovers,
          items: {
            total: totalHandoverItems,
            good: itemsGood,
            damaged: itemsDamaged
          }
        },
        issues: {
          vehicleIssues: totalIssues,
          amtComplianceIssues: totalAmtIssues
        },
        photos: totalPhotos,
        auditLogs: totalAuditLogs,
        notifications: totalNotifications
      },
      ephemeralData: {
        loginAttempts: totalLoginAttempts,
        passwordResetRequests: totalPasswordResets
      }
    };

    console.log('\n[1] DATA PENGGUNA (USERS):');
    console.log(`    Total Pengguna: ${summary.businessData.users.total}`);
    for (const [role, count] of Object.entries(rolesMap)) {
      console.log(`    - ${role}: ${count}`);
    }

    console.log('\n[2] DATA ARMADA (VEHICLES):');
    console.log(`    Total Mobil Tangki: ${summary.businessData.vehicles.total}`);
    for (const [st, count] of Object.entries(vehicleStatusMap)) {
      console.log(`    - Status ${st}: ${count}`);
    }

    console.log('\n[3] OPERASIONAL HANDOVER & INSPEKSI:');
    console.log(`    - Total Laporan Handover: ${summary.businessData.handovers.total}`);
    console.log(`    - Total Item Checklist Tersimpan: ${summary.businessData.handovers.items.total}`);
    console.log(`      * Kondisi Baik: ${itemsGood}`);
    console.log(`      * Kondisi Rusak/Perlu Perbaikan: ${itemsDamaged}`);
    console.log(`    - Total Isu Kendaraan: ${totalIssues}`);
    console.log(`    - Total Isu Kepatuhan AMT: ${totalAmtIssues}`);
    console.log(`    - Total Foto Bukti Fisik: ${totalPhotos}`);

    console.log('\n[4] AUDIT TRAIL & LOG SISTEM:');
    console.log(`    - Total Audit Log Perusahaan: ${totalAuditLogs}`);
    console.log(`    - Total Notifikasi: ${totalNotifications}`);

    console.log('\n[5] DATA SEMENTARA (EPHEMERAL):');
    console.log(`    - Catatan Login Attempts: ${totalLoginAttempts}`);
    console.log(`    - Permintaan Reset Password: ${totalPasswordResets}`);

    console.log('\n====================================================');
    console.log('✅ AUDIT SELESAI. Semua indikator terekam dengan akurat.');
    console.log('====================================================\n');

    return summary;
  } catch (error) {
    console.error('Gagal menjalankan audit data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  auditData();
}

module.exports = { auditData };
