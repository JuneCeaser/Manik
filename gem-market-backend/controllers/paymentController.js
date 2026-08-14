// paymentController.js

const Payment = require('../models/Payment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendSms = require('../utils/sendSms');
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Helper to format old numbers (e.g., 077...) to international for Text.lk
// without breaking new numbers that already have country codes.
// (Same helper used in adminController.js)
const formatForSms = (phone) => {
  let clean = phone.replace(/\D/g, '');
  if (phone.startsWith('0')) {
    return `94${clean.substring(1)}`;
  }
  return clean;
};

// @desc    Submit a manual bank slip for 30 Ad Credits
// @route   POST /api/payments/manual-slip
// @access  Private (User)
exports.submitManualSlip = async (req, res) => {
  try {
    const { base64Image, amount } = req.body;

    if (!base64Image) {
      return res.status(400).json({ success: false, message: 'Bank slip image is required.' });
    }

    const uploadResponse = await imagekit.upload({
      file: base64Image,
      fileName: `slip_${req.user._id}_${Date.now()}.jpg`,
      folder: '/bank_slips',
    });

    const payment = await Payment.create({
      user: req.user._id,
      amount: amount || 990,
      method: 'MANUAL_SLIP',
      status: 'PENDING',
      adCreditsAdded: 30,
      slipImage: uploadResponse.url,
      slipImageId: uploadResponse.fileId,
    });

    return res.status(201).json({
      success: true,
      message: 'Bank slip submitted successfully. Pending admin approval.',
      payment,
    });
  } catch (err) {
    console.error('submitManualSlip Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload bank slip.' });
  }
};

// @desc    Get logged in user's payment history
// @route   GET /api/payments/my-payments
// @access  Private (User)
exports.getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, payments });
  } catch (err) {
    console.error('getMyPayments Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
  }
};

// @desc    Confirm a RevenueCat purchase and instantly grant 30 Ad Credits
// @route   POST /api/payments/revenuecat-confirm
// @access  Private (User)
exports.confirmRevenueCatPurchase = async (req, res) => {
  try {
    const { amount, productId } = req.body;

    const payment = await Payment.create({
      user: req.user._id,
      amount: amount || 990,
      method: 'REVENUECAT',
      status: 'APPROVED',
      adCreditsAdded: 30,
    });

    const user = await User.findById(req.user._id);
    if (user) {
      user.adCredits += 30;
      await user.save();

      // Create in-app notification — same pattern as admin's manual approval
      try {
        await Notification.create({
          user: user._id,
          title: 'Payment Approved',
          message: `Your payment of Rs. ${payment.amount} has been approved. ${payment.adCreditsAdded} Ad Credits have been added to your account.`,
          type: 'PAYMENT_APPROVED',
          relatedPaymentId: payment._id,
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      // Send SMS — same pattern as admin's manual approval
      try {
        const smsPhone = formatForSms(user.phone);
        await sendSms(
          smsPhone,
          `Your Manik payment of Rs. ${payment.amount} has been approved. ${payment.adCreditsAdded} Ad Credits have been added to your account.`
        );
      } catch (smsError) {
        console.error('Failed to send SMS notification:', smsError);
      }
    }

    return res.json({
      success: true,
      message: '30 Ad Credits added successfully.',
      payment,
    });
  } catch (err) {
    console.error('confirmRevenueCatPurchase Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to confirm purchase.' });
  }
};