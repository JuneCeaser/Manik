// models/Favorite.js

const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gemAd: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GemAd',
      required: true,
    },
  },
  { timestamps: true }
);

// A user can only favorite the same ad once.
favoriteSchema.index({ user: 1, gemAd: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);