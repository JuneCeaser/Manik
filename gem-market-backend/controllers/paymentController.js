const Payment = require('../models/Payment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendSms = require('../utils/sendSms');

const formatForSms = (phone) => {
  let clean = phone.replace(/\D/g, '');
  if (phone.startsWith('0')) {
    return `94${clean.substring(1)}`;
  }
  return clean;
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

// --- SECURE WEBHOOK HANDLER ---
exports.handleRevenueCatWebhook = async (req, res) => {
  try {
    const expectedToken = process.env.REVENUECAT_WEBHOOK_SECRET;
    const authHeader = req.headers.authorization;

    if (authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).send('Unauthorized');
    }

    const event = req.body.event;

    if (event.type === 'INITIAL_PURCHASE' || event.type === 'NON_RENEWING_PURCHASE') {
      const userId = event.app_user_id; 
      const purchasePrice = event.price || 990;

      const user = await User.findById(userId);
      
      if (user) {
        const existingPayment = await Payment.findOne({ payhereTransactionId: event.transaction_id });
        
        if (!existingPayment) {
          user.adCredits += 30;
          await user.save();

          const payment = await Payment.create({
            user: user._id,
            amount: purchasePrice,
            method: 'REVENUECAT',
            status: 'APPROVED',
            adCreditsAdded: 30,
            payhereTransactionId: event.transaction_id, 
          });

          // In-App Notification (For Everyone)
          try {
            await Notification.create({
              user: user._id,
              title: 'Payment Approved',
              message: `Your Google Play purchase was successful. 30 Ad Credits have been added to your account.`,
              type: 'PAYMENT_APPROVED',
              relatedPaymentId: payment._id,
            });
          } catch (notifError) {}

          // SMS Notification (ONLY if user registered with a Phone number)
          if (user.phone && user.authProvider === 'PHONE') {
            try {
              const smsPhone = formatForSms(user.phone);
              await sendSms(
                smsPhone,
                `Manik Gem Market: Your purchase was successful! 30 Ad Credits have been added to your account.`
              );
            } catch (smsError) {}
          }
        }
      }
    }

    return res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Webhook Error:', err);
    return res.status(500).send('Server Error');
  }
};