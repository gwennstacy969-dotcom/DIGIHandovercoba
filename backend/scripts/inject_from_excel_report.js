/**
 * INJECT DATA DARI Laporan_Handover_15Agu_13Okt_2026.xlsx KE DATABASE MYSQL
 * 
 * Meliputi:
 * 1. 4.818 Riwayat Handover resmi (15 Agu – 13 Okt 2026)
 * 2. Seluruh Item Checklist Inspeksi (Kategori A, B, C) untuk setiap handover (~120.000 rows)
 * 3. Isu Kendaraan (Major Vehicle Issues) terhubung ke temuan 27 September 2026 (dengan status verifikasi & catatan perbaikan)
 * 4. Isu Kepatuhan AMT (Category B Issues) terhubung ke temuan checklist AMT (lengkap dengan detail pelaporan & verifikasi pengawas)
 * 5. Notifikasi sistem terkait isu dan status inspeksi
 */

'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createId } = require('@paralleldrive/cuid2');
const prisma = require('../src/config/prisma');

function parseDateStr(str) {
  if (!str) return new Date();
  if (str.includes('-')) {
    const clean = str.replace(' ', 'T');
    return new Date(`${clean}:00+07:00`);
  }
  const num = parseFloat(str);
  if (!isNaN(num)) {
    const utcDays = Math.floor(num - 25569);
    const utcValue = utcDays * 86400;
    const fractionalDay = num - Math.floor(num);
    const totalSeconds = Math.floor(86400 * fractionalDay);
    return new Date((utcValue + totalSeconds) * 1000);
  }
  return new Date();
}

async function inject() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  INJEKSI DATA HANDOVER & INSPEKSI DARI LAPORAN EXCEL         ║');
  console.log('║  Periode: 15 Agustus 2026 – 13 Oktober 2026 (4.818 Data)     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Baca file JSON hasil ekstraksi dari Excel
  const jsonPath = path.join(__dirname, '..', '..', 'data', 'extracted_handovers.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File ${jsonPath} tidak ditemukan! Jalankan python data/extract_excel.py terlebih dahulu.`);
  }

  console.log('[1/6] Membaca data ekstraksi Excel...');
  const rawHandovers = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`  ✓ Berhasil membaca ${rawHandovers.length} data handover dari file Excel.`);

  // 2. Persiapan Data Master (User & Kendaraan & Checklist)
  console.log('[2/6] Memuat dan menyelaraskan Master Data...');

  // Armada kendaraan strictly 83 unit sesuai master dokumen Pertamina
  // Jika terdapat referensi B9805SFU dari simulasi lama, diselaraskan ke unit resmi B9810TEI


  const allUsers = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, role: true, jabatan: true }
  });
  const defaultAmtUser = allUsers.find(u => u.role === 'AMT') || allUsers[0];
  const userByNameMap = new Map();
  allUsers.forEach(u => userByNameMap.set(u.name.toLowerCase().trim(), u));

  console.log(`  ✓ ${allUsers.length} master user aktif siap dipetakan.`);

  const checklistMaster = await prisma.checklistItem.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  });
  console.log(`  ✓ ${checklistMaster.length} master checklist items dimuat.`);

  // 3. Bersihkan data lama jika ada untuk mencegah duplikasi
  console.log('[3/6] Mengosongkan data transaksi lama...');
  await prisma.emailNotificationLog.deleteMany({});
  await prisma.photo.deleteMany({});
  await prisma.issue.deleteMany({});
  await prisma.amtIssue.deleteMany({});
  await prisma.handoverItem.deleteMany({});
  await prisma.handover.deleteMany({});
  await prisma.notification.deleteMany({});
  console.log('  ✓ Database transaksi bersih.');

  // 4. Transformasi Data Handover, Items, dan Isu
  console.log('[4/6] Menyiapkan batch payload data...');

  const handoversPayload = [];
  const itemsPayload = [];
  const issuesPayload = [];
  const amtIssuesPayload = [];
  const notificationsPayload = [];

  // Data temuan kendaraan khusus (Major Issues pada 27 Sept 2026)
  const vehicleIssueDetails = {
    'HO-20260927-0056': {
      componentMatch: 'Kondisi Kompartemen Tangki',
      componentLabel: 'Torque Rod',
      severity: 'Major',
      detail: 'Bushing torque rod aus/longgar, kendaraan ditahan dan tidak boleh beroperasi sampai perbaikan serta verifikasi admin selesai.',
      repairNote: 'Bushing torque rod telah diganti dengan part baru standar OEM. Komponen telah diuji torsi dan alignment.',
      resolvedBy: 'Administrator',
      resolvedAt: new Date('2026-09-29T06:41:00+07:00')
    },
    'HO-20260927-0078': {
      componentMatch: 'Kondisi Wiper',
      componentLabel: 'Kondisi Wiper',
      severity: 'Major',
      detail: 'Wiper tidak berfungsi, motor wiper mati saat hujan deras. Kendaraan ditahan untuk perbaikan.',
      repairNote: 'Motor wiper dan blade wiper set telah diganti baru. Fungsi semprotan air dan kecepatan wiper normal.',
      resolvedBy: 'Administrator',
      resolvedAt: new Date('2026-09-29T06:35:00+07:00')
    },
    'HO-20260927-0022': {
      componentMatch: 'Kondisi Kompartemen Tangki',
      componentLabel: 'Drain Cok',
      severity: 'Major',
      detail: 'Drain Cok tidak berfungsi dan terdapat rembesan bahan bakar. Kendaraan ditahan untuk perbaikan.',
      repairNote: 'Seal dan valve drain cok telah diganti dan diuji tekan (pressure test) tanpa kebocoran.',
      resolvedBy: 'Administrator',
      resolvedAt: new Date('2026-09-29T06:32:00+07:00')
    },
    'HO-20260927-0066': {
      componentMatch: 'Kondisi Kompartemen Tangki',
      componentLabel: 'Bushing Trailer kanan dan kiri',
      severity: 'Major',
      detail: 'Bushing per trailer axle 2 aus parah, kendaraan tidak stabil saat muatan penuh.',
      repairNote: 'Bushing per trailer kanan dan kiri axle 2 telah diganti satu set lengkap dan diverifikasi tim workshop.',
      resolvedBy: 'Administrator',
      resolvedAt: new Date('2026-09-29T06:29:00+07:00')
    }
  };

  // Kepatuhan AMT khusus untuk mendemokan fitur interaktif inspeksi kepatuhan AMT
  const amtIssueConfigs = [
    {
      handoverNo: 'HO-20261013-0078',
      amtRole: 'AMT_1',
      itemName: 'Dokumen KIM',
      category: 'B',
      status: 'RESOLVED',
      notes: 'Masa berlaku Kartu Izin Masuk (KIM) mendekati batas expired (kurang dari 7 hari), perlu pengajuan perpanjangan segera.',
      actionTaken: 'Telah diajukan perpanjangan ke bagian HSE Fuel Terminal Maos dan surat rekomendasi sementara telah diterbitkan.',
      resolvedBy: 'Sekar (Pengawas)',
      resolvedAt: new Date('2026-10-13T23:45:00+07:00')
    },
    {
      handoverNo: 'HO-20261013-0014',
      amtRole: 'AMT_1',
      itemName: 'Menggunakan Safety Glove',
      category: 'B',
      status: 'RESOLVED',
      notes: 'Sarung tangan kerja (safety glove) robek/aus saat serah terima pergantian shift malam.',
      actionTaken: 'Diberikan penggantian sarung tangan kerja standar baru di pos keselamatan sebelum keberangkatan.',
      resolvedBy: 'Administrator',
      resolvedAt: new Date('2026-10-13T23:35:00+07:00')
    },
    {
      handoverNo: 'HO-20261013-0076',
      amtRole: 'AMT_2',
      itemName: 'ID/ HSE Paspor Berlaku',
      category: 'B',
      status: 'PENDING',
      notes: 'HSE Paspor tertinggal di loker mess pengemudi, diinstruksikan mengambil sebelum memasuki gate pengisian.',
      actionTaken: 'Menunggu konfirmasi pengambilan dokumen fisik oleh kru AMT.',
      resolvedBy: null,
      resolvedAt: null
    }
  ];

  const amtIssueMap = new Map();
  amtIssueConfigs.forEach(c => amtIssueMap.set(c.handoverNo, c));

  let odoCounter = 85000;

  for (let idx = 0; idx < rawHandovers.length; idx++) {
    const raw = rawHandovers[idx];
    const handoverId = createId();
    const timestamp = parseDateStr(raw.time);

    // Cari user input
    const normalizedReporter = (raw.diinputOleh || '').toLowerCase().trim();
    const matchedUser = userByNameMap.get(normalizedReporter) || defaultAmtUser;

    const vIssue = vehicleIssueDetails[raw.handoverNo];
    const amtIssueCfg = amtIssueMap.get(raw.handoverNo);

    const hasIssue = Boolean(vIssue);
    const statusOperasional = vIssue ? 'Tidak Siap Operasi (Perbaikan)' : (raw.statusOperasional || 'Siap Operasi (Normal)');
    const statusKondisi = vIssue ? 'Ada Masalah' : (raw.statusKondisi || 'Normal');

    handoversPayload.push({
      id: handoverId,
      handoverNo: raw.handoverNo,
      noPolisi: raw.noPolisi === 'B9805SFU' ? 'B9810TEI' : raw.noPolisi,
      shift: raw.shift || '07:00',
      status: statusOperasional,
      type: raw.type || 'mulai',
      locationLat: raw.lat || -7.6187,
      locationLng: raw.lng || 109.1442,
      amt1: raw.amt1 || matchedUser.name,
      amt2: raw.amt2 || 'Pendamping AMT',
      timestamp: timestamp,
      notes: raw.notes || 'Pemeriksaan serah terima serentak selesai.',
      userId: matchedUser.id,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    // Buat checklist items untuk handover ini
    odoCounter += Math.floor(Math.random() * 80) + 20;

    for (const master of checklistMaster) {
      let isGood = true;
      let severity = null;
      let itemNotes = null;
      let isRepaired = false;
      let repairNote = null;
      let repairPhotoUrl = null;

      // Jika ada isu kendaraan pada item ini
      if (vIssue && master.name === vIssue.componentMatch) {
        isGood = false;
        severity = vIssue.severity;
        itemNotes = vIssue.detail;
        isRepaired = true;
        repairNote = vIssue.repairNote;
        repairPhotoUrl = 'uploads/repair_sample.jpg';
      }

      // Jika ada isu kepatuhan AMT pada item ini
      if (amtIssueCfg && master.name === amtIssueCfg.itemName) {
        isGood = false;
        severity = 'Minor';
        itemNotes = amtIssueCfg.notes;
        if (amtIssueCfg.status === 'RESOLVED') {
          isRepaired = true;
          repairNote = amtIssueCfg.actionTaken;
        }
      }

      itemsPayload.push({
        id: createId(),
        category: master.category,
        name: (vIssue && master.name === vIssue.componentMatch) ? `${master.name} [MAJOR] - ${vIssue.componentLabel}` : master.name,
        isGood: isGood,
        handoverId: handoverId,
        severity: severity,
        notes: itemNotes,
        isRepaired: isRepaired,
        repairNote: repairNote,
        repairPhotoUrl: repairPhotoUrl,
        adminRejectionNote: null
      });
    }

    // Item Odo Meter (Kategori C)
    itemsPayload.push({
      id: createId(),
      category: 'C',
      name: `Odo Meter: ${odoCounter}`,
      isGood: true,
      handoverId: handoverId,
      severity: null,
      notes: null,
      isRepaired: false,
      repairNote: null,
      repairPhotoUrl: null,
      adminRejectionNote: null
    });

    // Buat Issue Kendaraan jika ada
    if (vIssue) {
      const issueId = createId();
      issuesPayload.push({
        id: issueId,
        handoverId: handoverId,
        status: 'RESOLVED',
        resolvedAt: vIssue.resolvedAt,
        repairRequestedAt: timestamp,
        resolvedBy: vIssue.resolvedBy,
        createdAt: timestamp,
        updatedAt: vIssue.resolvedAt
      });

      // Notifikasi Isu Kendaraan
      notificationsPayload.push({
        id: createId(),
        title: `Isu Kendaraan Ditemukan: ${raw.noPolisi}`,
        message: `Temuan [MAJOR] pada ${vIssue.componentLabel}: ${vIssue.detail}`,
        isRead: true,
        type: 'WARNING',
        targetRole: 'ADMIN',
        targetUserId: null,
        createdAt: timestamp,
        actionType: 'ISSUE',
        actionId: issueId,
        noPolisi: raw.noPolisi
      });

      notificationsPayload.push({
        id: createId(),
        title: `Perbaikan Selesai & Terverifikasi: ${raw.noPolisi}`,
        message: `Komponen ${vIssue.componentLabel} telah diperbaiki oleh Tim Workshop dan diverifikasi oleh ${vIssue.resolvedBy}.`,
        isRead: true,
        type: 'SUCCESS',
        targetRole: 'ALL',
        targetUserId: null,
        createdAt: vIssue.resolvedAt,
        actionType: 'ISSUE_RESOLVED',
        actionId: issueId,
        noPolisi: raw.noPolisi
      });
    }

    // Buat Isu Kepatuhan AMT jika ada
    if (amtIssueCfg) {
      const amtIssueId = createId();
      const targetAmtUser = (amtIssueCfg.amtRole === 'AMT_1')
        ? (userByNameMap.get((raw.amt1 || '').toLowerCase().trim()) || matchedUser)
        : (userByNameMap.get((raw.amt2 || '').toLowerCase().trim()) || matchedUser);

      amtIssuesPayload.push({
        id: amtIssueId,
        handoverId: handoverId,
        userId: targetAmtUser.id,
        amtName: targetAmtUser.name,
        amtRole: amtIssueCfg.amtRole,
        itemName: amtIssueCfg.itemName,
        category: amtIssueCfg.category,
        status: amtIssueCfg.status,
        notes: amtIssueCfg.notes,
        actionTaken: amtIssueCfg.actionTaken,
        resolvedAt: amtIssueCfg.resolvedAt,
        resolvedBy: amtIssueCfg.resolvedBy,
        createdAt: timestamp,
        updatedAt: amtIssueCfg.resolvedAt || timestamp
      });

      // Notifikasi Kepatuhan AMT
      notificationsPayload.push({
        id: createId(),
        title: `Peringatan Kepatuhan AMT: ${targetAmtUser.name}`,
        message: `Temuan Kategori B pada item ${amtIssueCfg.itemName} (${raw.noPolisi}): ${amtIssueCfg.notes}`,
        isRead: amtIssueCfg.status === 'RESOLVED',
        type: 'WARNING',
        targetRole: 'PENGAWAS',
        targetUserId: targetAmtUser.id,
        createdAt: timestamp,
        actionType: 'AMT_ISSUE',
        actionId: amtIssueId,
        noPolisi: raw.noPolisi
      });
    }
  }

  console.log(`  ✓ Siap menyuntikkan:`);
  console.log(`    - ${handoversPayload.length} Handover`);
  console.log(`    - ${itemsPayload.length} Checklist Items`);
  console.log(`    - ${issuesPayload.length} Isu Kendaraan`);
  console.log(`    - ${amtIssuesPayload.length} Isu Kepatuhan AMT`);
  console.log(`    - ${notificationsPayload.length} Notifikasi`);

  // 5. Injeksi Data ke Database Menggunakan Batching Cepat (createMany)
  console.log('\n[5/6] Menulis data ke MySQL dalam batch berkecepatan tinggi...');

  const BATCH_SIZE_HO = 1000;
  for (let i = 0; i < handoversPayload.length; i += BATCH_SIZE_HO) {
    const chunk = handoversPayload.slice(i, i + BATCH_SIZE_HO);
    await prisma.handover.createMany({ data: chunk });
    process.stdout.write(`\r  ✓ Handover tersimpan: ${Math.min(i + BATCH_SIZE_HO, handoversPayload.length)} / ${handoversPayload.length} ... `);
  }
  console.log('Selesai!');

  const BATCH_SIZE_ITEMS = 3000;
  for (let i = 0; i < itemsPayload.length; i += BATCH_SIZE_ITEMS) {
    const chunk = itemsPayload.slice(i, i + BATCH_SIZE_ITEMS);
    await prisma.handoverItem.createMany({ data: chunk });
    process.stdout.write(`\r  ✓ Checklist Items tersimpan: ${Math.min(i + BATCH_SIZE_ITEMS, itemsPayload.length)} / ${itemsPayload.length} ... `);
  }
  console.log('Selesai!');

  if (issuesPayload.length > 0) {
    await prisma.issue.createMany({ data: issuesPayload });
    console.log(`  ✓ ${issuesPayload.length} Isu Kendaraan tersimpan.`);
  }

  if (amtIssuesPayload.length > 0) {
    await prisma.amtIssue.createMany({ data: amtIssuesPayload });
    console.log(`  ✓ ${amtIssuesPayload.length} Isu Kepatuhan AMT tersimpan.`);
  }

  if (notificationsPayload.length > 0) {
    await prisma.notification.createMany({ data: notificationsPayload });
    console.log(`  ✓ ${notificationsPayload.length} Notifikasi sistem tersimpan.`);
  }

  // 6. Verifikasi Akhir
  console.log('\n[6/6] Verifikasi hasil injeksi data di database...');
  const [hCount, itemCount, issCount, amtCount, notifCount] = await Promise.all([
    prisma.handover.count(),
    prisma.handoverItem.count(),
    prisma.issue.count(),
    prisma.amtIssue.count(),
    prisma.notification.count()
  ]);

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  HASIL AKHIR VERIFIKASI DATABASE                             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Handover       : ${String(hCount).padEnd(36)} ║`);
  console.log(`║  Total Checklist Items: ${String(itemCount).padEnd(36)} ║`);
  console.log(`║  Total Isu Kendaraan  : ${String(issCount).padEnd(36)} ║`);
  console.log(`║  Total Kepatuhan AMT  : ${String(amtCount).padEnd(36)} ║`);
  console.log(`║  Total Pesan/Notif    : ${String(notifCount).padEnd(36)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n🎉 SELURUH DATA EXCEL BERHASIL DIINJEKSIKAN DENGAN LENGKAP!\n');
}

inject()
  .catch((e) => {
    console.error('\n❌ Gagal injeksi data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
