/**
 * GENERATE LAPORAN EXCEL SIMULASI HANDOVER MT PERTAMINA
 * Sesuai Template Handover Report excel.xlsx
 * Periode: 15 Agustus 2026 – 13 Oktober 2026
 */

'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

const SEED_MARKER = 'SIMULASI/DEMO-AUG15-OCT13-2026';

function pad2(n) { return String(n).padStart(2, '0'); }

function formatDateTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

function formatTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

function getShiftName(shiftStr) {
  if (!shiftStr) return 'Pagi';
  const hour = parseInt(shiftStr.split(':')[0], 10);
  if (isNaN(hour)) return shiftStr;
  if (hour >= 6 && hour < 14) return 'Pagi';
  if (hour >= 14 && hour < 22) return 'Siang';
  return 'Malam';
}

async function main() {
  const prisma = new PrismaClient({ log: [] });

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  GENERATE LAPORAN EXCEL SESUAI TEMPLATE RESMI               ║');
  console.log('║  DIGIHANDOVER PERTAMINA PATRA NIAGA FT MAOS                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const templatePath = [
    path.join(__dirname, '..', '..', 'data', 'Template Handover Report excel.xlsx'),
    path.join(__dirname, '..', 'data', 'Template Handover Report excel.xlsx')
  ].find(p => fs.existsSync(p));

  if (!templatePath) {
    throw new Error('Template Handover Report excel.xlsx tidak ditemukan!');
  }
  console.log(`[1/4] Memuat template: ${templatePath}`);

  // Fetch simulated handovers
  console.log('[2/4] Mengambil data simulasi dari database...');
  const handovers = await prisma.handover.findMany({
    where: { notes: { contains: SEED_MARKER } },
    include: {
      user: { select: { name: true, jabatan: true } },
      items: true,
      issue: true
    },
    orderBy: { timestamp: 'asc' }
  });

  console.log(`  ✓ Ditemukan ${handovers.length} records simulasi di DB.`);

  if (handovers.length === 0) {
    console.error('❌ Tidak ada data simulasi di database. Jalankan seed terlebih dahulu.');
    await prisma.$disconnect();
    return;
  }

  // Load workbook from template
  console.log('[3/4] Mengisi worksheet...');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  // 1. SHEET: Handover Report
  const sheetReport = workbook.getWorksheet('Handover Report');
  if (!sheetReport) throw new Error("Worksheet 'Handover Report' tidak ditemukan di template");

  // Remove sample rows if present (rows 5 and 6)
  // We will keep row 1..4 (Headers at row 4)
  while (sheetReport.rowCount > 4) {
    sheetReport.spliceRows(5, 1);
  }

  let totalTemuan = 0;
  let totalMajor = 0;
  let totalMinor = 0;
  let followUpOpen = 0;
  let followUpClosed = 0;
  const issuesList = [];

  for (const h of handovers) {
    const isBad = h.status === 'Ada Masalah';
    const badItems = h.items.filter(i => !i.isGood);

    let komponenArea = '-';
    let kategoriTemuan = '-';
    let detailTemuan = '-';
    let statusFollowUp = 'Closed';
    let diverifikasiOleh = 'Supervisor [Sistem Otomatis]';
    let waktuVerifikasi = '-';

    if (isBad && badItems.length > 0) {
      totalTemuan++;
      const firstBad = badItems[0];
      komponenArea = firstBad.name.includes('[MAJOR]')
        ? 'Bushing Per Trailer & Torque Rod (Axle 2)'
        : firstBad.name;
      kategoriTemuan = firstBad.severity || 'MAJOR';
      if (kategoriTemuan === 'MAJOR') totalMajor++; else totalMinor++;

      detailTemuan = firstBad.notes || 'Keausan signifikan pada bushing per trailer dan torque rod';
      statusFollowUp = (h.issue && h.issue.status === 'RESOLVED') || firstBad.isRepaired ? 'Closed' : 'Open';
      if (statusFollowUp === 'Closed') followUpClosed++; else followUpOpen++;

      diverifikasiOleh = h.issue?.resolvedBy || 'Tim Workshop & Pengawas FT Maos';
      waktuVerifikasi = h.issue?.resolvedAt ? formatDateTime(h.issue.resolvedAt) : formatDateTime(new Date(h.timestamp.getTime() + 10 * 60000));

      // Collect for Detail Temuan sheet
      for (const bi of badItems) {
        issuesList.push({
          handoverId: h.handoverNo || h.id,
          waktuTemuan: formatDateTime(h.timestamp),
          noPolisi: h.noPolisi,
          amt: h.amt1 || h.user?.name || 'AMT',
          komponen: bi.name.includes('[MAJOR]') ? 'Bushing Per Trailer & Torque Rod' : bi.name,
          kategori: bi.severity || 'MAJOR',
          detail: bi.notes || 'Temuan inspeksi serah terima',
          tindakan: bi.repairNote || 'Perbaikan dan penggantian komponen di workshop',
          status: statusFollowUp,
          catatan: 'SIMULASI/DEMO Handover Pertamina Patra Niaga FT Maos'
        });
      }
    } else {
      followUpClosed++;
      waktuVerifikasi = formatDateTime(new Date(h.timestamp.getTime() + 5 * 60000));
    }

    const rowData = [
      h.handoverNo || h.id,
      formatDateTime(h.timestamp),
      formatDate(h.timestamp),
      formatTime(h.timestamp),
      h.amt1 || h.user?.name || '-',
      h.user?.jabatan || 'AMT I',
      h.noPolisi,
      h.type === 'mulai' ? 'Mulai Pekerjaan' : 'Akhiri Pekerjaan',
      getShiftName(h.shift),
      'Fuel Terminal Maos',
      isBad ? 'Ada Temuan' : 'Normal',
      komponenArea,
      kategoriTemuan,
      detailTemuan,
      statusFollowUp,
      diverifikasiOleh,
      waktuVerifikasi
    ];

    const r = sheetReport.addRow(rowData);
    r.font = { name: 'Calibri', size: 10 };
    r.alignment = { vertical: 'middle', horizontal: 'left' };

    // Format specific cell alignments
    r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(15).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(17).alignment = { horizontal: 'center', vertical: 'middle' };

    // Highlight row if Ada Temuan
    if (isBad) {
      r.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF2CC' } // soft yellow alert
        };
      });
      r.getCell(11).font = { bold: true, color: { argb: 'FFC00000' } };
      r.getCell(13).font = { bold: true, color: { argb: 'FFC00000' } };
    }
  }

  // 2. SHEET: Detail Temuan
  const sheetDetail = workbook.getWorksheet('Detail Temuan');
  if (sheetDetail) {
    while (sheetDetail.rowCount > 3) {
      sheetDetail.spliceRows(4, 1);
    }
    for (const item of issuesList) {
      const r = sheetDetail.addRow([
        item.handoverId,
        item.waktuTemuan,
        item.noPolisi,
        item.amt,
        item.komponen,
        item.kategori,
        item.detail,
        item.tindakan,
        item.status,
        item.catatan
      ]);
      r.font = { name: 'Calibri', size: 10 };
      r.alignment = { vertical: 'middle', horizontal: 'left' };
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
      r.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4D6' } // soft orange
        };
      });
    }
  }

  // 3. SHEET: Rekap
  const sheetRekap = workbook.getWorksheet('Rekap');
  if (sheetRekap) {
    // Row 3: Total Handover
    sheetRekap.getCell('B3').value = handovers.length;
    // Row 4: Kendaraan Ada Temuan
    sheetRekap.getCell('B4').value = totalTemuan;
    // Row 5: Temuan Major
    sheetRekap.getCell('B5').value = totalMajor;
    // Row 6: Temuan Minor
    sheetRekap.getCell('B6').value = totalMinor;
    // Row 7: Follow Up Open
    sheetRekap.getCell('B7').value = followUpOpen;

    // Optional Row 8: Follow Up Closed
    const cellA8 = sheetRekap.getCell('A8');
    if (!cellA8.value) cellA8.value = 'Follow Up Closed';
    sheetRekap.getCell('B8').value = followUpClosed;
  }

  // Save Output
  console.log('[4/4] Menyimpan file Excel laporan...');
  const outDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'Laporan_Simulasi_Handover_15Agu_13Okt_2026.xlsx');

  await workbook.xlsx.writeFile(outPath);
  console.log(`  ✓ Tersimpan di: ${outPath}`);

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RINGKASAN LAPORAN EXCEL SIMULASI                            ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Baris Handover : ${String(handovers.length).padEnd(36)} ║`);
  console.log(`║  Kendaraan Temuan     : ${String(totalTemuan).padEnd(36)} ║`);
  console.log(`║  Temuan Major         : ${String(totalMajor).padEnd(36)} ║`);
  console.log(`║  Temuan Minor         : ${String(totalMinor).padEnd(36)} ║`);
  console.log(`║  Status Open          : ${String(followUpOpen).padEnd(36)} ║`);
  console.log(`║  Status Closed        : ${String(followUpClosed).padEnd(36)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Fatal:', e.message);
  process.exit(1);
});
