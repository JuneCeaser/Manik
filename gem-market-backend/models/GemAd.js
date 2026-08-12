const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileId: { type: String, required: true },
  },
  { _id: false }
);

const gemAdSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
    },
    price: {
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, enum: ['LKR', 'USD'], required: true, default: 'LKR' },
      negotiable: { type: Boolean, default: false },
    },
    weightCarats: {
      type: Number,
      required: true,
      min: 0,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    shape: {
      type: String,
      required: true,
    },
    origin: {
      type: String,
      required: true,
    },
    clarity: {
      type: String,
      required: true,
    },
    dimensions: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      depth: { type: Number, default: 0 },
    },
    treatment: {
      type: String,
      required: true,
    },
    certification: {
      status: { type: String, enum: ['Certified', 'Not Certified'], default: 'Not Certified' },
      labName: { type: String, trim: true, default: '' },
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    images: {
      type: [imageSchema],
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= 5,
        message: 'A gem ad must have between 1 and 5 images.',
      },
      required: true,
    },
    certificateImage: {
      type: imageSchema,
      default: null,
    },
    location: {
      province: { type: String, required: true },
      city: { type: String, required: true },
    },
    contactPhone: {
      type: String,
      default: '',
    },
    hidePhoneNumber: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    creditsUsed: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GemAd', gemAdSchema);