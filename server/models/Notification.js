const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientModel',
    required: true
  },
  recipientModel: {
    type: String,
    enum: ['Student', 'Faculty', 'Admin'],
    default: 'Student'
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    enum: ['Student', 'Faculty', 'Admin'],
    default: 'Admin'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'REVISION_REQUEST',
      'FEEDBACK', 'DEADLINE', 'STATUS_CHANGE', 'proposal approval/rejection',
      'revision request', 'faculty feedback', 'upcoming deadlines',
      'project status change'
    ],
    default: 'STATUS_CHANGE'
  },
  read: {
    type: Boolean,
    default: false
  },
  createdDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', NotificationSchema);
