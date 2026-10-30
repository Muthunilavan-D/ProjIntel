const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

const mongoose = require('mongoose');
const { mockNotifications } = require('../mockData');

// GET /api/notifications/:userId — get notifications for a user
router.get('/:userId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ 
        success: true, 
        data: mockNotifications, 
        unreadCount: mockNotifications.filter(n => !n.read).length 
      });
    }
    const notifications = await Notification.find({ recipient: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    res.json({ 
      success: true, 
      data: mockNotifications, 
      unreadCount: mockNotifications.filter(n => !n.read).length 
    });
  }
});

// POST /api/notifications — create a notification
router.post('/', async (req, res) => {
  try {
    const { recipient, recipientModel, type, title, message, link } = req.body;
    const notification = new Notification({
      recipient,
      recipientModel: recipientModel || 'Student',
      type: type || 'info',
      title,
      message,
      link,
      isRead: false
    });
    await notification.save();
    res.status(201).json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create notification.' });
  }
});

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, error: 'Notification not found.' });
    res.json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark notification as read.' });
  }
});

// PUT /api/notifications/user/:userId/read-all — mark all read for a user
router.put('/user/:userId/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.params.userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark all as read.' });
  }
});

module.exports = router;
