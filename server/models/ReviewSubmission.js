const mongoose = require('mongoose');

const ReviewSubmissionSchema = new mongoose.Schema({
  review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    required: true,
    index: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String
  },
  documentType: {
    type: String,
    enum: ['PDF', 'PPT', 'PPTX', 'DOC', 'DOCX', 'ZIP'],
    default: 'PDF'
  },
  fileSize: {
    type: String,
    default: '1.5 MB'
  },
  notes: {
    type: String,
    default: ''
  },
  progressSummary: {
    type: String,
    default: ''
  },
  presentationFile: {
    type: String,
    default: ''
  },
  presentationPath: {
    type: String,
    default: ''
  },
  presentationUrl: {
    type: String,
    default: ''
  },
  demoUrl: {
    type: String,
    default: ''
  },
  keyAchievements: [{
    type: String
  }],
  roadblocks: {
    type: String,
    default: ''
  },
  submissionTime: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['SUBMITTED', 'LATE', 'REVIEWED'],
    default: 'SUBMITTED'
  }
}, {
  timestamps: true
});

// Composite unique index to avoid multiple active submissions per review/project
ReviewSubmissionSchema.index({ review: 1, project: 1 }, { unique: true });

module.exports = mongoose.model('ReviewSubmission', ReviewSubmissionSchema);
