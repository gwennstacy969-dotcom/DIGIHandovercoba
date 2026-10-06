const prisma = require('../config/prisma');
const { sendPushNotification } = require('../config/firebase');

async function sendNotification(handoverId, noPolisi, issueItems = [], isBlocked = false, type = 'NEW_ISSUE') {
  console.log(`[NOTIFICATION] Kendaraan: ${noPolisi}, Tipe: ${type}, Blocked: ${isBlocked}`);

  try {
    const isResolved = type === 'RESOLVED';
    let textBody = isResolved
      ? `Perbaikan pada kendaraan ${noPolisi} telah selesai dan kendaraan dapat beroperasi kembali.`
      : `Kendaraan ${noPolisi} dilaporkan memiliki beberapa isu:\n${issueItems.map(i => '- ' + i.name).join('\n')}\n\nStatus: ${isBlocked ? 'DIBLOKIR (Major)' : 'PERLU PERBAIKAN'}`;

    const notificationTitle = isResolved ? `Isu Selesai: ${noPolisi}` : (isBlocked ? `Kendaraan Diblokir: ${noPolisi}` : `Isu Baru: ${noPolisi}`);
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
    console.error('Gagal mengirim notifikasi:', error);
  }
}

module.exports = {
  sendNotification
};
