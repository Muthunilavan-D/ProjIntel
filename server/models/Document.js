const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    trim: true
  },
  docType: {
    type: String,
    default: 'Synopsis'
  },
  documentType: {
    type: String,
    default: 'PDF'
  },
  version: {
    type: String,
    required: true,
    default: '1.0'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'uploaderModel'
  },
  uploaderName: {
    type: String,
    default: 'Student'
  },
  uploaderModel: {
    type: String,
    enum: ['Student', 'Faculty', 'Admin'],
    default: 'Student'
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  fileSize: {
    type: String,
    default: '1.0 MB'
  },
  filePath: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String
  },
  mimeType: {
    type: String
  }
}, {
  timestamps: true
});

DocumentSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model('Document', DocumentSchema);
