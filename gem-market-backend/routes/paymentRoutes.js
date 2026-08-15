const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { 
  submitManualSlip, 
  getMyPayments, 
  handleRevenueCatWebhook 
} = require('../controllers/paymentController');

// Secure Webhook Endpoint (No JWT Auth, uses RevenueCat Authorization Header)
router.post('/revenuecat-webhook', handleRevenueCatWebhook);

// Protected User Endpoints
router.post('/manual-slip', protect, submitManualSlip);
router.get('/my-payments', protect, getMyPayments);

module.exports = router;