const express = require('express');
const router = express.Router();
const { submitManualSlip, getMyPayments } = require('../controllers/paymentController');
const protect = require('../middleware/authMiddleware');

router.post('/manual-slip', protect, submitManualSlip);
router.get('/my-payments', protect, getMyPayments);

module.exports = router;