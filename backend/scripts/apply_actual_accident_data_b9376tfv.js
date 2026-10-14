'use strict';

require('dotenv').config();
const prisma = require('../src/config/prisma');
const { createId } = require('@paralleldrive/cuid2');

async function main() {
  const NO_POLISI = 'B9376TFV';
  console.log(`\n==================================================================`);
  console.log(`PENYESUAIAN DATA KECELAKAAN B 9376 TFV (BUKTI DOKUMENTASI RESMI)`);
  console.log(`==================================================================\n`);

  // 1. Dapatkan user Joni Febrianto (AMT 1) & Hendrik Robiansyah (AMT 2)
  const joni = await prisma.user.findFirst({
    where: { name: { contains: 'Joni Febrianto' } }
  });
  const hendrik = await prisma.user.findFirst({
    where: { name: { contains: 'Hendrik Robiansyah' } }
  });

  if (!joni || !hendrik) {
    console.error('❌ Data user Joni Febrianto atau Hendrik Robiansyah tidak ditemukan di DB!');
    process.exit(1);
  }
  console.log(`✓ AMT 1: ${joni.name} (${joni.username}) [ID: ${joni.id}]`);
  console.log(`✓ AMT 2: ${hendrik.name} (${hendrik.username}) [ID: ${hendrik.id}]`);

  // 2. Ambil master checklist
  const allChecklistItems = await prisma.checklistItem.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  });

  // 3. Waktu insiden sesuai watermark foto: 28 September 2026
  const crashMulaiTs = new Date('2026-09-28T07:00:00+07:00');
  const crashAkhiriTs = new Date('2026-09-28T17:15:00+07:00');

  // Cari nomor urut handover tanggal 28 September 2026
  const countResult = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM handover 
    WHERE handoverNo LIKE 'HO-20260928-%'
  `;
  const baseSeq = Number(countResult[0]?.count || 70);
  const hoMulaiNo = `HO-20260928-${String(baseSeq + 1).padStart(4, '0')}`;
  const hoCrashNo = `HO-20260928-${String(baseSeq + 2).padStart(4, '0')}`;

  console.log(`✓ Nomor Handover: Mulai = ${hoMulaiNo}, Akhiri/Kecelakaan = ${hoCrashNo}`);

  await prisma.$transaction(async (tx) => {
    // A. Hapus data handover placeholder 25 September yang dibuat sebelumnya
    const oldIncidentHandovers = await tx.handover.findMany({
      where: {
        noPolisi: NO_POLISI,
        timestamp: { gte: new Date('2026-09-24T00:00:00+07:00') }
      },
      select: { id: true, handoverNo: true }
    });

    if (oldIncidentHandovers.length > 0) {
      const oldIds = oldIncidentHandovers.map(h => h.id);
      await tx.notification.deleteMany({
        where: { OR: [{ actionId: { in: oldIds } }, { noPolisi: NO_POLISI }] }
      });
      await tx.handover.deleteMany({
        where: { id: { in: oldIds } }
      });
      console.log(`✓ Berhasil membersihkan ${oldIncidentHandovers.length} data lama setelah 24 Sept 2026.`);
    }

    // B. Buat Handover Mulai (28 September 2026, 07:00 WIB)
    const mulaiId = createId();
    await tx.handover.create({
      data: {
        id: mulaiId,
        handoverNo: hoMulaiNo,
        noPolisi: NO_POLISI,
        shift: 'Pagi',
        type: 'mulai',
        status: 'Siap Operasi (Normal)',
        amt1: joni.name,
        amt2: hendrik.name,
        notes: 'Pemeriksaan awal normal; kendaraan diberangkatkan dinas distribusi BBM.',
        userId: joni.id,
        timestamp: crashMulaiTs,
        createdAt: crashMulaiTs,
        updatedAt: crashMulaiTs,
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
    console.log(`✓ Handover Mulai ${hoMulaiNo} berhasil dibuat.`);

    // C. Buat Handover Akhiri / Insiden Tabrakan dengan Truk Molen (28 September 2026, 17:15 WIB)
    const crashHandoverId = createId();
    const incidentNotes = `[KECELAKAAN TABRAKAN] Mobil Tangki BBM Nopol B 9376 TFV (Kapasitas 16 KL) mengalami kecelakaan tabrakan lalu lintas dengan KBM Mobil Truck Molen pada tanggal 28 September 2026 pukul 17.09 WIB di Jalan Lingkar Negaradaha, Kecamatan Bumiayu, Kabupaten Brebes, Jawa Tengah. Kerusakan terutama pada SISTEM PENGEREMAN (RUSAK TOTAL & GAGAL FUNGSI), kabin depan samping kiri ringsek parah, kaca depan pecah, pintu kiri hancur, ban depan kiri kempes, dan kompartemen depan tangki penyok. Truk dievakuasi dan DIBLOKIR / MAINTENANCE total hingga perbaikan selesai.`;

    const createdCrashHandover = await tx.handover.create({
      data: {
        id: crashHandoverId,
        handoverNo: hoCrashNo,
        noPolisi: NO_POLISI,
        shift: 'Pagi',
        type: 'akhiri',
        status: 'Ada Masalah',
        amt1: joni.name,
        amt2: hendrik.name,
        notes: incidentNotes,
        locationLat: -7.2443,
        locationLng: 109.0069,
        userId: joni.id,
        timestamp: crashAkhiriTs,
        createdAt: crashAkhiriTs,
        updatedAt: crashAkhiriTs,
        items: {
          create: allChecklistItems.map(item => {
            if (item.name === 'Kondisi Rem') {
              return {
                id: createId(),
                category: item.category,
                name: item.name,
                isGood: false,
                severity: 'Major',
                notes: 'Sistem pengereman rusak parah / blong dan terjadi kebocoran pipa rem akibat benturan keras dengan truk molen (KERUSAKAN UTAMA)'
              };
            }
            if (item.name === 'Kondisi Kompartemen Tangki') {
              return {
                id: createId(),
                category: item.category,
                name: item.name,
                isGood: false,
                severity: 'Major',
                notes: 'Bodi kompartemen depan tangki penyok dan mengalami benturan keras saat tabrakan'
              };
            }
            if (item.name === 'Air Radiator' || item.name.toLowerCase().includes('radiator')) {
              return {
                id: createId(),
                category: item.category,
                name: item.name,
                isGood: false,
                severity: 'Major',
                notes: 'Radiator pecah dan kebocoran cairan pendingin total akibat benturan depan samping kiri'
              };
            }
            if (item.name === 'Kondisi Wiper') {
              return {
                id: createId(),
                category: item.category,
                name: item.name,
                isGood: false,
                severity: 'Minor',
                notes: 'Kaca depan pecah seribu dan lengan wiper patah'
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
        // Foto dokumentasi insiden asli dari lapangan
        photos: {
          create: [
            {
              id: createId(),
              type: 'Kerusakan: Kondisi Rem & Kabin Depan Ringsek',
              url: 'uploads/tabrakan_b9376tfv_bumiayu_1.jpg',
              thumbnailUrl: 'uploads/tabrakan_b9376tfv_bumiayu_1.jpg',
              previewUrl: 'uploads/tabrakan_b9376tfv_bumiayu_1.jpg',
              originalSize: 217488
            },
            {
              id: createId(),
              type: 'Kerusakan: Sisi Kiri & Ban Depan Kempes',
              url: 'uploads/tabrakan_b9376tfv_bumiayu_2.jpg',
              thumbnailUrl: 'uploads/tabrakan_b9376tfv_bumiayu_2.jpg',
              previewUrl: 'uploads/tabrakan_b9376tfv_bumiayu_2.jpg',
              originalSize: 186233
            },
            {
              id: createId(),
              type: 'Laporan Identitas Kru & Unit B 9376 TFV',
              url: 'uploads/tabrakan_b9376tfv_laporan_who.jpg',
              thumbnailUrl: 'uploads/tabrakan_b9376tfv_laporan_who.jpg',
              previewUrl: 'uploads/tabrakan_b9376tfv_laporan_who.jpg',
              originalSize: 39798
            }
          ]
        },
        // Issue status ONGOING (masih perbaikan total di bengkel tanpa batas waktu)
        issue: {
          create: {
            id: createId(),
            status: 'ONGOING',
            createdAt: crashAkhiriTs,
            updatedAt: new Date()
          }
        }
      }
    });
    console.log(`✓ Handover Insiden Kecelakaan ${hoCrashNo} berhasil dibuat.`);

    // D. Notifikasi resmi kecelakaan ke Admin & Pengawas
    await tx.notification.createMany({
      data: [
        {
          id: createId(),
          title: '🚨 KECELAKAAN: Truk B 9376 TFV Tabrakan dengan Truk Molen',
          message: 'Truk Tangki B 9376 TFV (Kru: Joni Febrianto & Hendrik Robiansyah) mengalami tabrakan dengan KBM Truk Molen pada 28 September 2026 di Bumiayu, Brebes. Sistem pengereman rusak parah dan kendaraan DIBLOKIR / Maintenance total.',
          type: 'ERROR',
          targetRole: 'ADMIN',
          actionType: 'VIEW_ISSUE',
          actionId: createdCrashHandover.id,
          noPolisi: NO_POLISI,
          isRead: false,
          createdAt: crashAkhiriTs
        },
        {
          id: createId(),
          title: '🚨 KECELAKAAN: Truk B 9376 TFV Tabrakan dengan Truk Molen',
          message: 'Truk Tangki B 9376 TFV (Kru: Joni Febrianto & Hendrik Robiansyah) mengalami tabrakan dengan KBM Truk Molen pada 28 September 2026 di Bumiayu, Brebes. Sistem pengereman rusak parah dan kendaraan DIBLOKIR / Maintenance total.',
          type: 'ERROR',
          targetRole: 'PENGAWAS',
          actionType: 'VIEW_ISSUE',
          actionId: createdCrashHandover.id,
          noPolisi: NO_POLISI,
          isRead: false,
          createdAt: crashAkhiriTs
        }
      ]
    });
    console.log(`✓ Notifikasi insiden berhasil dikirimkan ke Admin & Pengawas.`);

    // E. Pastikan status kendaraan di master adalah 'Maintenance' (DIBLOKIR)
    await tx.vehicle.update({
      where: { noPolisi: NO_POLISI },
      data: {
        status: 'Maintenance',
        updatedAt: new Date()
      }
    });
    console.log(`✓ Status kendaraan ${NO_POLISI} dipastikan: Maintenance (DIBLOKIR).`);
  });

  // 4. Verifikasi Akhir
  console.log(`\n==================================================================`);
  console.log(`VERIFIKASI HASIL AKHIR:`);
  console.log(`==================================================================`);

  const updatedVehicle = await prisma.vehicle.findUnique({
    where: { noPolisi: NO_POLISI }
  });
  console.log(`• Status Kendaraan: ${updatedVehicle.status} (DIBLOKIR / MAINTENANCE)`);

  const latestHandovers = await prisma.handover.findMany({
    where: { noPolisi: NO_POLISI },
    orderBy: { timestamp: 'desc' },
    take: 3,
    include: { issue: true, photos: true, items: { where: { isGood: false } } }
  });

  latestHandovers.forEach((h, i) => {
    console.log(`\n${i + 1}. [${h.handoverNo}] Waktu: ${h.timestamp.toISOString()}`);
    console.log(`   Tipe: ${h.type.toUpperCase()} | Status: ${h.status} | Issue: ${h.issue?.status || 'NO_ISSUE'}`);
    console.log(`   Kru: AMT 1 = ${h.amt1} | AMT 2 = ${h.amt2}`);
    console.log(`   Jumlah Foto: ${h.photos.length}`);
    h.photos.forEach(p => console.log(`     - [${p.type}] -> ${p.url}`));
    console.log(`   Item Rusak:`);
    h.items.forEach(it => console.log(`     - ${it.name} (${it.severity}): ${it.notes}`));
  });

  console.log(`\n✓ DATA BERHASIL DISESUAIKAN SECARA SEMPURNA.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
