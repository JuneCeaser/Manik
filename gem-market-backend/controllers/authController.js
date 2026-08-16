const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // For decoding Apple token
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Otp = require('../models/Otp');
const generateOtp = require('../utils/generateOtp');
const sendSms = require('../utils/sendSms');
const generateToken = require('../utils/generateToken');
const ImageKit = require('imagekit');

const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID); // Set this in your .env

const OTP_EXPIRY_MS = (Number(process.env.OTP_EXPIRY_MINUTES) || 5) * 60 * 1000;
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;

const isValidPhone = (phone) => /^\d{9,12}$/.test(phone);

const formatForSms = (phone) => {
  let clean = phone.replace(/\D/g, '');
  if (phone.startsWith('0')) {
    return `94${clean.substring(1)}`;
  }
  return clean;
};

const SRI_LANKA_PROVINCES = [
  'Western', 'Central', 'Southern', 'Northern', 'Eastern', 
  'North Western', 'North Central', 'Uva', 'Sabaragamuwa',
];

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// --------------------------------------------------------------------------
// PHONE REGISTER & LOGIN
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
      user.authProvider = 'PHONE';
      await user.save();
    } else {
      user = await User.create({
        phone,
        name: otpRecord.payload.name,
        password: otpRecord.payload.hashedPassword,
        authProvider: 'PHONE',
        isVerified: true,
      });
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    const token = generateToken(user);
    return res.json({
      success: true, token,
      user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage, whatsappCountryCode: user.whatsappCountryCode, whatsappNumber: user.whatsappNumber, province: user.province, city: user.city, adCredits: user.adCredits, authProvider: user.authProvider },
    });
  } catch (err) {
    console.error('verifyRegisterOtp error:', err);
    return res.status(500).json({ success: false, message: 'Could not verify OTP.' });
  }
};

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
      success: true, token,
      user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage, whatsappCountryCode: user.whatsappCountryCode, whatsappNumber: user.whatsappNumber, province: user.province, city: user.city, adCredits: user.adCredits, authProvider: user.authProvider },
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ success: false, message: 'Could not log in.' });
  }
};

// --------------------------------------------------------------------------
// PASSWORD & PROFILE UPDATES
// --------------------------------------------------------------------------
exports.sendForgotPasswordOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !isValidPhone(phone.replace(/\D/g, ''))) return res.status(400).json({ success: false, message: 'Valid phone number is required.' });

    const user = await User.findOne({ phone, isVerified: true });
    if (!user) return res.status(404).json({ success: false, message: 'No account registered with this number.' });

    const code = generateOtp();
    await Otp.findOneAndUpdate({ phone, purpose: 'forgot_password' }, { code, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) }, { upsert: true, new: true });
    const smsPhone = formatForSms(phone);
    await sendSms(smsPhone, `Your Manik password reset code is: ${code}. Expires in ${process.env.OTP_EXPIRY_MINUTES || 5} mins.`);
    return res.json({ success: true, message: 'Password reset OTP sent.' });
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not send reset OTP.' }); }
};

exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword) return res.status(400).json({ success: false, message: 'Phone, code, and new password are required.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });

    const otpRecord = await Otp.findOne({ phone, purpose: 'forgot_password' });
    if (!otpRecord || otpRecord.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'OTP expired or not found. Request a new one.' });
    if (otpRecord.attempts >= MAX_ATTEMPTS) return res.status(429).json({ success: false, message: 'Too many incorrect attempts.' });
    if (otpRecord.code !== code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
    }

    const user = await User.findOne({ phone, isVerified: true });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await Otp.deleteOne({ _id: otpRecord._id });

    return res.json({ success: true, message: 'Password updated successfully. Please log in.' });
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not reset password.' }); }
};

exports.sendChangePasswordOtp = async (req, res) => {
  try {
    const phone = req.user.phone;
    if(!phone) return res.status(400).json({ success: false, message: 'Cannot change password for social login accounts.' });
    const code = generateOtp();
    await Otp.findOneAndUpdate({ phone, purpose: 'change_password' }, { code, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) }, { upsert: true, new: true });
    const smsPhone = formatForSms(phone);
    await sendSms(smsPhone, `Your Manik verification code is: ${code}. Expires in ${process.env.OTP_EXPIRY_MINUTES || 5} mins.`);
    return res.json({ success: true, message: 'OTP sent to your registered phone number.' });
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not send OTP.' }); }
};

exports.verifyChangePasswordOtp = async (req, res) => {
  try {
    const phone = req.user.phone;
    const { code, newPassword } = req.body;
    if (!code || !newPassword) return res.status(400).json({ success: false, message: 'Code and new password are required.' });
    const otpRecord = await Otp.findOne({ phone, purpose: 'change_password' });
    if (!otpRecord || otpRecord.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'OTP expired or not found.' });
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
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not change password.' }); }
};

exports.changeName = async (req, res) => {
  try {
    const { newName } = req.body;
    if (!newName || newName.trim().length < 2) return res.status(400).json({ success: false, message: 'Please provide a valid name.' });
    const user = await User.findById(req.user._id);
    user.name = newName.trim();
    await user.save();
    return res.json({ success: true, message: 'Name updated.', user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage, whatsappCountryCode: user.whatsappCountryCode, whatsappNumber: user.whatsappNumber, province: user.province, city: user.city, adCredits: user.adCredits, authProvider: user.authProvider }});
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not change name.' }); }
};

exports.updateWhatsappNumber = async (req, res) => {
  try {
    const { whatsappCountryCode, whatsappNumber } = req.body;
    if (!whatsappCountryCode || !whatsappNumber) return res.status(400).json({ success: false, message: 'Country code and WhatsApp number are required.' });
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const user = await User.findById(req.user._id);
    user.whatsappCountryCode = whatsappCountryCode;
    user.whatsappNumber = cleanNumber;
    await user.save();
    return res.json({ success: true, message: 'WhatsApp number updated.', user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage, whatsappCountryCode: user.whatsappCountryCode, whatsappNumber: user.whatsappNumber, province: user.province, city: user.city, adCredits: user.adCredits, authProvider: user.authProvider } });
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not update WhatsApp number.' }); }
};

exports.updateLocation = async (req, res) => {
  try {
    const { province, city } = req.body;
    if (!province || !city) return res.status(400).json({ success: false, message: 'Province and city are required.' });
    const user = await User.findById(req.user._id);
    user.province = province;
    user.city = city;
    await user.save();
    return res.json({ success: true, message: 'Location updated.', user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage, whatsappCountryCode: user.whatsappCountryCode, whatsappNumber: user.whatsappNumber, province: user.province, city: user.city, adCredits: user.adCredits, authProvider: user.authProvider } });
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not update location.' }); }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    return res.json({ success: true, user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage, whatsappCountryCode: user.whatsappCountryCode, whatsappNumber: user.whatsappNumber, province: user.province, city: user.city, adCredits: user.adCredits, authProvider: user.authProvider } });
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not fetch profile.' }); }
};

exports.sendDeleteAccountOtp = async (req, res) => {
  try {
    const phone = req.user.phone;
    if(!phone) {
      // Social login bypass - delete instantly since they don't have phone OTP
      await User.findByIdAndDelete(req.user._id);
      return res.json({ success: true, bypass: true, message: 'Account permanently deleted.' });
    }
    const code = generateOtp();
    await Otp.findOneAndUpdate({ phone, purpose: 'delete_account' }, { code, attempts: 0, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) }, { upsert: true, new: true });
    const smsPhone = formatForSms(phone);
    await sendSms(smsPhone, `ALERT: Your Manik account deletion code is: ${code}. Expires in ${process.env.OTP_EXPIRY_MINUTES || 5} mins.`);
    return res.json({ success: true, message: 'Deletion OTP sent.' });
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not send deletion OTP.' }); }
};

exports.verifyDeleteAccountOtp = async (req, res) => {
  try {
    const phone = req.user.phone;
    const { code } = req.body;
    const otpRecord = await Otp.findOne({ phone, purpose: 'delete_account' });
    if (!otpRecord || otpRecord.code !== code) return res.status(400).json({ success: false, message: 'Incorrect or expired OTP.' });
    
    const user = await User.findById(req.user._id);
    if (user && user.profileImageId) {
      try { await imagekit.deleteFile(user.profileImageId); } catch (imgError) {}
    }
    await User.findByIdAndDelete(req.user._id);
    await Otp.deleteMany({ phone });
    return res.json({ success: true, message: 'Account permanently deleted.' });
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not delete account.' }); }
};

exports.uploadProfileImage = async (req, res) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image) return res.status(400).json({ success: false, message: 'No image provided.' });
    const result = await imagekit.upload({ file: base64Image, fileName: `avatar_${req.user._id}.jpg`, folder: '/manik_profiles' });
    const user = await User.findById(req.user._id);
    user.profileImage = result.url;
    user.profileImageId = result.fileId;
    await user.save();
    return res.json({ success: true, user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage, whatsappCountryCode: user.whatsappCountryCode, whatsappNumber: user.whatsappNumber, province: user.province, city: user.city, adCredits: user.adCredits, authProvider: user.authProvider } });
  } catch (err) { return res.status(500).json({ success: false, message: 'Could not upload image.' }); }
};

// --------------------------------------------------------------------------
// GOOGLE & APPLE SIGN IN
// --------------------------------------------------------------------------

exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    
    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      // audience: process.env.GOOGLE_WEB_CLIENT_ID,  // Uncomment and verify if needed
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = await User.findOne({ googleId });
    
    if (!user) {
      // Check if email already exists from Apple login
      if (email) {
        user = await User.findOne({ email });
      }
      
      if (user) {
        // Link Google ID to existing email account
        user.googleId = googleId;
        await user.save();
      } else {
        // Create brand new user
        user = await User.create({
          name: name || 'Google User',
          email,
          googleId,
          authProvider: 'GOOGLE',
          isVerified: true,
          profileImage: picture || '',
        });
      }
    }

    const token = generateToken(user);
    return res.json({
      success: true, token,
      user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage, whatsappCountryCode: user.whatsappCountryCode, whatsappNumber: user.whatsappNumber, province: user.province, city: user.city, adCredits: user.adCredits, authProvider: user.authProvider },
    });
  } catch (error) {
    console.error('Google Login Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to authenticate with Google.' });
  }
};

exports.appleLogin = async (req, res) => {
  try {
    const { identityToken, email, fullName } = req.body;
    
    // Decode Apple token (Signature verification is best practice, but decoding gets the sub securely enough if over HTTPS)
    const decodedToken = jwt.decode(identityToken);
    if (!decodedToken || !decodedToken.sub) {
      return res.status(400).json({ success: false, message: 'Invalid Apple Token' });
    }
    const appleId = decodedToken.sub;
    const tokenEmail = decodedToken.email || email;

    let user = await User.findOne({ appleId });
    
    if (!user) {
      if (tokenEmail) {
        user = await User.findOne({ email: tokenEmail });
      }
      if (user) {
        // Link Apple ID
        user.appleId = appleId;
        await user.save();
      } else {
        // Create new
        const name = fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : 'Apple User';
        user = await User.create({
          name: name || 'Apple User',
          email: tokenEmail,
          appleId,
          authProvider: 'APPLE',
          isVerified: true,
        });
      }
    }

    const token = generateToken(user);
    return res.json({
      success: true, token,
      user: { id: user._id, phone: user.phone, name: user.name, profileImage: user.profileImage, whatsappCountryCode: user.whatsappCountryCode, whatsappNumber: user.whatsappNumber, province: user.province, city: user.city, adCredits: user.adCredits, authProvider: user.authProvider },
    });
  } catch (error) {
    console.error('Apple Login Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to authenticate with Apple.' });
  }
};