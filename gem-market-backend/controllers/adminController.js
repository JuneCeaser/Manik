const Admin = require('../models/Admin');
const User = require('../models/User');
const Payment = require('../models/Payment');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// --------------------------------------------------------------------------
// ADMIN AUTHENTICATION
// --------------------------------------------------------------------------

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
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(admin);

    return res.json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// --------------------------------------------------------------------------
// ADMIN DASHBOARD ACTIONS (Protected)
// --------------------------------------------------------------------------
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
      try {
        await imagekit.deleteFile(user.profileImageId);
      } catch (imgError) {
        console.error('Failed to delete image:', imgError);
      }
    }

    await User.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not delete user.' });
  }
};

// --------------------------------------------------------------------------
// ADMIN PAYMENT APPROVAL ACTIONS (New)
// --------------------------------------------------------------------------
exports.getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'PENDING' })
      .populate('user', 'name phone')
      .sort({ createdAt: -1 });
    
    return res.json({ success: true, payments });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending payments.' });
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }
    if (payment.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Payment already processed.' });
    }

    payment.status = 'APPROVED';
    await payment.save();

    const user = await User.findById(payment.user);
    if (user) {
      user.adCredits += payment.adCreditsAdded;
      await user.save();
    }

    return res.json({ success: true, message: 'Payment approved and credits added.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to approve payment.' });
  }
};