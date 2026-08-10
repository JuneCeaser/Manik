const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
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
    // NEW FIELD: Tracks how many ads the user has paid to post
    adCredits: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compares a plain-text password against the stored hash.
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);