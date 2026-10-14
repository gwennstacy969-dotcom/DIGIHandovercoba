const prisma = require('../src/config/prisma');
const { createId } = require('@paralleldrive/cuid2');
const CacheService = require('../src/utils/CacheService');

async function syncAccidentNotifications() {
  console.log('--- Sinkronisasi Notifikasi Insiden Kecelakaan B 9376 TFV ---');

  const crashTime = new Date('2026-09-28T10:09:15.000Z'); // 28 September 2026 17:09:15 WIB
  const handover = await prisma.handover.findFirst({
    where: { noPolisi: 'B9376TFV', status: 'Ada Masalah' },
    include: { issue: true }
  });

  if (!handover) {
    console.error('Handover kecelakaan B 9376 TFV tidak ditemukan!');
    process.exit(1);
  }

  const actionId = handover.id;

  // Hapus notifikasi kecelakaan lama B 9376 TFV agar bersih dan tidak duplikat
  const deleted = await prisma.notification.deleteMany({
    where: {
      OR: [
        { title: { contains: 'B 9376 TFV' } },
        { message: { contains: 'B 9376 TFV' } },
        { noPolisi: 'B9376TFV' }
      ]
    }
  });
  console.log(`Dihapus ${deleted.count} notifikasi lama terkait B 9376 TFV.`);

  const messageText = 'Truk Tangki BBM B 9376 TFV (Kapasitas 16 KL, Kru: Joni Febrianto & Hendrik Robiansyah) mengalami kecelakaan tabrakan lalu lintas dengan KBM Mobil Truk Molen pada 28 September 2026 pukul 17:09:15 WIB di Jalan Lingkar Negaradaha, Bumiayu, Brebes. Kerusakan fatal terutama pada SISTEM PENGEREMAN (RUSAK TOTAL & GAGAL FUNGSI), kabin kiri hancur terlipat, kompartemen tangki depan penyok, radiator bocor/pecah, dan ban depan kiri kempes. Status unit: DIBLOKIR / MAINTENANCE total.';

  // Cari user Joni dan Hendrik
  const joni = await prisma.user.findFirst({ where: { name: { contains: 'Joni Febrianto' } } });
  const hendrik = await prisma.user.findFirst({ where: { name: { contains: 'Hendrik Robiansyah' } } });

  const notifsToInsert = [
    // 1. Untuk SEMUA peran (ALL) agar siapa pun yang membuka Pesan melihat notifikasi ini
    {
      id: createId(),
      title: '🚨 KECELAKAAN: Truk B 9376 TFV Tabrakan dengan Truk Molen',
      message: messageText,
      type: 'ERROR',
      targetRole: 'ALL',
      targetUserId: null,
      createdAt: crashTime,
      actionType: 'VIEW_ISSUE',
      actionId: actionId,
      noPolisi: 'B9376TFV',
      isRead: false
    },
    // 2. Untuk ADMIN
    {
      id: createId(),
      title: '🚨 KECELAKAAN: Truk B 9376 TFV Tabrakan dengan Truk Molen',
      message: messageText,
      type: 'ERROR',
      targetRole: 'ADMIN',
      targetUserId: null,
      createdAt: crashTime,
      actionType: 'VIEW_ISSUE',
      actionId: actionId,
      noPolisi: 'B9376TFV',
      isRead: false
    },
    // 3. Untuk PENGAWAS
    {
      id: createId(),
      title: '🚨 KECELAKAAN: Truk B 9376 TFV Tabrakan dengan Truk Molen',
      message: messageText,
      type: 'ERROR',
      targetRole: 'PENGAWAS',
      targetUserId: null,
      createdAt: crashTime,
      actionType: 'VIEW_ISSUE',
      actionId: actionId,
      noPolisi: 'B9376TFV',
      isRead: false
    },
    // 4. Untuk AMT
    {
      id: createId(),
      title: '🚨 KECELAKAAN: Truk B 9376 TFV Tabrakan dengan Truk Molen',
      message: messageText,
      type: 'ERROR',
      targetRole: 'AMT',
      targetUserId: null,
      createdAt: crashTime,
      actionType: 'VIEW_ISSUE',
      actionId: actionId,
      noPolisi: 'B9376TFV',
      isRead: false
    }
  ];

  if (joni) {
    notifsToInsert.push({
      id: createId(),
      title: '🚨 LAPORAN KECELAKAAN: Unit B 9376 TFV',
      message: `Pemberitahuan resmi: Insiden tabrakan unit B 9376 TFV pada 28 September 2026 pukul 17:09 WIB telah tercatat dalam sistem. Kerusakan utama pada sistem pengereman, unit DIBLOKIR / Maintenance.`,
      type: 'ERROR',
      targetRole: 'AMT',
      targetUserId: joni.id,
      createdAt: crashTime,
      actionType: 'VIEW_ISSUE',
      actionId: actionId,
      noPolisi: 'B9376TFV',
      isRead: false
    });
  }

  if (hendrik) {
    notifsToInsert.push({
      id: createId(),
      title: '🚨 LAPORAN KECELAKAAN: Unit B 9376 TFV',
      message: `Pemberitahuan resmi: Insiden tabrakan unit B 9376 TFV pada 28 September 2026 pukul 17:09 WIB telah tercatat dalam sistem. Kerusakan utama pada sistem pengereman, unit DIBLOKIR / Maintenance.`,
      type: 'ERROR',
      targetRole: 'AMT',
      targetUserId: hendrik.id,
      createdAt: crashTime,
      actionType: 'VIEW_ISSUE',
      actionId: actionId,
      noPolisi: 'B9376TFV',
      isRead: false
    });
  }

  await prisma.notification.createMany({
    data: notifsToInsert
  });

  console.log(`✓ Berhasil menambahkan ${notifsToInsert.length} notifikasi kecelakaan dengan timestamp: ${crashTime.toISOString()} (28 September 2026 17:09:15 WIB).`);

  // Bersihkan cache
  try {
    await CacheService.delPattern('notifications:*');
    console.log('✓ Cache notifikasi dibersihkan.');
  } catch (e) {
    console.log('Cache skip:', e.message);
  }

  console.log('=== Selesai sinkronisasi notifikasi ===');
  process.exit(0);
}

syncAccidentNotifications().catch(err => {
  console.error(err);
  process.exit(1);
});
