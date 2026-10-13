const bcrypt = require('bcrypt');
const { sendPasswordResetNotification, sendPasswordResetCompletedEmail } = require('../services/emailService');
const prisma = require('../config/prisma');

const checkEmailConfigured = () => {
  return Boolean(
    process.env.EMAIL_USER && 
    process.env.EMAIL_USER !== 'your_email@gmail.com' && 
    process.env.EMAIL_PASSWORD && 
    process.env.EMAIL_PASSWORD !== 'your_app_password'
  );
};

// 1. User submit forgot password request
exports.submitPasswordResetRequest = async (req, res) => {
  try {
    const rawIdentifier = (req.body.username || req.body.email || '').trim();
    const reason = (req.body.reason || 'Lupa password dari aplikasi').trim();
    
    if (!rawIdentifier) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username wajib diisi.' 
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        username: rawIdentifier,
        deletedAt: null
      }
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Username tidak terdaftar dalam sistem.' 
      });
    }
    
    // Check if already have pending request
    const existingRequest = await prisma.passwordResetRequest.findFirst({
      where: {
        userId: user.id,
        status: "PENDING"
      }
    });
    
    if (existingRequest) {
      const isExpired = Date.now() - new Date(existingRequest.createdAt).getTime() > 24 * 60 * 60 * 1000;

      if (isExpired) {
        await prisma.passwordResetRequest.update({
          where: { id: existingRequest.id },
          data: {
            status: 'EXPIRED',
            adminNotes: 'Otomatis kedaluwarsa setelah lebih dari 24 jam.'
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Permintaan reset password untuk akun ini sudah ada dan sedang diproses oleh Admin.'
        });
      }
    }
    
    // Create password reset request
    const result = await prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        email: user.username,
        reason: reason,
        status: 'PENDING'
      }
    });
    
    // Create In-App Notification for Admin
    await prisma.notification.create({
      data: {
        title: 'Permintaan Reset Password',
        message: `User ${user.name} (${user.username}) meminta bantuan reset password. Alasan: ${reason}`,
        type: 'AUTH',
        targetRole: 'ADMIN',
        actionType: 'VIEW_PASSWORD_RESET',
        actionId: result.id
      }
    });

    // Send email notification to admins asynchronously if service is actively configured
    if (checkEmailConfigured() && process.env.NODE_ENV !== 'test') {
      (async () => {
        try {
          const admins = await prisma.user.findMany({
            where: {
              role: { in: ['ADMIN', 'SUPER_ADMIN'] },
              deletedAt: null
            }
          });
          
          for (const admin of admins) {
            await sendPasswordResetNotification(
              admin.username,
              user,
              reason,
              result.id
            );
          }
        } catch (emailErr) {
          console.warn('Gagal mengirim email reset password (non-fatal):', emailErr.message);
        }
      })();
    }
    
    return res.status(200).json({
      success: true,
      message: 'Permintaan reset password telah berhasil dikirim ke Admin.',
      requestId: result.id
    });
    
  } catch (error) {
    console.error('Error submitting password reset request:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat memproses permintaan reset password.'
    });
  }
};

// 2. Admin get pending requests
exports.getPendingRequests = async (req, res) => {
  try {
    const requests = await prisma.passwordResetRequest.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const formattedRequests = requests.map(req => ({
      id: req.id,
      user_id: req.userId,
      user_name: req.user.name,
      user_email: req.user.username,
      role: req.user.role,
      reason: req.reason,
      status: req.status,
      created_at: req.createdAt
    }));
    
    res.status(200).json({
      success: true,
      data: formattedRequests,
      count: formattedRequests.length
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan'
    });
  }
};

// 3. Admin verify & reset password
exports.verifyAndResetPassword = async (req, res) => {
  try {
    const { requestId, isApproved, notes } = req.body;
    const adminId = req.user.id; // from auth middleware
    
    // Get request
    const request = await prisma.passwordResetRequest.findUnique({
      where: {
        id: requestId
      }
    });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request tidak ditemukan'
      });
    }
    
    if (isApproved) {
      // Generate password
      const tempPassword = generateSecurePassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // Update user password
      await prisma.user.update({
        where: { id: request.userId },
        data: { password: hashedPassword }
      });
      
      // Update request status
      await prisma.passwordResetRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          resetByAdminId: adminId,
          adminNotes: notes,
          resetAt: new Date()
        }
      });
      
      // Get user for notification
      const user = await prisma.user.findUnique({
        where: { id: request.userId }
      });
      
      // Send email to user if actively configured
      if (checkEmailConfigured() && process.env.NODE_ENV !== 'test') {
        sendPasswordResetCompletedEmail(
          user.username,
          user.name,
          tempPassword
        ).catch(err => console.warn('Failed to send reset email (non-fatal):', err.message));
      }
      
      // Mark related Admin in-app notification as read
      try {
        await prisma.notification.updateMany({
          where: {
            actionType: 'VIEW_PASSWORD_RESET',
            actionId: requestId
          },
          data: { isRead: true }
        });
      } catch (notifErr) {
        console.warn('Non-critical: error marking notification as read:', notifErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Password berhasil direset',
        data: {
          userId: user.id,
          userEmail: user.username,
          userName: user.name,
          newPassword: tempPassword
        }
      });
      
    } else {
      // Reject
      await prisma.passwordResetRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          adminNotes: notes,
          resetByAdminId: adminId,
          resetAt: new Date()
        }
      });

      // Mark related Admin in-app notification as read
      try {
        await prisma.notification.updateMany({
          where: {
            actionType: 'VIEW_PASSWORD_RESET',
            actionId: requestId
          },
          data: { isRead: true }
        });
      } catch (notifErr) {
        console.warn('Non-critical: error marking notification as read:', notifErr.message);
      }
      
      return res.status(200).json({
        success: true,
        message: 'Permintaan ditolak'
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan'
    });
  }
};

// Helper
function generateSecurePassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
