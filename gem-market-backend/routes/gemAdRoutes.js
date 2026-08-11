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
} = require('../controllers/gemAdController');

router.post('/', protect, createGemAd);
router.get('/published', getPublishedGemAds);
router.get('/my-ads', protect, getMyGemAds);
router.get('/:id', protect, getGemAdById);
router.put('/:id', protect, updateGemAd);
router.delete('/:id', protect, deleteGemAd);

module.exports = router;