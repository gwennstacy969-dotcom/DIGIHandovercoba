const bcrypt = require('bcrypt');
const { sendPasswordResetNotification, sendPasswordResetCompletedEmail } = require('../services/emailService');
const prisma = require('../config/prisma');

// 1. User submit forgot password request
exports.submitPasswordResetRequest = async (req, res) => {
  try {
    const { email, reason } = req.body;
    
    // Validate email exists (we'll assume email is username here if no email field exists)
    const user = await prisma.user.findFirst({
      where: {
        username: email, // assuming username acts as email based on our schema
        // status: "ACTIVE" // we don't have a status field in our Prisma User model currently
      }
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email/Username tidak terdaftar' 
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
      const isUserLoggedInAfterRequest = user.updatedAt && new Date(user.updatedAt) > new Date(existingRequest.createdAt);
      const isExpired = Date.now() - new Date(existingRequest.createdAt).getTime() > 24 * 60 * 60 * 1000;

      if (isUserLoggedInAfterRequest || isExpired) {
        // Otomatis selesaikan request lama karena user pernah login atau request sudah kedaluwarsa
        await prisma.passwordResetRequest.update({
          where: { id: existingRequest.id },
          data: {
            status: isUserLoggedInAfterRequest ? 'RESOLVED' : 'EXPIRED',
            adminNotes: isUserLoggedInAfterRequest
              ? 'Otomatis diselesaikan karena user telah berhasil login setelah permohonan dibuat.'
              : 'Otomatis kedaluwarsa setelah lebih dari 24 jam.'
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Anda sudah memiliki permintaan reset yang sedang diproses oleh Admin.'
        });
      }
    }
    
    // Create password reset request
    const result = await prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        email: email,
        reason: reason || null,
        status: 'PENDING'
      }
    });
    
    // Create In-App Notification ONCE (which will appear in Admin's notification center)
    await prisma.notification.create({
      data: {
        title: 'Permintaan Reset Password',
        message: `User ${user.name} (${user.username}) meminta reset password. Alasan: ${reason || 'Tidak ada'}`,
        type: 'AUTH',
        targetRole: 'ADMIN'
      }
    });

    // Send email notification to admins
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'SUPER_ADMIN']
        }
      }
    });
    
    for (const admin of admins) {
      // 1. Send Email Notification
      await sendPasswordResetNotification(
        admin.username, // assuming username acts as email
        user,
        reason,
        result.id
      );
    }
    
    return res.status(200).json({
      success: true,
      message: 'Permintaan reset password telah dikirim ke admin',
      requestId: result.id
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan'
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
      
      // Send email to user
      await sendPasswordResetCompletedEmail(
        user.username, // using username as email
        user.name,
        tempPassword
      );
      
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
          adminNotes: notes
        }
      });
      
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
