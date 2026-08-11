const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['PAYMENT_APPROVED', 'AD_APPROVED', 'GENERAL'],
      default: 'GENERAL',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    relatedGemAdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GemAd',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);