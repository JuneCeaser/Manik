const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Otp = require('../models/Otp');
const generateOtp = require('../utils/generateOtp');
const sendSms = require('../utils/sendSms');
const generateToken = require('../utils/generateToken');
const ImageKit = require('imagekit');

const OTP_EXPIRY_MS = (Number(process.env.OTP_EXPIRY_MINUTES) || 5) * 60 * 1000;
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;

const isValidPhone = (phone) => /^\d{9,12}$/.test(phone);

// Helper to format old numbers (e.g., 077...) to international for Text.lk 
// without breaking new numbers that already have country codes.
const formatForSms = (phone) => {
  let clean = phone.replace(/\D/g, '');
  if (phone.startsWith('0')) {
    return `94${clean.substring(1)}`;
  }
  return clean;
};

// Allowed provinces for the location dropdown (Sri Lanka's 9 provinces).
const SRI_LANKA_PROVINCES = [
  'Western',
  'Central',
  'Southern',
  'Northern',
  'Eastern',
  'North Western',
  'North Central',
  'Uva',
  'Sabaragamuwa',
];

// Configure ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// --------------------------------------------------------------------------
// REGISTER
// --------------------------------------------------------------------------
exports.sendRegisterOtp = async (req, res) => {
  try {
    const { phone, name, password } = req.body;

    if (!phone || !name || !password || !isValidPhone(phone.replace(/\D/g, ''))) {
      return res.status(400).json({ success: false, message: 'Phone, name, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser && existingUser.isVerified) {
      return res.status(409).json({ success: false, message: 'This number is already registered. Please log in.' });
    }

    const code = generateOtp();
    const hashedPassword = await bcrypt.hash(password, 10);

    await Otp.findOneAndUpdate(
      { phone, purpose: 'register' },
      { code, payload: { name, hashedPassword }, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
      { upsert: true, new: true }
    );

    const smsPhone = formatForSms(phone);
    await sendSms(smsPhone, `Your Manik verification code is: ${code}. Expires in ${process.env.OTP_EXPIRY_MINUTES || 5} mins.`);

    return res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) {
    console.error('sendRegisterOtp error:', err);
    return res.status(500).json({ success: false, message: 'Could not send OTP.' });
  }
};

exports.verifyRegisterOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and code are required.' });
    }

    const otpRecord = await Otp.findOne({ phone, purpose: 'register' });
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired or not found. Request a new one.' });
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new OTP.' });
    }

    if (otpRecord.code !== code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
    }

    let user = await User.findOne({ phone });
    if (user) {
      user.isVerified = true;
      user.name = otpRecord.payload.name;
      user.password = otpRecord.payload.hashedPassword;
      await user.save();
    } else {
      user = await User.create({
        phone,
        name: otpRecord.payload.name,
        password: otpRecord.payload.hashedPassword,
        isVerified: true,
      });
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    const token = generateToken(user);
    return res.json({
      success: true,
      token,
      user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage },
    });
  } catch (err) {
    console.error('verifyRegisterOtp error:', err);
    return res.status(500).json({ success: false, message: 'Could not verify OTP.' });
  }
};

// --------------------------------------------------------------------------
// LOGIN
// --------------------------------------------------------------------------
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required.' });
    }

    const user = await User.findOne({ phone, isVerified: true }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found for this number.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    const token = generateToken(user);
    return res.json({
      success: true,
      token,
      user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage },
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ success: false, message: 'Could not log in.' });
  }
};

// --------------------------------------------------------------------------
// FORGOT PASSWORD
// --------------------------------------------------------------------------
exports.sendForgotPasswordOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !isValidPhone(phone.replace(/\D/g, ''))) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required.' });
    }

    const user = await User.findOne({ phone, isVerified: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account registered with this number.' });
    }

    const code = generateOtp();

    await Otp.findOneAndUpdate(
      { phone, purpose: 'forgot_password' },
      { code, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
      { upsert: true, new: true }
    );

    const smsPhone = formatForSms(phone);
    await sendSms(smsPhone, `Your Manik password reset code is: ${code}. Expires in ${process.env.OTP_EXPIRY_MINUTES || 5} mins.`);

    return res.json({ success: true, message: 'Password reset OTP sent.' });
  } catch (err) {
    console.error('sendForgotPasswordOtp error:', err);
    return res.status(500).json({ success: false, message: 'Could not send reset OTP.' });
  }
};

exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;

    if (!phone || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Phone, code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const otpRecord = await Otp.findOne({ phone, purpose: 'forgot_password' });
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired or not found. Request a new one.' });
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts.' });
    }

    if (otpRecord.code !== code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
    }

    const user = await User.findOne({ phone, isVerified: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await Otp.deleteOne({ _id: otpRecord._id });

    return res.json({ success: true, message: 'Password updated successfully. Please log in.' });
  } catch (err) {
    console.error('verifyForgotPasswordOtp error:', err);
    return res.status(500).json({ success: false, message: 'Could not reset password.' });
  }
};

// --------------------------------------------------------------------------
// CHANGE PASSWORD (Protected Route)
// --------------------------------------------------------------------------
exports.sendChangePasswordOtp = async (req, res) => {
  try {
    const phone = req.user.phone;
    const code = generateOtp();

    await Otp.findOneAndUpdate(
      { phone, purpose: 'change_password' },
      { code, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
      { upsert: true, new: true }
    );

    const smsPhone = formatForSms(phone);
    await sendSms(smsPhone, `Your Manik verification code is: ${code}. Expires in ${process.env.OTP_EXPIRY_MINUTES || 5} mins.`);

    return res.json({ success: true, message: 'OTP sent to your registered phone number.' });
  } catch (err) {
    console.error('sendChangePasswordOtp error:', err);
    return res.status(500).json({ success: false, message: 'Could not send OTP.' });
  }
};

exports.verifyChangePasswordOtp = async (req, res) => {
  try {
    const phone = req.user.phone;
    const { code, newPassword } = req.body;

    if (!code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Code and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const otpRecord = await Otp.findOne({ phone, purpose: 'change_password' });
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired or not found.' });
    }

    if (otpRecord.code !== code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
    }

    const user = await User.findById(req.user._id);
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await Otp.deleteOne({ _id: otpRecord._id });

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('verifyChangePasswordOtp error:', err);
    return res.status(500).json({ success: false, message: 'Could not change password.' });
  }
};
// --------------------------------------------------------------------------
// CHANGE NAME (Protected Route - No OTP Required)
// --------------------------------------------------------------------------
exports.changeName = async (req, res) => {
  try {
    const { newName } = req.body;

    if (!newName || newName.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Please provide a valid name.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.name = newName.trim();
    await user.save();

    return res.json({
      success: true,
      message: 'Name updated successfully.',
      user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage },
    });
  } catch (err) {
    console.error('changeName error:', err);
    return res.status(500).json({ success: false, message: 'Could not change name.' });
  }
};

// --------------------------------------------------------------------------
// UPDATE WHATSAPP NUMBER (Protected Route - No OTP Required)
// --------------------------------------------------------------------------
exports.updateWhatsappNumber = async (req, res) => {
  try {
    const { whatsappCountryCode, whatsappNumber } = req.body;

    if (!whatsappCountryCode || !whatsappNumber) {
      return res.status(400).json({ success: false, message: 'Country code and WhatsApp number are required.' });
    }

    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    if (!/^\d{6,12}$/.test(cleanNumber)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid WhatsApp number.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.whatsappCountryCode = whatsappCountryCode;
    user.whatsappNumber = cleanNumber;
    await user.save();

    return res.json({
      success: true,
      message: 'WhatsApp number updated successfully.',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        profileImage: user.profileImage,
        whatsappCountryCode: user.whatsappCountryCode,
        whatsappNumber: user.whatsappNumber,
        province: user.province,
        city: user.city,
      },
    });
  } catch (err) {
    console.error('updateWhatsappNumber error:', err);
    return res.status(500).json({ success: false, message: 'Could not update WhatsApp number.' });
  }
};

// --------------------------------------------------------------------------
// UPDATE LOCATION (Protected Route - No OTP Required)
// --------------------------------------------------------------------------
exports.updateLocation = async (req, res) => {
  try {
    const { province, city } = req.body;

    if (!province || !city) {
      return res.status(400).json({ success: false, message: 'Province and city are required.' });
    }

    if (!SRI_LANKA_PROVINCES.includes(province)) {
      return res.status(400).json({ success: false, message: 'Please select a valid province.' });
    }

    const cleanCity = city.trim();
    if (cleanCity.length < 2 || cleanCity.length > 50) {
      return res.status(400).json({ success: false, message: 'Please select a valid city.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.province = province;
    user.city = cleanCity;
    await user.save();

    return res.json({
      success: true,
      message: 'Location updated successfully.',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        profileImage: user.profileImage,
        whatsappCountryCode: user.whatsappCountryCode,
        whatsappNumber: user.whatsappNumber,
        province: user.province,
        city: user.city,
      },
    });
  } catch (err) {
    console.error('updateLocation error:', err);
    return res.status(500).json({ success: false, message: 'Could not update location.' });
  }
};

// GET USER PROFILE (Protected Route)
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        profileImage: user.profileImage,
        whatsappCountryCode: user.whatsappCountryCode,
        whatsappNumber: user.whatsappNumber,
        province: user.province,
        city: user.city,
      },
    });
  } catch (err) {
    console.error('getUserProfile error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch profile.' });
  }
};

// --------------------------------------------------------------------------
// DELETE ACCOUNT (Protected Route)
// --------------------------------------------------------------------------
exports.sendDeleteAccountOtp = async (req, res) => {
  try {
    const phone = req.user.phone;

    // Generate the 6-digit OTP
    const code = generateOtp();

    // Save it to the database
    await Otp.findOneAndUpdate(
      { phone, purpose: 'delete_account' },
      { code, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
      { upsert: true, new: true }
    );

    // Format the phone number and send the SMS
    const smsPhone = formatForSms(phone);
    await sendSms(smsPhone, `ALERT: Your Manik account deletion code is: ${code}. Expires in ${process.env.OTP_EXPIRY_MINUTES || 5} mins.`);

    return res.json({ success: true, message: 'Deletion OTP sent to your registered phone number.' });
  } catch (err) {
    console.error('sendDeleteAccountOtp error:', err);
    return res.status(500).json({ success: false, message: 'Could not send deletion OTP.' });
  }
};

exports.verifyDeleteAccountOtp = async (req, res) => {
  try {
    const phone = req.user.phone;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'OTP code is required.' });
    }

    const otpRecord = await Otp.findOne({ phone, purpose: 'delete_account' });
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired or not found.' });
    }

    if (otpRecord.code !== code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
    }

    // 1. Find the user first to access profileImageId
    const user = await User.findById(req.user._id);

    // 2. If they have an image, delete it from ImageKit
    if (user && user.profileImageId) {
      try {
        await imagekit.deleteFile(user.profileImageId);
        console.log('Successfully deleted image from ImageKit');
      } catch (imgError) {
        console.error('Failed to delete image from ImageKit:', imgError);
      }
    }

    // 3. Delete the user from MongoDB
    await User.findByIdAndDelete(req.user._id);
    await Otp.deleteMany({ phone });

    return res.json({ success: true, message: 'Account permanently deleted.' });
  } catch (err) {
    console.error('verifyDeleteAccountOtp error:', err);
    return res.status(500).json({ success: false, message: 'Could not delete account.' });
  }
};

// --------------------------------------------------------------------------
// UPLOAD PROFILE IMAGE (Protected Route - ImageKit Version)
// --------------------------------------------------------------------------
exports.uploadProfileImage = async (req, res) => {
  try {
    const { base64Image } = req.body;

    if (!base64Image) {
      return res.status(400).json({ success: false, message: 'No image provided.' });
    }

    const result = await imagekit.upload({
      file: base64Image, 
      fileName: `avatar_${req.user._id}.jpg`,
      folder: '/manik_profiles',
    });

    const user = await User.findById(req.user._id);
    user.profileImage = result.url;
    user.profileImageId = result.fileId; // Save the file ID for future deletion
    await user.save();

    return res.json({
      success: true,
      message: 'Profile image updated.',
      user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage },
    });
  } catch (err) {
    console.error('ImageKit Upload Error:', err);
    return res.status(500).json({ success: false, message: 'Could not upload image.' });
  }
};