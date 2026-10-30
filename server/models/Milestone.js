const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  number: {
    type: Number,
    min: 1
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  startDate: {
    type: Date
  },
  dueDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'TODO', 'Pending', 'In Progress', 'Completed', 'Approved', 'Not Submitted', 'Pending Review'],
    default: 'PENDING'
  },
  completionPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  verifiedByGuide: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  guideComments: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Milestone', MilestoneSchema);

