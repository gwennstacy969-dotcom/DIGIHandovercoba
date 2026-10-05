const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');
const prisma = require('../config/prisma');

// Helper to format date YYYY-MM-DD HH:mm
const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// Helper for formatted Indonesian date
const formatDateIndo = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB';
};

// Helper for short date in compact tables (e.g. 25/09/2026 12:45)
const formatDateShort = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year}\n${hours}:${minutes}`;
};

// Helper to format Kru AMT
const formatAmtCrew = (h) => {
  const amt1 = h.amt1?.trim();
  const amt2 = h.amt2?.trim();
  if (amt1 && amt2) {
    return `${amt1} & ${amt2}`;
  }
  if (amt1) return amt1;
  if (amt2) return amt2;
  return h.user?.name || '-';
};

// Helper to format Kru AMT multiline for PDF tables
const formatAmtCrewPdf = (h) => {
  const amt1 = h.amt1?.trim();
  const amt2 = h.amt2?.trim();
  if (amt1 && amt2) {
    return `AMT 1: ${amt1}\nAMT 2: ${amt2}`;
  }
  if (amt1) return `AMT 1: ${amt1}`;
  if (amt2) return `AMT 2: ${amt2}`;
  return h.user?.name || '-';
};

// Helper to parse checklist items category
const getCategoryName = (cat) => {
  if (cat === 'A') return 'A. Perlengkapan Tangki';
  if (cat === 'B') return 'B. Perlengkapan AMT';
  if (cat === 'C') return 'C. Info Tambahan';
  return cat || '-';
};

// Helper to get official document handover number (HO-YYYYMMDD-XXXX)
const getHandoverCode = (h, handoverNoMap, fallbackIdx = 1) => {
  if (handoverNoMap && handoverNoMap.get(h.id)) {
    return handoverNoMap.get(h.id);
  }
  if (h.handoverNo && h.handoverNo.trim()) {
    return h.handoverNo.trim();
  }
  const d = new Date(h.timestamp || h.createdAt || Date.now());
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const seq = String(fallbackIdx).padStart(4, '0');
  return `HO-${year}${month}${day}-${seq}`;
};

/**
 * ============================================================================
 * EXPORT EXCEL CONTROLLER
 * Menghasilkan berkas .xlsx resmi berstandar Pertamina dengan kelengkapan:
 * (ID Handover, Tanggal & Waktu, No. Polisi, Kru AMT 1 & 2, Jabatan, Catatan, dsb.)
 * ============================================================================
 */
const exportExcel = async (req, res) => {
  try {
    const { status, shift, month, year, startDate, endDate, handoverId, id, search, q } = req.query;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Akses ditolak: Hanya Admin yang dapat mengekspor laporan' });
    }

    let where = {};
    if (!where.AND) where.AND = [];
    
    const targetId = handoverId || id;
    if (targetId) {
      where.id = targetId;
    }

    if (status && status !== 'Semua') {
      if (status === 'Normal') {
        where.status = 'Siap Operasi (Normal)';
      } else if (status === 'Isu') {
        where.status = { not: 'Siap Operasi (Normal)' };
      } else {
        where.status = status;
      }
    }
    
    if (shift && shift !== 'Semua') {
      where.shift = shift;
    }

    let dateFilters = [];
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilters.push({ timestamp: { gte: start, lte: end } });
    }

    const monthList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    if (year && year !== 'Semua') {
      const yearInt = parseInt(year);
      if (month && month !== 'Semua') {
        const monthIndex = monthList.indexOf(month);
        if (monthIndex !== -1) {
          const startMonth = new Date(yearInt, monthIndex, 1);
          const endMonth = new Date(yearInt, monthIndex + 1, 0, 23, 59, 59, 999);
          dateFilters.push({ timestamp: { gte: startMonth, lte: endMonth } });
        }
      } else {
        const startYear = new Date(yearInt, 0, 1);
        const endYear = new Date(yearInt, 11, 31, 23, 59, 59, 999);
        dateFilters.push({ timestamp: { gte: startYear, lte: endYear } });
      }
    } else if (month && month !== 'Semua') {
      const monthIndex = monthList.indexOf(month);
      if (monthIndex !== -1) {
        const monthOrs = [];
        const currentYear = new Date().getFullYear();
        for (let y = 2020; y <= currentYear + 5; y++) {
          const startMonth = new Date(y, monthIndex, 1);
          const endMonth = new Date(y, monthIndex + 1, 0, 23, 59, 59, 999);
          monthOrs.push({ timestamp: { gte: startMonth, lte: endMonth } });
        }
        dateFilters.push({ OR: monthOrs });
      }
    }

    if (dateFilters.length > 0) {
      where.AND.push(...dateFilters);
    }

    if (!where.status) {
      where.status = { not: 'NOT_STARTED' };
    }

    if (where.AND && where.AND.length === 0) {
      delete where.AND;
    }

    let handovers = await prisma.handover.findMany({
      where: where,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { id: true, name: true, jabatan: true, role: true } },
        items: true,
        issue: true
      }
    });

    const searchQuery = (search || q || '').trim().toLowerCase();
    if (searchQuery) {
      handovers = handovers.filter(item => {
        const dateStr = new Date(item.timestamp).toLocaleString('id-ID');
        return (
          (item.noPolisi && item.noPolisi.toLowerCase().includes(searchQuery)) ||
          (item.user && item.user.name && item.user.name.toLowerCase().includes(searchQuery)) ||
          (item.amt1 && item.amt1.toLowerCase().includes(searchQuery)) ||
          (item.amt2 && item.amt2.toLowerCase().includes(searchQuery)) ||
          dateStr.toLowerCase().includes(searchQuery)
        );
      });
    }

    let handoverNoMap = new Map();
    try {
      const rawCodes = await prisma.$queryRaw`SELECT id, handoverNo FROM handover WHERE handoverNo IS NOT NULL`;
      handoverNoMap = new Map(rawCodes.map(r => [r.id, r.handoverNo]));
    } catch (e) {
      console.warn('Could not load handoverNo mapping:', e.message);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Pertamina HandoverApp';
    workbook.lastModifiedBy = req.user ? req.user.name : 'System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const isSingle = handovers.length === 1 && !!targetId;

    // ============================================
    // SHEET 1: Laporan Handover
    // ============================================
    const reportSheet = workbook.addWorksheet('Laporan Handover', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    // Title Block
    reportSheet.mergeCells('A1:T2');
    const titleCell = reportSheet.getCell('A1');
    titleCell.value = 'DIGIHANDOVER – PERTAMINA PATRA NIAGA FUEL TERMINAL MAOS\nLAPORAN RESMI SERAH TERIMA KENDARAAN (HANDOVER REPORT)';
    titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12, name: 'Calibri' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    reportSheet.getRow(1).height = 24;
    reportSheet.getRow(2).height = 24;

    // Subheader Info row
    reportSheet.mergeCells('A3:T3');
    const subTitleCell = reportSheet.getCell('A3');
    let filterParts = [];
    if (status && status !== 'Semua') filterParts.push(`Status: ${status}`);
    if (shift && shift !== 'Semua') filterParts.push(`Shift: ${shift}`);
    if (month && month !== 'Semua') filterParts.push(`Bulan: ${month}`);
    if (year && year !== 'Semua') filterParts.push(`Tahun: ${year}`);
    if (startDate && endDate) filterParts.push(`Periode: ${startDate} s.d. ${endDate}`);
    if (searchQuery) filterParts.push(`Pencarian: ${searchQuery}`);

    let infoPeriode = filterParts.length > 0 ? `Filter Data => ${filterParts.join(' | ')}` : 'Semua Data';
    if (isSingle) {
      infoPeriode = `Laporan Tunggal Unit Handover ID: ${getHandoverCode(handovers[0], handoverNoMap, 1)}`;
    }
    subTitleCell.value = `${infoPeriode} | Total: ${handovers.length} Data | Waktu Ekspor: ${formatDateIndo(new Date())} | Oleh: ${req.user.name} (${req.user.role})`;
    subTitleCell.font = { italic: true, size: 9, color: { argb: 'FF333333' } };
    subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    reportSheet.getRow(3).height = 20;

    // Spacer
    reportSheet.addRow([]);

    // Header Row 5
    reportSheet.getRow(5).values = [
      'ID Handover',
      'Tanggal & Waktu',
      'No. Polisi',
      'Kru AMT',
      'AMT 1 (Driver Utama)',
      'AMT 2 (Driver Pendamping)',
      'Diinput Oleh',
      'Jabatan',
      'Tipe Handover',
      'Shift',
      'Status Kondisi',
      'Status Operasional',
      'Lokasi / GPS',
      'Catatan Handover',
      'Komponen Temuan',
      'Kategori Temuan',
      'Detail Kerusakan',
      'Status Follow Up',
      'Diverifikasi Oleh',
      'Waktu Verifikasi'
    ];

    reportSheet.columns = [
      { key: 'id', width: 28 },
      { key: 'tanggal', width: 18 },
      { key: 'noPolisi', width: 16 },
      { key: 'kruAmt', width: 30 },
      { key: 'amt1', width: 24 },
      { key: 'amt2', width: 24 },
      { key: 'diinputOleh', width: 22 },
      { key: 'jabatan', width: 20 },
      { key: 'tipe', width: 18 },
      { key: 'shift', width: 12 },
      { key: 'statusKondisi', width: 16 },
      { key: 'statusOperasional', width: 25 },
      { key: 'lokasi', width: 28 },
      { key: 'notes', width: 32 },
      { key: 'komponen', width: 28 },
      { key: 'kategori', width: 16 },
      { key: 'detailKerusakan', width: 35 },
      { key: 'statusFollowUp', width: 18 },
      { key: 'diverifikasiOleh', width: 20 },
      { key: 'waktuVerifikasi', width: 20 }
    ];

    const headerRow5 = reportSheet.getRow(5);
    headerRow5.height = 28;
    headerRow5.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004080' } };
    headerRow5.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    const detailTemuanData = [];
    const allChecklistItemsData = [];
    let totalHandover = handovers.length;
    let kendaraanAdaTemuan = 0;
    let temuanMajor = 0;
    let temuanMinor = 0;
    let followUpOpen = 0;
    let followUpClosed = 0;

    handovers.forEach((h, hIdx) => {
      const isMulai = h.type === 'mulai';
      const tipeStr = isMulai ? 'Mulai Pekerjaan' : 'Akhiri Pekerjaan';
      const shiftStr = h.shift || '-';
      const lokasiStr = h.locationLat && h.locationLng
        ? `Fuel Terminal Maos (${h.locationLat.toFixed(5)}, ${h.locationLng.toFixed(5)})`
        : 'Fuel Terminal Maos';

      const badItems = h.items ? h.items.filter(i => !i.isGood) : [];
      const hasIssue = badItems.length > 0;
      if (hasIssue) kendaraanAdaTemuan++;

      const statusKondisi = hasIssue ? 'Ada Temuan' : 'Normal';
      const komponenArr = badItems.map(i => i.name.replace(/\[MAJOR\]|\[MINOR\]/g, '').trim());
      const komponenStr = komponenArr.length > 0 ? komponenArr.join(', ') : '-';

      let kategoriStr = '-';
      let majorCount = 0;
      let minorCount = 0;
      badItems.forEach(i => {
        if (i.name.includes('[MAJOR]')) {
          majorCount++;
          temuanMajor++;
        } else if (i.name.includes('[MINOR]')) {
          minorCount++;
          temuanMinor++;
        }
      });

      if (majorCount > 0 && minorCount > 0) kategoriStr = 'Major & Minor';
      else if (majorCount > 0) kategoriStr = 'Major';
      else if (minorCount > 0) kategoriStr = 'Minor';

      const amt1 = h.amt1?.trim() || '';
      const amt2 = h.amt2?.trim() || '';
      const kruAmtStr = (amt1 && amt2) ? `${amt1} & ${amt2}` : (amt1 || amt2 || h.user?.name || '-');
      const waktuStr = formatDate(h.timestamp);

      let statusFollowUp = hasIssue ? 'Open' : '-';
      let diverifikasiOleh = '-';
      let waktuVerifikasi = '-';

      if (h.issue) {
        if (h.issue.status === 'RESOLVED') {
          statusFollowUp = 'Closed';
          followUpClosed++;
        } else {
          statusFollowUp = 'Open';
          followUpOpen++;
        }
        if (h.issue.resolvedBy) diverifikasiOleh = h.issue.resolvedBy;
        if (h.issue.resolvedAt) waktuVerifikasi = formatDate(h.issue.resolvedAt);
      } else if (!hasIssue) {
        statusFollowUp = 'Normal';
      }

      // Kumpulkan item temuan untuk Sheet 2
      if (hasIssue) {
        badItems.forEach(item => {
          const isMajor = item.name.includes('[MAJOR]');
          const itemName = item.name.replace(/\[MAJOR\]|\[MINOR\]/g, '').trim();
          detailTemuanData.push({
            handoverId: getHandoverCode(h, handoverNoMap, hIdx + 1),
            waktu: waktuStr,
            nopol: h.noPolisi,
            amt: kruAmtStr,
            diinputOleh: h.user ? h.user.name : '-',
            jabatan: h.user ? (h.user.jabatan || '-') : '-',
            shift: shiftStr,
            komponen: itemName,
            kategori: isMajor ? 'Major' : 'Minor',
            detail: item.description || `Catatan kondisi ${itemName.toLowerCase()}`,
            repairNote: item.repairNote || '-',
            isRepaired: item.isRepaired ? 'Sudah Diperbaiki' : 'Belum Diperbaiki',
            tindakan: item.isRepaired
              ? 'Selesai Diperbaiki'
              : (h.issue && h.issue.status === 'RESOLVED' ? 'Telah diperbaiki' : 'Dilaporkan ke supervisor'),
            status: (h.issue && h.issue.status === 'RESOLVED') || item.isRepaired ? 'Closed' : 'Open',
            diverifikasiOleh: diverifikasiOleh,
            waktuVerifikasi: waktuVerifikasi
          });
        });
      }

      // Kumpulkan seluruh item jika single handover untuk Sheet Rincian Checklist
      if (isSingle && h.items) {
        let validItemIdx = 0;
        h.items.forEach((item) => {
          // Lewati dummy catatan foto agar tidak polusi daftar checklist inspeksi
          if (item.name && item.name.startsWith('Catatan Foto:')) return;
          validItemIdx++;

          const isMajor = item.name.includes('[MAJOR]');
          const isMinor = item.name.includes('[MINOR]');
          const cleanName = item.name.replace(/\[MAJOR\]|\[MINOR\]/g, '').trim();
          let severityStr = 'Normal';
          if (isMajor) severityStr = 'Major';
          else if (isMinor) severityStr = 'Minor';

          allChecklistItemsData.push({
            no: validItemIdx,
            handoverId: getHandoverCode(h, handoverNoMap, hIdx + 1),
            nopol: h.noPolisi,
            kategori: getCategoryName(item.category),
            namaItem: cleanName,
            kondisi: item.isGood ? 'Baik / Normal' : 'Ada Temuan',
            severity: severityStr,
            catatan: item.repairNote || item.description || '-',
            statusPerbaikan: item.isRepaired ? 'Sudah Diperbaiki' : (item.isGood ? 'Normal' : 'Belum Diperbaiki')
          });
        });
      }

      // Catatan terpadu: h.notes, atau fallback dari legacy Catatan Foto jika notes kosong
      const legacyPhotoNote = h.items?.find(it => it.name && it.name.startsWith('Catatan Foto:'))?.name?.replace('Catatan Foto:', '').trim();
      const unifiedNotes = (h.notes && h.notes.trim()) || legacyPhotoNote || '-';

      const row = reportSheet.addRow({
        id: getHandoverCode(h, handoverNoMap, hIdx + 1),
        tanggal: waktuStr,
        noPolisi: h.noPolisi,
        kruAmt: kruAmtStr,
        amt1: amt1 || '-',
        amt2: amt2 || '-',
        diinputOleh: h.user ? h.user.name : '-',
        jabatan: h.user ? (h.user.jabatan || '-') : '-',
        tipe: tipeStr,
        shift: shiftStr,
        statusKondisi: statusKondisi,
        statusOperasional: h.status || (hasIssue ? 'Perlu Perbaikan' : 'Siap Operasi (Normal)'),
        lokasi: lokasiStr,
        notes: unifiedNotes,
        komponen: komponenStr,
        kategori: kategoriStr,
        detailKerusakan: badItems.map(i => i.description || '-').join(', ') || '-',
        statusFollowUp: statusFollowUp,
        diverifikasiOleh: diverifikasiOleh,
        waktuVerifikasi: waktuVerifikasi
      });

      row.height = 22;
      row.getCell('id').font = { size: 9 };
      row.getCell('tanggal').alignment = { horizontal: 'center' };
      row.getCell('noPolisi').alignment = { horizontal: 'center' };
      row.getCell('noPolisi').font = { bold: true };
      row.getCell('shift').alignment = { horizontal: 'center' };
      row.getCell('statusKondisi').alignment = { horizontal: 'center' };
      row.getCell('statusFollowUp').alignment = { horizontal: 'center' };

      if (hasIssue) {
        row.getCell('statusKondisi').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
        row.getCell('statusKondisi').font = { bold: true, color: { argb: 'FF856404' } };
      } else {
        row.getCell('statusKondisi').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
        row.getCell('statusKondisi').font = { bold: true, color: { argb: 'FF155724' } };
      }
    });

    if (handovers.length === 0) {
      const emptyRow = reportSheet.addRow({
        id: '-',
        tanggal: '-',
        noPolisi: '-',
        kruAmt: '-',
        amt1: '-',
        amt2: '-',
        diinputOleh: '-',
        jabatan: '-',
        tipe: '-',
        shift: '-',
        statusKondisi: '-',
        statusOperasional: 'Tidak ada data serah terima yang sesuai dengan kriteria filter',
        lokasi: '-',
        notes: '-',
        komponen: '-',
        kategori: '-',
        detailKerusakan: '-',
        statusFollowUp: '-',
        diverifikasiOleh: '-',
        waktuVerifikasi: '-'
      });
      emptyRow.height = 24;
    }

    // ============================================
    // SHEET 2: Detail Temuan & Perbaikan
    // ============================================
    const detailSheet = workbook.addWorksheet('Detail Temuan & Perbaikan');
    detailSheet.mergeCells('A1:P2');
    const titleCell2 = detailSheet.getCell('A1');
    titleCell2.value = 'DIGIHANDOVER – PERTAMINA PATRA NIAGA\nDETAIL TEMUAN KERUSAKAN, CATATAN PERBAIKAN & STATUS VERIFIKASI';
    titleCell2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    titleCell2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    detailSheet.getRow(1).height = 24;
    detailSheet.getRow(2).height = 24;

    detailSheet.addRow([]);
    detailSheet.getRow(4).values = [
      'Handover ID', 'Tanggal & Waktu', 'No. Polisi', 'Kru AMT', 'Diinput Oleh',
      'Jabatan', 'Shift', 'Komponen / Area', 'Kategori Severity', 'Detail Temuan',
      'Catatan Perbaikan', 'Status Perbaikan', 'Tindakan Lanjutan', 'Status Follow Up',
      'Diverifikasi Oleh', 'Waktu Verifikasi'
    ];

    detailSheet.columns = [
      { key: 'handoverId', width: 28 },
      { key: 'waktu', width: 18 },
      { key: 'nopol', width: 16 },
      { key: 'amt', width: 28 },
      { key: 'diinputOleh', width: 22 },
      { key: 'jabatan', width: 20 },
      { key: 'shift', width: 12 },
      { key: 'komponen', width: 26 },
      { key: 'kategori', width: 18 },
      { key: 'detail', width: 35 },
      { key: 'repairNote', width: 30 },
      { key: 'isRepaired', width: 20 },
      { key: 'tindakan', width: 25 },
      { key: 'status', width: 16 },
      { key: 'diverifikasiOleh', width: 20 },
      { key: 'waktuVerifikasi', width: 20 }
    ];

    const headerRow2 = detailSheet.getRow(4);
    headerRow2.height = 28;
    headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004080' } };
    headerRow2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    if (detailTemuanData.length > 0) {
      detailTemuanData.forEach(dt => {
        const r = detailSheet.addRow(dt);
        r.height = 22;
        r.getCell('nopol').font = { bold: true };
        r.getCell('kategori').alignment = { horizontal: 'center' };
        r.getCell('status').alignment = { horizontal: 'center' };
        if (dt.kategori === 'Major') {
          r.getCell('kategori').font = { bold: true, color: { argb: 'FFC0392B' } };
        }
      });
    } else {
      const emptyRow = detailSheet.addRow({
        handoverId: '-',
        waktu: '-',
        nopol: '-',
        amt: '-',
        diinputOleh: '-',
        jabatan: '-',
        shift: '-',
        komponen: 'Semua Komponen Normal',
        kategori: 'Normal',
        detail: 'Tidak ada temuan kerusakan pada kendaraan yang diperiksa.',
        repairNote: '-',
        isRepaired: '-',
        tindakan: 'Operasional Berjalan Lancar',
        status: 'Closed',
        diverifikasiOleh: '-',
        waktuVerifikasi: '-'
      });
      emptyRow.height = 22;
    }

    // ============================================
    // SHEET TAMBAHAN JIKA SINGLE HANDOVER: Checklist Unit
    // ============================================
    if (isSingle && allChecklistItemsData.length > 0) {
      const checklistSheet = workbook.addWorksheet('Rincian Checklist Unit');
      checklistSheet.mergeCells('A1:H2');
      const titleCellCheck = checklistSheet.getCell('A1');
      titleCellCheck.value = `DIGIHANDOVER – DAFTAR LENGKAP CHECKLIST INSPEKSI\nUnit No. Polisi: ${handovers[0].noPolisi} | No. Dokumen: ${getHandoverCode(handovers[0], handoverNoMap, 1)}`;
      titleCellCheck.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      titleCellCheck.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
      titleCellCheck.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      checklistSheet.getRow(1).height = 24;
      checklistSheet.getRow(2).height = 24;

      checklistSheet.addRow([]);
      checklistSheet.getRow(4).values = [
        'No', 'Handover ID', 'No. Polisi', 'Kategori', 'Item Pemeriksaan',
        'Kondisi', 'Severity', 'Catatan / Catatan Perbaikan'
      ];
      checklistSheet.columns = [
        { key: 'no', width: 8 },
        { key: 'handoverId', width: 28 },
        { key: 'nopol', width: 16 },
        { key: 'kategori', width: 28 },
        { key: 'namaItem', width: 35 },
        { key: 'kondisi', width: 18 },
        { key: 'severity', width: 16 },
        { key: 'catatan', width: 35 }
      ];

      const headerRowCheck = checklistSheet.getRow(4);
      headerRowCheck.height = 26;
      headerRowCheck.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRowCheck.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004080' } };
      headerRowCheck.alignment = { vertical: 'middle', horizontal: 'center' };

      allChecklistItemsData.forEach(itemRow => {
        const r = checklistSheet.addRow(itemRow);
        r.height = 20;
        r.getCell('no').alignment = { horizontal: 'center' };
        r.getCell('nopol').alignment = { horizontal: 'center' };
        r.getCell('kondisi').alignment = { horizontal: 'center' };
        r.getCell('severity').alignment = { horizontal: 'center' };

        if (itemRow.kondisi !== 'Baik / Normal') {
          r.getCell('kondisi').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
          r.getCell('kondisi').font = { bold: true, color: { argb: 'FF721C24' } };
        } else {
          r.getCell('kondisi').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
          r.getCell('kondisi').font = { bold: true, color: { argb: 'FF155724' } };
        }
      });
    }

    // ============================================
    // SHEET 3: Rekap & Statistik
    // ============================================
    const summarySheet = workbook.addWorksheet('Rekap & Statistik');
    summarySheet.mergeCells('A1:D2');
    const titleCell3 = summarySheet.getCell('A1');
    titleCell3.value = 'DIGIHANDOVER – RINGKASAN & STATISTIK HANDOVER';
    titleCell3.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    titleCell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    titleCell3.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    summarySheet.getRow(1).height = 24;
    summarySheet.getRow(2).height = 24;

    summarySheet.columns = [
      { key: 'label', width: 35 },
      { key: 'value', width: 22 },
      { key: 'unit', width: 14 },
      { key: 'note', width: 50 }
    ];

    summarySheet.addRow([]);
    summarySheet.getRow(4).values = ['Indikator / Metrik', 'Nilai', 'Satuan', 'Keterangan'];
    const summaryHeader = summarySheet.getRow(4);
    summaryHeader.height = 26;
    summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004080' } };

    const summaryRows = [
      { label: 'Total Handover Diperiksa', value: totalHandover, unit: 'Unit', note: 'Total proses serah terima tercatat pada sistem' },
      { label: 'Kendaraan Kondisi Normal', value: totalHandover - kendaraanAdaTemuan, unit: 'Unit', note: 'Kendaraan siap operasi tanpa catatan isu' },
      { label: 'Kendaraan Ada Temuan', value: kendaraanAdaTemuan, unit: 'Unit', note: 'Kendaraan dengan catatan temuan kendala checklist' },
      { label: 'Temuan Kategori Major', value: temuanMajor, unit: 'Temuan', note: 'Perlu penanganan kritis / perbaikan segera' },
      { label: 'Temuan Kategori Minor', value: temuanMinor, unit: 'Temuan', note: 'Temuan ringan yang masih dapat ditindaklanjuti' },
      { label: 'Status Follow Up Open', value: followUpOpen, unit: 'Isu', note: 'Temuan belum diselesaikan / diverifikasi' },
      { label: 'Status Follow Up Closed', value: followUpClosed, unit: 'Isu', note: 'Temuan telah diperbaiki & diverifikasi' },
      { label: 'Waktu Cetak Dokumen', value: formatDate(new Date()), unit: 'WIB', note: 'Waktu berkas diekspor dari sistem' },
      { label: 'Petugas Pengekspor', value: req.user ? req.user.name : '-', unit: 'Akun', note: `Role: ${req.user ? req.user.role : '-'}` }
    ];

    summaryRows.forEach(sr => {
      const r = summarySheet.addRow(sr);
      r.height = 20;
      r.getCell('label').font = { bold: true };
      r.getCell('value').alignment = { horizontal: 'center' };
      r.getCell('value').font = { bold: true };
      r.getCell('unit').alignment = { horizontal: 'center' };
    });

    let downloadFilename = 'Laporan_Handover_Pertamina.xlsx';
    if (isSingle) {
      downloadFilename = `Handover_${handovers[0]?.noPolisi || 'Report'}_${getHandoverCode(handovers[0], handoverNoMap, 1)}.xlsx`;
    } else {
      let parts = [];
      if (status && status !== 'Semua') parts.push(status);
      if (shift && shift !== 'Semua') parts.push(shift.replace(/\s/g, ''));
      if (month && month !== 'Semua') parts.push(month);
      if (year && year !== 'Semua') parts.push(year);
      if (startDate && endDate) parts.push(`${startDate}_${endDate}`);
      if (searchQuery) parts.push(`Search_${searchQuery}`);
      if (parts.length > 0) {
        downloadFilename = `Laporan_Handover_${parts.join('_')}.xlsx`;
      } else {
        downloadFilename = `Laporan_Handover_Pertamina_${new Date().toISOString().slice(0, 10)}.xlsx`;
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);

    if (req.user && req.user.id) {
      await prisma.auditLog.create({
        data: {
          action: 'EXPORT_EXCEL',
          userId: req.user.id,
          details: `User exported handover reports to Excel (${isSingle ? `ID: ${handovers[0]?.id}` : `${handovers.length} records`})`
        }
      });
    }

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exportExcel:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * ============================================================================
 * EXPORT PDF CONTROLLER
 * Menghasilkan berkas .pdf landscape A4 berstandar Pertamina dengan kelengkapan:
 * (ID Handover, Tanggal & Waktu, No. Polisi, Kru AMT 1 & 2, Jabatan, Catatan, dsb.)
 * ============================================================================
 */
const exportPdf = async (req, res) => {
  try {
    const { status, shift, month, year, startDate, endDate, handoverId, id, search, q } = req.query;

    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Akses ditolak: Hanya Admin yang dapat mengekspor laporan' });
    }

    let where = {};
    if (!where.AND) where.AND = [];
    
    const targetId = handoverId || id;
    if (targetId) {
      where.id = targetId;
    }

    if (status && status !== 'Semua') {
      if (status === 'Normal') {
        where.status = 'Siap Operasi (Normal)';
      } else if (status === 'Isu') {
        where.status = { not: 'Siap Operasi (Normal)' };
      } else {
        where.status = status;
      }
    }
    
    if (shift && shift !== 'Semua') {
      where.shift = shift;
    }

    let dateFilters = [];
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilters.push({ timestamp: { gte: start, lte: end } });
    }

    const monthList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    if (year && year !== 'Semua') {
      const yearInt = parseInt(year);
      if (month && month !== 'Semua') {
        const monthIndex = monthList.indexOf(month);
        if (monthIndex !== -1) {
          const startMonth = new Date(yearInt, monthIndex, 1);
          const endMonth = new Date(yearInt, monthIndex + 1, 0, 23, 59, 59, 999);
          dateFilters.push({ timestamp: { gte: startMonth, lte: endMonth } });
        }
      } else {
        const startYear = new Date(yearInt, 0, 1);
        const endYear = new Date(yearInt, 11, 31, 23, 59, 59, 999);
        dateFilters.push({ timestamp: { gte: startYear, lte: endYear } });
      }
    } else if (month && month !== 'Semua') {
      const monthIndex = monthList.indexOf(month);
      if (monthIndex !== -1) {
        const monthOrs = [];
        const currentYear = new Date().getFullYear();
        for (let y = 2020; y <= currentYear + 5; y++) {
          const startMonth = new Date(y, monthIndex, 1);
          const endMonth = new Date(y, monthIndex + 1, 0, 23, 59, 59, 999);
          monthOrs.push({ timestamp: { gte: startMonth, lte: endMonth } });
        }
        dateFilters.push({ OR: monthOrs });
      }
    }

    if (dateFilters.length > 0) {
      where.AND.push(...dateFilters);
    }

    if (!where.status) {
      where.status = { not: 'NOT_STARTED' };
    }

    if (where.AND && where.AND.length === 0) {
      delete where.AND;
    }

    let handovers = await prisma.handover.findMany({
      where: where,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { id: true, name: true, jabatan: true, role: true } },
        items: true,
        issue: true
      }
    });

    const searchQuery = (search || q || '').trim().toLowerCase();
    if (searchQuery) {
      handovers = handovers.filter(item => {
        const dateStr = new Date(item.timestamp).toLocaleString('id-ID');
        return (
          (item.noPolisi && item.noPolisi.toLowerCase().includes(searchQuery)) ||
          (item.user && item.user.name && item.user.name.toLowerCase().includes(searchQuery)) ||
          (item.amt1 && item.amt1.toLowerCase().includes(searchQuery)) ||
          (item.amt2 && item.amt2.toLowerCase().includes(searchQuery)) ||
          dateStr.toLowerCase().includes(searchQuery)
        );
      });
    }

    let handoverNoMap = new Map();
    try {
      const rawCodes = await prisma.$queryRaw`SELECT id, handoverNo FROM handover WHERE handoverNo IS NOT NULL`;
      handoverNoMap = new Map(rawCodes.map(r => [r.id, r.handoverNo]));
    } catch (e) {
      console.warn('Could not load handoverNo mapping in exportPdf:', e.message);
    }

    const isSingle = handovers.length === 1 && !!targetId;
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

    let downloadFilename = 'Laporan_Handover_Pertamina.pdf';
    if (isSingle) {
      downloadFilename = `Handover_${handovers[0]?.noPolisi || 'Report'}_${getHandoverCode(handovers[0], handoverNoMap, 1)}.pdf`;
    } else {
      let parts = [];
      if (status && status !== 'Semua') parts.push(status);
      if (shift && shift !== 'Semua') parts.push(shift.replace(/\s/g, ''));
      if (month && month !== 'Semua') parts.push(month);
      if (year && year !== 'Semua') parts.push(year);
      if (startDate && endDate) parts.push(`${startDate}_${endDate}`);
      if (searchQuery) parts.push(`Search_${searchQuery}`);
      if (parts.length > 0) {
        downloadFilename = `Laporan_Handover_${parts.join('_')}.pdf`;
      } else {
        downloadFilename = `Laporan_Handover_Pertamina_${new Date().toISOString().slice(0, 10)}.pdf`;
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    doc.pipe(res);

    // Decorative Pertamina tricolor top band
    const drawTopBar = () => {
      doc.rect(0, 0, doc.page.width, 10).fill('#002060'); // Dark Navy
      doc.rect(0, 10, doc.page.width, 3).fill('#ED1C24'); // Pertamina Red
      doc.rect(0, 13, doc.page.width, 3).fill('#00A651'); // Pertamina Green
      doc.y = 40;
    };

    // Calculate stats
    let totalHandover = handovers.length;
    let adaTemuan = 0;
    let temuanMajor = 0;
    let followUpOpen = 0;
    let followUpClosed = 0;

    handovers.forEach(h => {
      const badItems = h.items ? h.items.filter(i => !i.isGood) : [];
      if (badItems.length > 0) {
        adaTemuan++;
        if (badItems.some(i => i.name.includes('[MAJOR]'))) {
          temuanMajor++;
        }
        if (h.issue && h.issue.status === 'RESOLVED') {
          followUpClosed++;
        } else {
          followUpOpen++;
        }
      }
    });

    // ============================================
    // PAGE 1: RINGKASAN & IKHTISAR
    // ============================================
    drawTopBar();
    doc.fillColor('#002060').font('Helvetica-Bold').fontSize(22).text('PERTAMINA PATRA NIAGA', 30, 42);
    doc.fillColor('#004080').font('Helvetica-Bold').fontSize(12).text('DIGIHANDOVER – LAPORAN RESMI SERAH TERIMA KENDARAAN', 30, 68);
    doc.fillColor('gray').font('Helvetica').fontSize(9).text('Fuel Terminal Maos • Sistem Handover & Checklist Inspeksi Digital Terintegrasi', 30, 84);
    doc.moveDown(1.5);

    let filterPartsPdf = [];
    if (status && status !== 'Semua') filterPartsPdf.push(`Status: ${status}`);
    if (shift && shift !== 'Semua') filterPartsPdf.push(`Shift: ${shift}`);
    if (month && month !== 'Semua') filterPartsPdf.push(`Bulan: ${month}`);
    if (year && year !== 'Semua') filterPartsPdf.push(`Tahun: ${year}`);
    if (startDate && endDate) filterPartsPdf.push(`Periode: ${startDate} s.d. ${endDate}`);
    if (searchQuery) filterPartsPdf.push(`Pencarian: ${searchQuery}`);
    
    let periodStr = filterPartsPdf.length > 0 ? filterPartsPdf.join(' | ') : 'Semua Data';
    periodStr += ` (Total: ${totalHandover} Data)`;

    if (isSingle && handovers[0]) {
      periodStr = `${formatDateIndo(handovers[0].timestamp)} (Total: 1 Data)`;
    }

    const tableHeader = {
      headers: [
        { label: "PERIODE LAPORAN", property: 'periode', width: 250 },
        { label: "LOKASI OPERASIONAL", property: 'lokasi', width: 250 },
        { label: "STATUS VALIDASI", property: 'status', width: 250 }
      ],
      datas: [
        {
          periode: periodStr,
          lokasi: 'Fuel Terminal Maos',
          status: 'Digital Verified • Sistem Terintegrasi'
        }
      ]
    };

    await doc.table(tableHeader, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('#002060'),
      prepareRow: () => doc.font("Helvetica").fontSize(9).fillColor('black'),
    });

    doc.moveDown(1.2);

    // Jika Single Handover: Tampilkan Kartu Identitas Khusus Unit
    if (isSingle && handovers[0]) {
      const hSingle = handovers[0];
      const singleBoxY = doc.y;
      doc.rect(30, singleBoxY, 750, 75).fill('#f8fafc');
      doc.rect(30, singleBoxY, 5, 75).fill('#002060');

      doc.fillColor('#002060').font('Helvetica-Bold').fontSize(11).text('IDENTITAS SERAH TERIMA KENDARAAN (HANDOVER DETAIL)', 45, singleBoxY + 10);
      
      const col1X = 45;
      const col2X = 280;
      const col3X = 520;
      const line1Y = singleBoxY + 28;
      const line2Y = singleBoxY + 44;
      const line3Y = singleBoxY + 58;

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#333333');
      doc.text(`ID Handover: `, col1X, line1Y, { continued: true }).font('Helvetica').text(getHandoverCode(hSingle, handoverNoMap, 1));
      doc.font('Helvetica-Bold').text(`No. Polisi: `, col1X, line2Y, { continued: true }).font('Helvetica').text(hSingle.noPolisi);
      doc.font('Helvetica-Bold').text(`Tanggal: `, col1X, line3Y, { continued: true }).font('Helvetica').text(formatDate(hSingle.timestamp));

      doc.font('Helvetica-Bold').text(`Kru AMT 1: `, col2X, line1Y, { continued: true }).font('Helvetica').text(hSingle.amt1 || '-');
      doc.font('Helvetica-Bold').text(`Kru AMT 2: `, col2X, line2Y, { continued: true }).font('Helvetica').text(hSingle.amt2 || '-');
      doc.font('Helvetica-Bold').text(`Diinput Oleh: `, col2X, line3Y, { continued: true }).font('Helvetica').text(`${hSingle.user?.name || '-'} (${hSingle.user?.jabatan || '-'})`);

      doc.font('Helvetica-Bold').text(`Tipe / Shift: `, col3X, line1Y, { continued: true }).font('Helvetica').text(`${hSingle.type === 'mulai' ? 'Mulai' : 'Akhiri'} • ${hSingle.shift || '-'}`);
      doc.font('Helvetica-Bold').text(`Status Unit: `, col3X, line2Y, { continued: true }).font('Helvetica').text(hSingle.status || (adaTemuan > 0 ? 'Ada Temuan' : 'Normal'));
      doc.font('Helvetica-Bold').text(`Catatan: `, col3X, line3Y, { continued: true }).font('Helvetica').text((hSingle.notes || '-').substring(0, 35));

      doc.y = singleBoxY + 75 + 15;
    }

    doc.fillColor('#002060').font('Helvetica-Bold').fontSize(14).text('Ringkasan Eksekutif Handover', 30, doc.y);
    doc.moveDown(0.8);

    const boxY = doc.y;
    const boxW = 180;
    const boxH = 55;

    const boxes = [
      { title: 'TOTAL HANDOVER', value: `${totalHandover} Unit`, color: '#0055A5', bg: '#f0f8ff' },
      { title: 'KONDISI NORMAL', value: `${totalHandover - adaTemuan} Unit`, color: '#00A651', bg: '#e8f8f5' },
      { title: 'ADA TEMUAN', value: `${adaTemuan} Unit`, color: '#E67E22', bg: '#fef5e7' },
      { title: 'TEMUAN MAJOR', value: `${temuanMajor} Isu`, color: '#C0392B', bg: '#fdedec' }
    ];

    boxes.forEach((box, i) => {
      const bx = 30 + (boxW + 15) * i;
      doc.rect(bx, boxY, boxW, boxH).fill(box.bg);
      doc.rect(bx, boxY, 5, boxH).fill(box.color);
      doc.fillColor(box.color).font('Helvetica-Bold').fontSize(18).text(box.value, bx + 15, boxY + 12);
      doc.fillColor('#555555').font('Helvetica-Bold').fontSize(8).text(box.title, bx + 15, boxY + 36);
    });

    doc.y = boxY + boxH + 20;

    const tableIkhtisar = {
      headers: [
        { label: "INDIKATOR OPERASIONAL", property: 'indikator', width: 250 },
        { label: "JUMLAH", property: 'jumlah', width: 100 },
        { label: "PROPORSI", property: 'proporsi', width: 100 },
        { label: "KETERANGAN", property: 'keterangan', width: 300 }
      ],
      datas: [
        {
          indikator: 'Handover Siap Operasi (Normal)',
          jumlah: (totalHandover - adaTemuan).toString(),
          proporsi: totalHandover ? Math.round(((totalHandover - adaTemuan) / totalHandover) * 100) + '%' : '0%',
          keterangan: 'Kendaraan laik operasi tanpa kendala checklist'
        },
        {
          indikator: 'Kendaraan Dengan Temuan',
          jumlah: adaTemuan.toString(),
          proporsi: totalHandover ? Math.round((adaTemuan / totalHandover) * 100) + '%' : '0%',
          keterangan: 'Terdapat catatan kendala pada komponen checklist'
        },
        {
          indikator: 'Temuan Selesai (Closed)',
          jumlah: followUpClosed.toString(),
          proporsi: adaTemuan ? Math.round((followUpClosed / adaTemuan) * 100) + '%' : '0%',
          keterangan: 'Isu telah diperbaiki dan diverifikasi oleh pengawas'
        },
        {
          indikator: 'Temuan Menunggu (Open)',
          jumlah: followUpOpen.toString(),
          proporsi: adaTemuan ? Math.round((followUpOpen / adaTemuan) * 100) + '%' : '0%',
          keterangan: 'Perlu tindak lanjut perbaikan teknisi / pengawas'
        }
      ]
    };

    await doc.table(tableIkhtisar, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('#002060'),
      prepareRow: () => doc.font("Helvetica").fontSize(8.5).fillColor('black'),
    });

    doc.moveDown(1);
    const catY = doc.y;
    doc.rect(30, catY, 750, 32).fill('#f0f8ff');
    doc.rect(30, catY, 4, 32).fill('#0055A5');
    doc.fillColor('black').font('Helvetica-Bold').fontSize(8.5).text('Catatan Sistem: ', 45, catY + 10, { continued: true });
    doc.font('Helvetica').text('Laporan resmi ini merangkum seluruh siklus serah terima mobil tangki, personil kru AMT, jabatan, nomor polisi unit, serta status verifikasi dan tindak lanjut perbaikan.');

    // ============================================
    // PAGE 2: DAFTAR HANDOVER & VERIFIKASI
    // ============================================
    doc.addPage();
    drawTopBar();
    doc.fontSize(16).fillColor('#002060').font('Helvetica-Bold').text('Daftar Handover Kendaraan', 30, 42);
    doc.fontSize(8.5).fillColor('gray').font('Helvetica').text('Rekaman utama proses serah terima unit, kru AMT, jabatan pelapor, nomor polisi, dan status kelayakan operasional.');
    doc.moveDown(1);

    const table1 = {
      headers: [
        { label: "ID HANDOVER", property: 'id', width: 95 },
        { label: "TANGGAL", property: 'waktu', width: 75 },
        { label: "NO. POLISI", property: 'nopol', width: 65 },
        { label: "KRU AMT", property: 'amt', width: 100 },
        { label: "PELAPOR & JABATAN", property: 'pelapor', width: 95 },
        { label: "TIPE / SHIFT", property: 'tipe', width: 65 },
        { label: "KONDISI", property: 'kondisi', width: 65 },
        { label: "CATATAN / TEMUAN", property: 'catatan', width: 120 },
        { label: "STATUS", property: 'status', width: 70 }
      ],
      datas: []
    };

    const table2 = {
      headers: [
        { label: "ID HANDOVER", property: 'id', width: 110 },
        { label: "NO. POLISI", property: 'nopol', width: 70 },
        { label: "TANGGAL", property: 'waktu', width: 80 },
        { label: "KRU AMT & JABATAN", property: 'petugas', width: 150 },
        { label: "STATUS DOKUMEN", property: 'status', width: 100 },
        { label: "DIVERIFIKASI OLEH", property: 'admin', width: 120 },
        { label: "WAKTU VERIFIKASI", property: 'waktuVerif', width: 120 }
      ],
      datas: []
    };

    const table3 = {
      headers: [
        { label: "ID HANDOVER", property: 'id', width: 85 },
        { label: "NO. POLISI", property: 'nopol', width: 65 },
        { label: "TANGGAL", property: 'waktu', width: 70 },
        { label: "KRU AMT", property: 'amt', width: 85 },
        { label: "JABATAN", property: 'jabatan', width: 70 },
        { label: "KOMPONEN", property: 'area', width: 80 },
        { label: "SEVERITY", property: 'severity', width: 50 },
        { label: "DESKRIPSI & PERBAIKAN", property: 'desc', width: 125 },
        { label: "TINDAKAN", property: 'tindakan', width: 70 },
        { label: "STATUS", property: 'status', width: 50 }
      ],
      datas: []
    };

    handovers.forEach((h, hIdx) => {
      const isMulai = h.type === 'mulai';
      const typeStr = isMulai ? 'Mulai' : 'Akhiri';
      const badItems = h.items ? h.items.filter(i => !i.isGood) : [];
      const isNormal = badItems.length === 0;

      const amtDisplay = formatAmtCrewPdf(h);
      const pelaporDisplay = `${h.user?.name || '-'}\n(${h.user?.jabatan || '-'})`;

      const legacyPhotoNote = h.items?.find(it => it.name && it.name.startsWith('Catatan Foto:'))?.name?.replace('Catatan Foto:', '').trim();
      const unifiedNotes = (h.notes && h.notes.trim()) || legacyPhotoNote;

      const temuanParts = [];
      if (badItems.length > 0) {
        temuanParts.push(badItems.map(i => i.name.replace(/\[MAJOR\]|\[MINOR\]/g, '').trim()).join(', '));
      }
      if (unifiedNotes) {
        temuanParts.push(`Catatan: ${unifiedNotes}`);
      }
      const catatanStr = temuanParts.length > 0 ? temuanParts.join('\n') : 'Semua item checklist normal';

      let followUpStr = 'Normal';
      if (!isNormal) {
        followUpStr = (h.issue && h.issue.status === 'RESOLVED') ? 'Closed' : 'Open';
      }

      table1.datas.push({
        id: getHandoverCode(h, handoverNoMap, hIdx + 1),
        waktu: formatDateShort(h.timestamp),
        nopol: h.noPolisi,
        amt: amtDisplay,
        pelapor: pelaporDisplay,
        tipe: `${typeStr}\n${h.shift || '-'}`,
        kondisi: isNormal ? 'Normal' : 'Ada Temuan',
        catatan: catatanStr,
        status: followUpStr
      });

      const verifiedBy = h.issue && h.issue.resolvedBy ? h.issue.resolvedBy : (isNormal ? 'Sistem' : 'Pengawas');
      const verifiedTime = h.issue && h.issue.resolvedAt
        ? formatDate(h.issue.resolvedAt)
        : (isNormal ? '-' : formatDate(h.timestamp));

      table2.datas.push({
        id: getHandoverCode(h, handoverNoMap, hIdx + 1),
        nopol: h.noPolisi,
        waktu: formatDate(h.timestamp),
        petugas: `${formatAmtCrew(h)}\n(${h.user?.jabatan || '-'})`,
        status: isNormal
          ? 'Siap Operasi'
          : (h.issue && h.issue.status === 'RESOLVED' ? 'Selesai Verifikasi' : 'Perlu Perbaikan'),
        admin: verifiedBy,
        waktuVerif: verifiedTime
      });

      if (!isNormal) {
        badItems.forEach(item => {
          const isItemMajor = item.name.includes('[MAJOR]');
          const itemName = item.name.replace(/\[MAJOR\]|\[MINOR\]/g, '').trim();
          const descText = `${item.description || `Catatan kondisi ${itemName.toLowerCase()}`}${item.repairNote ? `\n[Perbaikan]: ${item.repairNote}` : ''}`;
          table3.datas.push({
            id: getHandoverCode(h, handoverNoMap, hIdx + 1),
            nopol: h.noPolisi,
            waktu: formatDateShort(h.timestamp),
            amt: h.amt1 || h.user?.name || '-',
            jabatan: h.user?.jabatan || '-',
            area: itemName,
            severity: isItemMajor ? 'Major' : 'Minor',
            desc: descText,
            tindakan: item.isRepaired
              ? 'Selesai Diperbaiki'
              : (h.issue && h.issue.status === 'RESOLVED' ? 'Telah diverifikasi' : 'Perlu Perbaikan'),
            status: (h.issue && h.issue.status === 'RESOLVED') || item.isRepaired ? 'Closed' : 'Open'
          });
        });
      }
    });

    if (table1.datas.length === 0) {
      table1.datas.push({
        id: '-',
        waktu: '-',
        nopol: '-',
        amt: '-',
        pelapor: '-',
        tipe: '-',
        kondisi: '-',
        catatan: 'Tidak ada data serah terima yang sesuai dengan filter',
        status: '-'
      });
      table2.datas.push({
        id: '-',
        nopol: '-',
        waktu: '-',
        petugas: '-',
        status: '-',
        admin: '-',
        waktuVerif: '-'
      });
    }

    await doc.table(table1, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#002060'),
      prepareRow: () => doc.font("Helvetica").fontSize(7).fillColor('black'),
    });

    doc.moveDown(1.5);
    doc.fontSize(14).fillColor('#002060').font('Helvetica-Bold').text('Verifikasi & Validasi Digital');
    doc.moveDown(0.8);

    await doc.table(table2, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#002060'),
      prepareRow: () => doc.font("Helvetica").fontSize(7).fillColor('black'),
    });

    // ============================================
    // PAGE 3: DETAIL TEMUAN & STATUS PERBAIKAN
    // ============================================
    doc.addPage();
    drawTopBar();
    doc.fontSize(16).fillColor('#002060').font('Helvetica-Bold').text('Detail Temuan & Status Perbaikan', 30, 42);
    doc.fontSize(8.5).fillColor('gray').font('Helvetica').text('Rincian temuan kerusakan teknis, catatan perbaikan kru AMT, dan status verifikasi pengawas.');
    doc.moveDown(1);

    if (table3.datas.length === 0) {
      table3.datas.push({
        id: '-',
        nopol: '-',
        waktu: '-',
        amt: '-',
        jabatan: '-',
        area: 'Semua Komponen Normal',
        severity: 'Normal',
        desc: 'Tidak ada temuan kendala teknis pada unit kendaraan yang diperiksa',
        tindakan: 'Siap Operasi',
        status: 'Closed'
      });
    }

    await doc.table(table3, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#002060'),
      prepareRow: () => doc.font("Helvetica").fontSize(7).fillColor('black'),
    });

    // JIKA SINGLE HANDOVER: Tampilkan Tabel Checklist Lengkap Unit
    if (isSingle && handovers[0]?.items && handovers[0].items.length > 0) {
      doc.moveDown(1.2);
      doc.fontSize(13).fillColor('#002060').font('Helvetica-Bold').text('Daftar Pemeriksaan Checklist Inspeksi Unit');
      doc.moveDown(0.6);

      const filteredChecklistItems = handovers[0].items.filter(item => !item.name?.startsWith('Catatan Foto:'));

      const tableChecklistSingle = {
        headers: [
          { label: "NO", property: 'no', width: 30 },
          { label: "KATEGORI", property: 'kategori', width: 140 },
          { label: "ITEM PEMERIKSAAN", property: 'item', width: 220 },
          { label: "KONDISI", property: 'kondisi', width: 80 },
          { label: "SEVERITY", property: 'severity', width: 60 },
          { label: "CATATAN / PERBAIKAN", property: 'catatan', width: 220 }
        ],
        datas: filteredChecklistItems.map((item, idx) => {
          const isMajor = item.name.includes('[MAJOR]');
          const isMinor = item.name.includes('[MINOR]');
          const cleanName = item.name.replace(/\[MAJOR\]|\[MINOR\]/g, '').trim();
          let sev = 'Normal';
          if (isMajor) sev = 'Major';
          else if (isMinor) sev = 'Minor';

          let noteText = '-';
          if (item.repairNote) noteText = `[Perbaikan]: ${item.repairNote}`;
          else if (item.description) noteText = item.description;

          return {
            no: (idx + 1).toString(),
            kategori: getCategoryName(item.category),
            item: cleanName,
            kondisi: item.isGood ? 'Normal' : 'Temuan',
            severity: sev,
            catatan: noteText
          };
        })
      };

      await doc.table(tableChecklistSingle, {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(7.5).fillColor('#002060'),
        prepareRow: () => doc.font("Helvetica").fontSize(7).fillColor('black'),
      });
    }

    doc.moveDown(1.2);
    doc.fontSize(12).fillColor('#002060').font('Helvetica-Bold').text('Alur Tindak Lanjut & Validasi');
    doc.moveDown(0.8);

    const yPos = doc.y;
    const alurBoxW = 180;
    const alurBoxH = 50;
    const gap = 12;

    const steps = [
      { num: '01', title: 'INSPEKSI CHECKLIST', desc: 'Kondisi kendaraan & kelengkapan dicek kru AMT.' },
      { num: '02', title: 'PELAPORAN REALTIME', desc: 'Data tersinkron otomatis ke server & dasbor pengawas.' },
      { num: '03', title: 'PERBAIKAN & BUKTI', desc: 'Tindakan perbaikan diinput dengan foto bukti.' },
      { num: '04', title: 'VERIFIKASI PENGAWAS', desc: 'Pengawas memvalidasi kondisi unit siap operasi.' }
    ];

    steps.forEach((step, idx) => {
      const x = 30 + (alurBoxW + gap) * idx;
      doc.rect(x, yPos, alurBoxW, alurBoxH).stroke('#0055A5');
      doc.rect(x, yPos, 4, alurBoxH).fill('#0055A5');
      doc.fillColor('#002060').font('Helvetica-Bold').fontSize(12).text(step.num, x + 8, yPos + 8);
      doc.fontSize(7.5).text(step.title, x + 8, yPos + 22);
      doc.fillColor('gray').font('Helvetica').fontSize(6.5).text(step.desc, x + 8, yPos + 34, { width: 165 });
    });

    doc.y = yPos + alurBoxH + 20;

    const table4 = {
      headers: [
        { label: "PENGAWAS OPERASIONAL (HSSE/QQ)", property: 'diverifikasi', width: 375 },
        { label: "STATUS VALIDASI SISTEM", property: 'status', width: 375 }
      ],
      datas: [
        {
          diverifikasi: 'Pengawas / Supervisor FT Maos\n\n\n[TERVERIFIKASI SISTEM]',
          status: 'Dokumen Digital DigiHandover\nFuel Terminal Maos\n\n[TERVERIFIKASI SISTEM]'
        }
      ]
    };

    await doc.table(table4, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('#002060'),
      prepareRow: () => doc.font("Helvetica").fontSize(8).fillColor('black'),
    });

    if (req.user && req.user.id) {
      await prisma.auditLog.create({
        data: {
          action: 'EXPORT_PDF',
          userId: req.user.id,
          details: `User exported handover reports to PDF (${isSingle ? `ID: ${handovers[0]?.id}` : `${handovers.length} records`})`
        }
      });
    }

    doc.end();
  } catch (error) {
    console.error('Error exportPdf:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { exportExcel, exportPdf };
