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
    // Denormalized LKR value of `price`, computed once when the ad is
    // created/updated (see gemAdController.js). This lets price filtering,
    // sorting, and pagination all happen inside MongoDB with a single
    // indexed query — instead of pulling every matching ad into memory to
    // convert currencies and filter/paginate there.
    priceInLKR: {
      type: Number,
      required: true,
      min: 0,
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
    bumpedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// This is the index that matters most: every public listing query filters
// on status and sorts by bumpedAt, so this single compound index covers
// both the WHERE and the ORDER BY for the most common query shape.
gemAdSchema.index({ status: 1, bumpedAt: -1 });

// Support fast filtering on each advanced-filter field. Mongo can only use
// one of these per query alongside the compound index above (it picks the
// most selective), but each keeps its own filter fast when combined with
// status in a compound scan, and keeps updateGemAd-style single-field
// lookups fast too.
gemAdSchema.index({ category: 1 });
gemAdSchema.index({ color: 1 });
gemAdSchema.index({ shape: 1 });
gemAdSchema.index({ origin: 1 });
gemAdSchema.index({ clarity: 1 });
gemAdSchema.index({ weightCarats: 1 });
gemAdSchema.index({ priceInLKR: 1 });

// Text index for search. Note: MongoDB text search matches whole words/
// stems, not arbitrary substrings — searching "sapph" will NOT match
// "Sapphire" the way a regex would. If your users expect substring/partial
// matching (common for product titles), keep using $regex for `search` in
// the controller and skip relying on this index for that query — regex
// without a leading anchor can't use an index anyway. This index is left
// here so you have the option to switch to $text search later if word-level
// matching is acceptable, since $text is dramatically faster at scale.
gemAdSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('GemAd', gemAdSchema);