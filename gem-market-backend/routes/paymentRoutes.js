const express = require('express');
const router = express.Router();
const { submitManualSlip } = require('../controllers/paymentController');

// IMPORT FIX: No curly braces around protect!
const protect = require('../middleware/authMiddleware');

// Route for users to submit bank receipts
router.post('/manual-slip', protect, submitManualSlip);

module.exports = router;