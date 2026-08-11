const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  createGemAd,
  getMyGemAds,
  getGemAdById,
  updateGemAd,
  deleteGemAd,
  getPublishedGemAds,
  getPublicGemAdById,
  getImageKitAuth, // <-- Added this
} = require('../controllers/gemAdController');

// Public Routes
router.get('/published', getPublishedGemAds);
router.get('/public/:id', getPublicGemAdById);

// Protected Routes (Require Auth)
router.get('/imagekit-auth', protect, getImageKitAuth); // <-- Secure Auth Route
router.post('/', protect, createGemAd);
router.get('/my-ads', protect, getMyGemAds);
router.get('/:id', protect, getGemAdById);
router.put('/:id', protect, updateGemAd);
router.delete('/:id', protect, deleteGemAd);

module.exports = router;