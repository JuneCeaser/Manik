// paymentRoutes.js
const express = require('express');
const router = express.Router();
const { submitManualSlip, getMyPayments, confirmRevenueCatPurchase } = require('../controllers/paymentController');
const protect = require('../middleware/authMiddleware');
router.post('/manual-slip', protect, submitManualSlip);
router.get('/my-payments', protect, getMyPayments);
router.post('/revenuecat-confirm', protect, confirmRevenueCatPurchase);
module.exports = router;