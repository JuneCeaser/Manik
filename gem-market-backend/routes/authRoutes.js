const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const otpRateLimiter = require('../middleware/otpRateLimiter');
const { userLoginRateLimiter } = require('../middleware/loginRateLimiter');
const {
  sendRegisterOtp,
  verifyRegisterOtp,
  login,
  googleLogin,
  appleLogin,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  sendChangePasswordOtp,
  verifyChangePasswordOtp,
  changeName, 
  sendDeleteAccountOtp,
  verifyDeleteAccountOtp,
  getUserProfile,
  uploadProfileImage,
  updateWhatsappNumber,
  updateLocation,
} = require('../controllers/authController');

// Public routes
router.post('/register/send-otp', otpRateLimiter, sendRegisterOtp);
router.post('/register/verify-otp', verifyRegisterOtp);
router.post('/login', userLoginRateLimiter, login);

// Social Login routes
router.post('/google', googleLogin);
router.post('/apple', appleLogin);

router.post('/forgot-password/send-otp', otpRateLimiter, sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp);

// Protected routes (Requires Auth Token)
router.post('/change-password/send-otp', protect, otpRateLimiter, sendChangePasswordOtp);
router.post('/change-password/verify-otp', protect, verifyChangePasswordOtp);

router.post('/delete-account/send-otp', protect, otpRateLimiter, sendDeleteAccountOtp);
router.post('/delete-account/verify-otp', protect, verifyDeleteAccountOtp);

// Direct Updates (No OTP Required)
router.put('/change-name', protect, changeName);
router.put('/profile-image', protect, uploadProfileImage);
router.put('/whatsapp-number', protect, updateWhatsappNumber);
router.put('/location', protect, updateLocation);
router.get('/profile', protect, getUserProfile);

module.exports = router;