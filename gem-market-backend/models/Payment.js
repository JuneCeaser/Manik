//payment.js

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    method: {
      type: String,
      enum: ['PAYHERE', 'MANUAL_SLIP'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    adCreditsAdded: {
      type: Number,
      required: true,
      default: 30,
    },
    slipImage: {
      type: String,
      default: '',
    },
    slipImageId: {
      type: String,
      default: '',
    },
    payhereTransactionId: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);