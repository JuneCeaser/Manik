const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { 
  getMyPayments, 
  handleRevenueCatWebhook 
} = require('../controllers/paymentController');

router.post('/revenuecat-webhook', handleRevenueCatWebhook);
router.get('/my-payments', protect, getMyPayments);

module.exports = router;