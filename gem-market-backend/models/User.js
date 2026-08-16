const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null/undefined values for social logins
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    authProvider: {
      type: String,
      enum: ['PHONE', 'GOOGLE', 'APPLE'],
      default: 'PHONE',
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    appleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      select: false, // Not required for social logins
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      type: String,
      default: '',
    },
    profileImageId: {
      type: String,
      default: '',
    },
    whatsappCountryCode: {
      type: String,
      default: '',
    },
    whatsappNumber: {
      type: String,
      default: '',
    },
    province: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    adCredits: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compares a plain-text password against the stored hash.
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);