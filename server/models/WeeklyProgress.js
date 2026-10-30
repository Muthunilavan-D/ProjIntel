const mongoose = require('mongoose');

const WeeklyProgressSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  weekNumber: {
    type: Number,
    required: true
  },
  workCompleted: {
    type: String,
    required: true
  },
  problemsFaced: {
    type: String
  },
  nextWeekPlan: {
    type: String
  },
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
    default: 0
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  },
  submissionDate: {
    type: Date,
    default: Date.now
  },
  facultyScore: {
    type: Number,
    min: 0,
    max: 100
  },
  facultyFeedback: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['SUBMITTED', 'GRADED', 'PENDING'],
    default: 'SUBMITTED'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WeeklyProgress', WeeklyProgressSchema);
