const nodemailer = require('nodemailer');
const emailTemplates = require('./emailTemplates');
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const currentAdminEmail = process.env.ADMIN_EMAIL;

exports.sendPasswordResetNotification = async (adminEmail, user, reason, requestId) => {
  try {
    const targetEmail = adminEmail || currentAdminEmail;

    const html = emailTemplates.passwordResetNotification({
      adminName: 'Admin',
      userName: user.name,
      userEmail: user.username, // using username as email usually
      userPhone: user.jabatan || '-', 
      userRole: user.role,
      reason: reason,
      requestId: requestId
    });
    
    await transporter.sendMail({
      from: transporter.options.auth.user,
      to: targetEmail,
      subject: `🔔 Notifikasi: User ${user.name} Lupa Password`,
      html: html
    });
    
    await prisma.emailNotificationLog.create({
      data: {
        emailAddress: targetEmail,
        subject: `🔔 Notifikasi: User ${user.name} Lupa Password`,
        emailType: 'PASSWORD_RESET',
        emailStatus: 'SENT',
        sentAt: new Date()
      }
    });
    
    console.log(`✅ Password reset notification sent to ${targetEmail}`);
  } catch (error) {
    console.error('❌ Send notification error:', error);
  }
};

exports.sendPasswordResetCompletedEmail = async (userEmail, userName, newPassword) => {
  try {
    const html = emailTemplates.passwordResetCompleted({
      userName: userName,
      newPassword: newPassword
    });
    
    await transporter.sendMail({
      from: transporter.options.auth.user,
      to: userEmail,
      subject: '✅ Password Anda Telah Direset',
      html: html
    });
    
    await prisma.emailNotificationLog.create({
      data: {
        emailAddress: userEmail,
        subject: '✅ Password Anda Telah Direset',
        emailType: 'PASSWORD_RESET',
        emailStatus: 'SENT',
        sentAt: new Date()
      }
    });

    console.log(`✅ Password reset email sent to ${userEmail}`);
  } catch (error) {
    console.error('❌ Send email error:', error);
  }
};
