const Admin = require('../models/Admin');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const GemAd = require('../models/GemAd');
const Favorite = require('../models/Favorite');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
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

exports.createFirstAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const adminExists = await Admin.findOne({ email });
    if (adminExists) return res.status(400).json({ message: 'Admin already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ name, email, password: hashedPassword });

    return res.json({ success: true, message: 'Admin created!', admin: { email: admin.email }});
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(admin);
    return res.json({
      success: true, token,
      admin: { id: admin._id, name: admin.name, email: admin.email }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    return res.json({ success: true, count: users.length, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch users.' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.profileImageId) {
      try { await imagekit.deleteFile(user.profileImageId); } catch (e) {}
    }

    // Delete user's gem ads and certificate files from ImageKit
    const userAds = await GemAd.find({ user: req.params.id });
    for (const ad of userAds) {
      for (const image of ad.images) {
        if (image.fileId) { try { await imagekit.deleteFile(image.fileId); } catch (e) {} }
      }
      if (ad.certificateImage && ad.certificateImage.fileId) {
        try { await imagekit.deleteFile(ad.certificateImage.fileId); } catch (e) {}
      }
    }

    await GemAd.deleteMany({ user: req.params.id });
    await Favorite.deleteMany({ user: req.params.id });
    await User.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: 'User and all associated ads deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not delete user.' });
  }
};

exports.getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'PENDING' }).populate('user', 'name phone').sort({ createdAt: -1 });
    return res.json({ success: true, payments });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending payments.' });
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.status !== 'PENDING') return res.status(400).json({ success: false, message: 'Payment already processed.' });

    payment.status = 'APPROVED';
    await payment.save();

    const user = await User.findById(payment.user);
    if (user) {
      user.adCredits += payment.adCreditsAdded;
      await user.save();

      try {
        await Notification.create({
          user: user._id,
          title: 'Payment Approved',
          message: `Your payment of Rs. ${payment.amount} has been approved. ${payment.adCreditsAdded} Ad Credits have been added to your account.`,
          type: 'PAYMENT_APPROVED',
          relatedPaymentId: payment._id,
        });
      } catch (notifError) {}

      if (user.phone && user.authProvider === 'PHONE') {
        try {
          const smsPhone = formatForSms(user.phone);
          await sendSms(smsPhone, `Your Manik payment of Rs. ${payment.amount} has been approved. ${payment.adCreditsAdded} Ad Credits have been added to your account.`);
        } catch (smsError) {}
      }
    }

    return res.json({ success: true, message: 'Payment approved and credits added.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to approve payment.' });
  }
};

exports.getPendingGemAds = async (req, res) => {
  try {
    const gemAds = await GemAd.find({ status: 'PENDING' }).populate('user', 'name phone').sort({ createdAt: -1 });
    return res.json({ success: true, gemAds });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending ads.' });
  }
};

exports.approveGemAd = async (req, res) => {
  try {
    const gemAd = await GemAd.findById(req.params.id).populate('user');
    if (!gemAd) return res.status(404).json({ success: false, message: 'Ad not found.' });
    if (gemAd.status === 'APPROVED') return res.status(400).json({ success: false, message: 'Ad already approved.' });

    gemAd.status = 'APPROVED';
    await gemAd.save();

    try {
      await Notification.create({
        user: gemAd.user._id,
        title: 'Ad Approved',
        message: `Your ad "${gemAd.title}" has been approved and is now live on Manik.`,
        type: 'AD_APPROVED',
        relatedGemAdId: gemAd._id,
      });
    } catch (notifError) {}

    return res.json({ success: true, message: 'Ad approved and published.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to approve ad.' });
  }
};