// notificationRoutes.js

const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController');

router.get('/', protect, getMyNotifications);
router.put('/:id/read', protect, markNotificationRead);
router.put('/read-all', protect, markAllNotificationsRead);

module.exports = router;