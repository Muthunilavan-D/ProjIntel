const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  abstract: {
    type: String
  },
  problemStatement: {
    type: String,
    required: true
  },
  objectives: [{
    type: String
  }],
  domain: {
    type: String,
    required: true,
    trim: true
  },
  technologies: [{
    type: String,
    trim: true
  }],
  teamMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  status: {
    type: String,
    required: true,
    enum: [
      'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'Approved',
      'REVISION_REQUIRED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'Waiting'
    ],
    default: 'DRAFT'
  },
  guide: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  revisionNotes: {
    type: String,
    default: null
  },
  submittedDate: {
    type: Date
  },
  approvedDate: {
    type: Date
  },
  comments: [{
    author: String,
    text: String,
    time: { type: mongoose.Schema.Types.Mixed, default: Date.now },
    isGuide: Boolean
  }],
  batch: {
    type: String,
    default: '2023-2027',
    trim: true
  },
  academicYear: {
    type: String,
    default: '2026-2027',
    trim: true
  },
  completedDate: {
    type: Date
  },
  finalSignedByGuide: {
    type: Boolean,
    default: false
  },
  finalSignOffNotes: {
    type: String,
    default: ''
  },
  finalGrade: {
    type: String,
    default: 'A+',
    trim: true
  },
  finalScore: {
    type: Number,
    default: null
  },
  ieeeDetails: {
    paperTitle: { type: String, default: '' },
    conferenceName: { type: String, default: '' },
    conferenceDate: { type: String, default: '' },
    latestDraft: {
      fileName: { type: String, default: '' },
      originalName: { type: String, default: '' },
      filePath: { type: String, default: '' },
      fileSize: { type: String, default: '' },
      uploadedAt: { type: Date, default: null },
      version: { type: Number, default: 0 }
    },
    previousDraft: {
      fileName: { type: String, default: '' },
      originalName: { type: String, default: '' },
      filePath: { type: String, default: '' },
      fileSize: { type: String, default: '' },
      uploadedAt: { type: Date, default: null },
      version: { type: Number, default: 0 }
    },
    isSubmitted: { type: Boolean, default: false },
    submissionProof: {
      fileName: { type: String, default: '' },
      originalName: { type: String, default: '' },
      filePath: { type: String, default: '' },
      fileSize: { type: String, default: '' },
      uploadedAt: { type: Date, default: null }
    },
    isAccepted: { type: Boolean, default: false },
    acceptanceProof: {
      fileName: { type: String, default: '' },
      originalName: { type: String, default: '' },
      filePath: { type: String, default: '' },
      fileSize: { type: String, default: '' },
      uploadedAt: { type: Date, default: null }
    },
    isPublished: { type: Boolean, default: false },
    publicationProof: {
      fileName: { type: String, default: '' },
      originalName: { type: String, default: '' },
      filePath: { type: String, default: '' },
      fileSize: { type: String, default: '' },
      uploadedAt: { type: Date, default: null }
    },
    updatedAt: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', ProjectSchema);

