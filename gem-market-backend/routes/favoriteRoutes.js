// routes/favoriteRoutes.js

const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  toggleFavorite,
  getMyFavorites,
  getMyFavoriteIds,
} = require('../controllers/favoriteController');

router.get('/', protect, getMyFavorites);
router.get('/ids', protect, getMyFavoriteIds);
router.put('/toggle/:id', protect, toggleFavorite);

module.exports = router;