'use strict';

require('dotenv').config();
const prisma = require('../src/config/prisma');

const { createId } = require('@paralleldrive/cuid2');

async function main() {
  const NO_POLISI = 'B9376TFV';
  console.log(`\n======================================================`);
  console.log(`PROSES UPDATE STATUS & RIWAYAT KECELAKAAN TRUK ${NO_POLISI}`);
  console.log(`======================================================\n`);

  // 1. Cari data kendaraan
  const vehicle = await prisma.vehicle.findUnique({
    where: { noPolisi: NO_POLISI }
  });

  if (!vehicle) {
    console.error(`❌ Kendaraan dengan noPolisi ${NO_POLISI} tidak ditemukan di database!`);
    process.exit(1);
  }
  console.log(`✓ Data kendaraan ditemukan: ${vehicle.noPolisi} (${vehicle.jenisKendaraan || '-'}) | Status saat ini: ${vehicle.status}`);

  // 2. Cari riwayat setelah 25 September 2026 (mulai 26 September 2026 00:00:00 WIB)
  const cutoffDate = new Date('2026-09-25T23:59:59+07:00');
  const handoversToDelete = await prisma.handover.findMany({
    where: {
      noPolisi: NO_POLISI,
      timestamp: { gt: cutoffDate }
    },
    orderBy: { timestamp: 'asc' },
    select: { id: true, handoverNo: true, timestamp: true, type: true, status: true }
  });

  console.log(`\n[1/4] Ditemukan ${handoversToDelete.length} riwayat handover setelah 25 September 2026 untuk dihapus:`);
  handoversToDelete.forEach((h, idx) => {
    console.log(`  ${idx + 1}. [${h.id}] ${h.handoverNo || '-'} | ${h.timestamp.toISOString()} | ${h.type} | ${h.status}`);
  });

  // 3. Cari user AMT untuk penugasan pada 25 September 2026
  let defaultUser = await prisma.user.findFirst({
    where: { role: 'AMT', name: { contains: 'SYARIF' } }
  });
  if (!defaultUser) {
    defaultUser = await prisma.user.findFirst({ where: { role: 'AMT' } });
  }

  // 4. Ambil template checklist
  const allChecklistItems = await prisma.checklistItem.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  });

  console.log(`\n[2/4] Menjalankan Transaksi Database...`);

  await prisma.$transaction(async (tx) => {
    // A. Hapus handovers setelah 25 September 2026
    if (handoversToDelete.length > 0) {
      const ids = handoversToDelete.map(h => h.id);
      
      // Hapus notifikasi terkait handovers ini jika ada
      await tx.notification.deleteMany({
        where: { actionId: { in: ids } }
      });

      // Hapus handovers (akan cascade ke items, photos, issues, amtIssues)
      const deleteResult = await tx.handover.deleteMany({
        where: { id: { in: ids } }
      });
      console.log(`  ✓ Berhasil menghapus ${deleteResult.count} riwayat handover setelah 25 Sept 2026.`);
    }

    // B. Cek apakah handover kecelakaan tanggal 25 September 2026 sudah ada
    const existingIncident = await tx.handover.findFirst({
      where: {
        noPolisi: NO_POLISI,
        timestamp: {
          gte: new Date('2026-09-25T00:00:00+07:00'),
          lte: new Date('2026-09-25T23:59:59+07:00')
        }
      }
    });

    if (!existingIncident) {
      console.log(`  ✓ Membuat data Handover Mulai & Akhiri (Kecelakaan) pada 25 September 2026...`);

      const incidentDateMulai = new Date('2026-09-25T07:00:00+07:00');
      const incidentDateCrash = new Date('2026-09-25T14:15:00+07:00');

      // Cari nomor urut berikutnya pada tanggal 25 September 2026
      const countResult = await tx.$queryRaw`
        SELECT COUNT(*) as count FROM handover 
        WHERE handoverNo LIKE 'HO-20260925-%'
      `;
      const baseSeq = Number(countResult[0]?.count || 82);
      const hoMulaiNo = `HO-20260925-${String(baseSeq + 1).padStart(4, '0')}`;
      const hoCrashNo = `HO-20260925-${String(baseSeq + 2).padStart(4, '0')}`;

      // 1. Handover Mulai (Shift Pagi)
      await tx.handover.create({
        data: {
          id: createId(),
          handoverNo: hoMulaiNo,
          noPolisi: NO_POLISI,
          shift: 'Pagi',
          type: 'mulai',
          status: 'Siap Operasi (Normal)',
          amt1: 'SUMARDIYANTO',
          amt2: defaultUser ? defaultUser.name : 'A SYARIF HIDAYATUROHMAN',
          notes: 'Pemeriksaan awal normal; kendaraan siap diberangkatkan.',
          userId: defaultUser.id,
          timestamp: incidentDateMulai,
          createdAt: incidentDateMulai,
          updatedAt: incidentDateMulai,
          items: {
            create: allChecklistItems.map(item => ({
              id: createId(),
              category: item.category,
              name: item.name,
              isGood: true,
              severity: null,
              notes: 'Baik / Normal'
            }))
          }
        }
      });

      // 2. Handover Akhiri dengan Laporan Insiden Tabrakan / Kecelakaan
      const crashHandoverId = createId();
      const createdCrashHandover = await tx.handover.create({
        data: {
          id: crashHandoverId,
          handoverNo: hoCrashNo,
          noPolisi: NO_POLISI,
          shift: 'Pagi',
          type: 'akhiri',
          status: 'Ada Masalah',
          amt1: 'SUMARDIYANTO',
          amt2: defaultUser ? defaultUser.name : 'A SYARIF HIDAYATUROHMAN',
          notes: '[KECELAKAAN TABRAKAN] Truk tangki B 9376 TFV mengalami kecelakaan tabrakan lalu lintas saat tugas pada 25 September 2026 pukul 14:15 WIB. Kerusakan berat (Major) pada kabin depan, bumper, sistem kemudi, rem, dan tangki. Truk dievakuasi ke bengkel rekanan dan DIBLOKIR / MAINTENANCE hingga waktu perbaikan yang belum ditentukan.',
          userId: defaultUser.id,
          timestamp: incidentDateCrash,
          createdAt: incidentDateCrash,
          updatedAt: incidentDateCrash,
          items: {
            create: allChecklistItems.map(item => {
              if (item.name === 'Kondisi Rem') {
                return {
                  id: createId(),
                  category: item.category,
                  name: item.name,
                  isGood: false,
                  severity: 'Major',
                  notes: 'Sistem rem rusak parah dan bocor akibat benturan tabrakan'
                };
              }
              if (item.name === 'Kondisi Kompartemen Tangki') {
                return {
                  id: createId(),
                  category: item.category,
                  name: item.name,
                  isGood: false,
                  severity: 'Major',
                  notes: 'Penyok dan deformasi akibat benturan kecelakaan 25 September 2026'
                };
              }
              if (item.name === 'Air Radiator' || item.name.toLowerCase().includes('radiator')) {
                return {
                  id: createId(),
                  category: item.category,
                  name: item.name,
                  isGood: false,
                  severity: 'Major',
                  notes: 'Radiator pecah dan kebocoran cairan pendingin total akibat benturan depan'
                };
              }
              if (item.name === 'Kondisi Wiper') {
                return {
                  id: createId(),
                  category: item.category,
                  name: item.name,
                  isGood: false,
                  severity: 'Minor',
                  notes: 'Lengan wiper patah akibat pecahan kaca depan'
                };
              }
              return {
                id: createId(),
                category: item.category,
                name: item.name,
                isGood: true,
                severity: null,
                notes: 'Normal'
              };
            })
          },
          // Issue status ONGOING (karena sedang perbaikan sampai sekarang tanpa batas waktu pasti)
          issue: {
            create: {
              id: createId(),
              status: 'ONGOING',
              createdAt: incidentDateCrash,
              updatedAt: new Date()
            }
          }
        }
      });

      console.log(`  ✓ Berhasil membuat laporan kecelakaan Handover ${hoCrashNo} dengan status Issue ONGOING.`);

      // 3. Notifikasi ke Admin & Pengawas
      await tx.notification.createMany({
        data: [
          {
            id: createId(),
            title: '🚨 KECELAKAAN: Truk B 9376 TFV Tabrakan',
            message: 'Truk B 9376 TFV mengalami kecelakaan tabrakan pada 25 September 2026. Kendaraan DIBLOKIR (status Maintenance) dan sedang dalam proses perbaikan total di bengkel.',
            type: 'ERROR',
            targetRole: 'ADMIN',
            actionType: 'VIEW_ISSUE',
            actionId: createdCrashHandover.id,
            noPolisi: NO_POLISI,
            isRead: false,
            createdAt: incidentDateCrash
          },
          {
            id: createId(),
            title: '🚨 KECELAKAAN: Truk B 9376 TFV Tabrakan',
            message: 'Truk B 9376 TFV mengalami kecelakaan tabrakan pada 25 September 2026. Kendaraan DIBLOKIR (status Maintenance) dan sedang dalam proses perbaikan total di bengkel.',
            type: 'ERROR',
            targetRole: 'PENGAWAS',
            actionType: 'VIEW_ISSUE',
            actionId: createdCrashHandover.id,
            noPolisi: NO_POLISI,
            isRead: false,
            createdAt: incidentDateCrash
          }
        ]
      });
      console.log(`  ✓ Notifikasi insiden kecelakaan berhasil dikirimkan ke Admin & Pengawas.`);
    }

    // C. Update status kendaraan menjadi 'Maintenance' (DIBLOKIR dari operasional)
    await tx.vehicle.update({
      where: { noPolisi: NO_POLISI },
      data: {
        status: 'Maintenance',
        updatedAt: new Date()
      }
    });
    console.log(`  ✓ Status kendaraan ${NO_POLISI} diubah menjadi 'Maintenance' (Sedang Diblokir).`);
  });

  // 5. Verifikasi Akhir
  console.log(`\n[3/4] Verifikasi Hasil di Database:`);
  const updatedVehicle = await prisma.vehicle.findUnique({
    where: { noPolisi: NO_POLISI }
  });
  console.log(`  • Status Truk ${updatedVehicle.noPolisi}: ${updatedVehicle.status} (DIBLOKIR / PERBAIKAN)`);

  const remainingHandovers = await prisma.handover.findMany({
    where: { noPolisi: NO_POLISI },
    orderBy: { timestamp: 'desc' },
    take: 5,
    include: { issue: true }
  });
  console.log(`\n[4/4] 5 Riwayat Handover Terakhir ${NO_POLISI}:`);
  remainingHandovers.forEach((h, i) => {
    console.log(`  ${i + 1}. [${h.id}] ${h.timestamp.toISOString()} | ${h.type.toUpperCase()} | Status: ${h.status} | Issue: ${h.issue?.status || 'NO_ISSUE'}`);
    if (h.notes) console.log(`     Catatan: ${h.notes.slice(0, 100)}...`);
  });

  console.log(`\n======================================================`);
  console.log(`✓ SEMUA PROSES BERHASIL DILAKUKAN.`);
  console.log(`======================================================\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Gagal menjalankan script:', err);
  process.exit(1);
});
