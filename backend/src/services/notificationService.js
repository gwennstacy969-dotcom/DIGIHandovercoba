const prisma = require('../config/prisma');
const { sendPushNotification } = require('../config/firebase');

// 1. Notifikasi Isu Kerusakan Kendaraan (Kategori A)
async function sendNotification(handoverId, noPolisi, issueItems = [], isBlocked = false, type = 'NEW_ISSUE') {
  console.log(`[NOTIFICATION VEHICLE] Kendaraan: ${noPolisi}, Tipe: ${type}, Blocked: ${isBlocked}`);

  try {
    const isResolved = type === 'RESOLVED';
    let textBody = isResolved
      ? `Perbaikan pada kendaraan ${noPolisi} telah selesai dan kendaraan dapat beroperasi kembali.`
      : `Kendaraan ${noPolisi} dilaporkan memiliki temuan isu kendaraan:\n${issueItems.map(i => '- ' + i.name).join('\n')}\n\nStatus: ${isBlocked ? 'MAINTENANCE (Kerusakan Major)' : 'PERLU PERBAIKAN (Minor)'}`;

    const notificationTitle = isResolved 
      ? `Isu Kendaraan Selesai: ${noPolisi}` 
      : (isBlocked ? `Kendaraan Perlu Perbaikan Segera: ${noPolisi}` : `Temuan Isu Kendaraan: ${noPolisi}`);
    const notificationType = isResolved ? 'SUCCESS' : (isBlocked ? 'ERROR' : 'WARNING');
    const actionType = isResolved ? 'VIEW_HANDOVER' : 'VIEW_ISSUE';

    let targetActionId = handoverId;
    if (actionType === 'VIEW_ISSUE') {
      const relatedIssue = await prisma.issue.findFirst({ where: { handoverId } });
      if (relatedIssue) targetActionId = relatedIssue.id;
    }

    await prisma.notification.createMany({
      data: [
        { title: notificationTitle, message: textBody, type: notificationType, targetRole: 'ADMIN', actionType, actionId: targetActionId, noPolisi },
        { title: notificationTitle, message: textBody, type: notificationType, targetRole: 'PENGAWAS', actionType, actionId: targetActionId, noPolisi }
      ]
    });

    // FCM Push Notifications
    const targetUsers = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'PENGAWAS'] },
        fcmToken: { not: null },
        deletedAt: null
      }
    });

    for (const u of targetUsers) {
      if (u.fcmToken) {
        await sendPushNotification(
          u.fcmToken,
          notificationTitle,
          textBody,
          { handoverId, noPolisi, type }
        );
      }
    }
  } catch (error) {
    console.error('Gagal mengirim notifikasi kendaraan:', error);
  }
}

// 2. Notifikasi Isu Perlengkapan / Kepatuhan AMT (Kategori B)
async function sendAmtComplianceNotification(handoverId, noPolisi, amtIssueItems = [], user = null, amtName = 'Petugas AMT') {
  console.log(`[NOTIFICATION AMT COMPLIANCE] AMT: ${amtName}, Kendaraan: ${noPolisi}, Items: ${amtIssueItems.length}`);

  try {
    const listItems = amtIssueItems.map(i => i.name).join(', ');
    const notificationTitle = `Temuan Kepatuhan AMT: ${amtName}`.slice(0, 190);
    const textBody = `Petugas ${amtName} (${noPolisi}) catatan kepatuhan belum lengkap: ${listItems}`.slice(0, 190);

    const notifData = [
      {
        title: notificationTitle,
        message: textBody,
        type: 'WARNING',
        targetRole: 'PENGAWAS',
        targetUserId: null,
        actionType: 'VIEW_AMT_ISSUE',
        actionId: handoverId,
        noPolisi
      },
      {
        title: notificationTitle,
        message: textBody,
        type: 'WARNING',
        targetRole: 'ADMIN',
        targetUserId: null,
        actionType: 'VIEW_AMT_ISSUE',
        actionId: handoverId,
        noPolisi
      }
    ];

    if (user && user.id) {
      notifData.push({
        title: `Peringatan Perlengkapan Kerja: ${amtName}`.slice(0, 190),
        message: `Catatan perlengkapan belum lengkap: ${listItems}`.slice(0, 190),
        type: 'WARNING',
        targetRole: 'USER',
        targetUserId: user.id,
        actionType: 'VIEW_AMT_ISSUE',
        actionId: handoverId,
        noPolisi
      });
    }

    await prisma.notification.createMany({
      data: notifData
    });

    // FCM Push ke AMT dan Pengawas
    const targetUserIds = [];
    if (user && user.id) targetUserIds.push(user.id);

    const fcmUsers = await prisma.user.findMany({
      where: {
        OR: [
          { role: { in: ['PENGAWAS', 'ADMIN'] } },
          { id: { in: targetUserIds } }
        ],
        fcmToken: { not: null },
        deletedAt: null
      }
    });

    for (const u of fcmUsers) {
      if (u.fcmToken) {
        await sendPushNotification(
          u.fcmToken,
          notificationTitle,
          textBody,
          { handoverId, noPolisi, type: 'AMT_COMPLIANCE' }
        );
      }
    }
  } catch (error) {
    console.error('Gagal mengirim notifikasi kepatuhan AMT:', error);
  }
}

module.exports = {
  sendNotification,
  sendAmtComplianceNotification
};
