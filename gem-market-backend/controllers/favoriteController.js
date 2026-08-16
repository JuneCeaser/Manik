// controllers/favoriteController.js

const Favorite = require('../models/Favorite');
const GemAd = require('../models/GemAd');

// --------------------------------------------------------------------------
// TOGGLE FAVORITE (Add if not favorited, remove if already favorited)
// --------------------------------------------------------------------------
exports.toggleFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    const gemAd = await GemAd.findById(id);
    if (!gemAd) {
      return res.status(404).json({ success: false, message: 'Gem ad not found.' });
    }

    const existing = await Favorite.findOne({ user: req.user._id, gemAd: id });

    if (existing) {
      await Favorite.findByIdAndDelete(existing._id);
      return res.json({ success: true, favorited: false, message: 'Removed from favorites.' });
    }

    await Favorite.create({ user: req.user._id, gemAd: id });
    return res.json({ success: true, favorited: true, message: 'Added to favorites.' });
  } catch (err) {
    console.error('toggleFavorite error:', err);
    return res.status(500).json({ success: false, message: 'Could not update favorite.' });
  }
};

// --------------------------------------------------------------------------
// GET MY FAVORITE GEM ADS (Full details, for the Favorites tab)
// --- PAGINATION ADDED HERE ---
// --------------------------------------------------------------------------
exports.getMyFavorites = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    // SECURITY FIX: cap the page size so a client can't request an
    // unbounded number of records in one call (e.g. ?limit=999999).
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const skip = (page - 1) * limit;

    const favorites = await Favorite.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'gemAd',
        populate: { path: 'user', select: 'name' },
      });

    // A favorited ad may have since been deleted by its owner - skip those.
    const gemAds = favorites.filter((fav) => fav.gemAd).map((fav) => fav.gemAd);

    // Check if there are more favorites to load after this batch
    const totalFavorites = await Favorite.countDocuments({ user: req.user._id });
    const hasMore = skip + favorites.length < totalFavorites;

    return res.json({ success: true, gemAds, hasMore });
  } catch (err) {
    console.error('getMyFavorites error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch favorites.' });
  }
};

// --------------------------------------------------------------------------
// GET MY FAVORITE IDS (Lightweight, used to mark hearts on ad lists)
// --------------------------------------------------------------------------
exports.getMyFavoriteIds = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id }).select('gemAd');
    return res.json({ success: true, gemAdIds: favorites.map((f) => f.gemAd.toString()) });
  } catch (err) {
    console.error('getMyFavoriteIds error:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch favorite ids.' });
  }
};