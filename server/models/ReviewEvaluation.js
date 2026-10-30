const mongoose = require('mongoose');

const ReviewEvaluationSchema = new mongoose.Schema({
  review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    required: true,
    index: true
  },
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReviewSubmission',
    required: false,
    index: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false,
    index: true
  },
  evaluator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  evaluationType: {
    type: String,
    enum: ['FACULTY', 'AI_SUGGESTED'],
    default: 'FACULTY',
    required: true
  },
  marks: {
    type: Number,
    required: true,
    min: 0
  },
  maxMarks: {
    type: Number,
    required: true,
    default: 50
  },
  grade: {
    type: String,
    enum: ['O', 'A+', 'A', 'B+', 'B', 'C', 'RA'],
    default: 'A'
  },
  rubricBreakdown: [{
    criterion: { type: String, required: true },
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    remarks: { type: String, default: '' }
  }],
  strengths: [{
    type: String
  }],
  weaknesses: [{
    type: String
  }],
  comments: {
    type: String,
    required: true
  },
  feedback: {
    type: String,
    default: ''
  },
  evaluatedTime: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

ReviewEvaluationSchema.index({ review: 1, project: 1, evaluationType: 1 });

module.exports = mongoose.model('ReviewEvaluation', ReviewEvaluationSchema);
