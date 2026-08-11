//otp.js

const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: [
      'register', 
      'login', 
      'forgot_password', 
      'delete_account', 
      'change_password', 
      'change_name'
    ],
    required: true,
  },
  payload: {
    name: { type: String },
    hashedPassword: { type: String },
  },
  attempts: {
    type: Number,
    default: 0,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// TTL index: MongoDB automatically deletes expired OTP documents
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);