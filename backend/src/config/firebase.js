const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized successfully.');
} else {
  console.warn('⚠️ Firebase Admin NOT initialized. serviceAccountKey.json is missing.');
  console.warn('Push notifications will be disabled.');
}

const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized, skipping notification send.');
    return false;
  }
  try {
    const payload = {
      token: fcmToken,
      notification: {
        title,
        body
      },
      data
    };
    await admin.messaging().send(payload);
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
};

module.exports = {
  admin,
  sendPushNotification
};
