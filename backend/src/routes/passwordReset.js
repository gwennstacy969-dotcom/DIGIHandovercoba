const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/passwordResetController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 1. Submit request (Public endpoint)
router.post('/request', passwordResetController.submitPasswordResetRequest);

// 2. Get pending requests (Admin only)
router.get('/pending', adminMiddleware, passwordResetController.getPendingRequests);

// 3. Verify & Process request (Admin only)
router.post('/verify', adminMiddleware, passwordResetController.verifyAndResetPassword);

module.exports = router;
