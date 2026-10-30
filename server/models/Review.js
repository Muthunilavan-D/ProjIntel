const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false,
    index: true
  },
  guide: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: false,
    index: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    index: true
  },
  yearOfStudy: {
    type: Number,
    enum: [1, 2, 3, 4],
    default: 4,
    index: true
  },
  batch: {
    type: String,
    default: '2023-2027',
    trim: true,
    index: true
  },
  academicYear: {
    type: String,
    default: '2026-2027',
    trim: true,
    index: true
  },
  venue: {
    type: String,
    trim: true,
    default: 'Seminar Hall / Online'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  reviewType: {
    type: String,
    default: 'REVIEW_1',
    trim: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  deadline: {
    type: Date,
    required: true
  },
  instructions: {
    type: String,
    required: true,
    default: 'Upload presentation slides (PPT/PPTX) and technical report (PDF) covering all milestone deliverables.'
  },
  requiredDocType: {
    type: String,
    enum: ['PDF', 'PPT', 'PPTX', 'DOCX', 'ZIP', 'ALL'],
    default: 'ALL'
  },
  maxMarks: {
    type: Number,
    required: true,
    min: 10,
    max: 100,
    default: 50
  },
  rubricCriteria: [{
    name: { type: String, required: true },
    maxScore: { type: Number, required: true },
    description: { type: String }
  }],
  status: {
    type: String,
    enum: ['SCHEDULED', 'IN_PROGRESS', 'ONGOING', 'COMPLETED', 'CANCELLED', 'POSTPONED', 'RESCHEDULED'],
    default: 'SCHEDULED'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Review', ReviewSchema);
