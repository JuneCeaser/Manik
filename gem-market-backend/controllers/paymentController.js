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

const formatForSms = (phone) => {
  let clean = phone.replace(/\D/g, '');
  if (phone.startsWith('0')) {
    return `94${clean.substring(1)}`;
  }
  return clean;
};

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

exports.getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, payments });
  } catch (err) {
    console.error('getMyPayments Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
  }
};

// --- NEW SECURE WEBHOOK HANDLER ---
exports.handleRevenueCatWebhook = async (req, res) => {
  try {
    // 1. Verify the request is actually from RevenueCat
    const expectedToken = process.env.REVENUECAT_WEBHOOK_SECRET;
    const authHeader = req.headers.authorization;

    if (authHeader !== `Bearer ${expectedToken}`) {
      console.warn('Unauthorized webhook attempt');
      return res.status(401).send('Unauthorized');
    }

    // 2. Extract the event payload
    const event = req.body.event;

    // 3. Process only valid purchases
    if (event.type === 'INITIAL_PURCHASE' || event.type === 'NON_RENEWING_PURCHASE') {
      
      // app_user_id is the MongoDB User ID provided by the frontend Purchases.logIn()
      const userId = event.app_user_id; 
      const purchasePrice = event.price || 990;

      const user = await User.findById(userId);
      
      if (user) {
        // Prevent duplicate processing by checking if this exact transaction was already logged
        const existingPayment = await Payment.findOne({ payhereTransactionId: event.transaction_id });
        
        if (!existingPayment) {
          // Grant credits
          user.adCredits += 30;
          await user.save();

          // Log the payment in the history
          const payment = await Payment.create({
            user: user._id,
            amount: purchasePrice,
            method: 'REVENUECAT',
            status: 'APPROVED',
            adCreditsAdded: 30,
            payhereTransactionId: event.transaction_id, // Store transaction ID to prevent duplicates
          });

          // Send In-App Notification
          try {
            await Notification.create({
              user: user._id,
              title: 'Payment Approved',
              message: `Your Google Play purchase was successful. 30 Ad Credits have been added to your account.`,
              type: 'PAYMENT_APPROVED',
              relatedPaymentId: payment._id,
            });
          } catch (notifError) {
            console.error('Failed to create notification:', notifError);
          }

          // Send SMS
          try {
            const smsPhone = formatForSms(user.phone);
            await sendSms(
              smsPhone,
              `Manik Gem Market: Your purchase was successful! 30 Ad Credits have been added to your account.`
            );
          } catch (smsError) {
            console.error('Failed to send SMS notification:', smsError);
          }
        }
      }
    }

    // RevenueCat requires a 200 OK response immediately
    return res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Webhook Error:', err);
    return res.status(500).send('Server Error');
  }
};