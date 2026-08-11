const Notification = require('../models/Notification');

// @desc    Get logged in user's notifications
// @route   GET /api/notifications
// @access  Private (User)
exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, notifications });
  } catch (err) {
    console.error('getMyNotifications error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private (User)
exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    notification.isRead = true;
    await notification.save();

    return res.json({ success: true, notification });
  } catch (err) {
    console.error('markNotificationRead error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
};

// @desc    Mark all of the logged in user's notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private (User)
exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('markAllNotificationsRead error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
};