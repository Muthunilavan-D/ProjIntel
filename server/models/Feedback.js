const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  weeklyProgress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WeeklyProgress'
  },
  facultyGuide: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  feedbackText: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  createdDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Feedback', FeedbackSchema);
