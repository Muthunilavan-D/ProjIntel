const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Document = require('../models/Document');
const Project = require('../models/Project');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads/documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Format bytes to human readable string (KB / MB)
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// File filter for supported academic formats
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(pdf|doc|docx|ppt|pptx|zip|tar|gz|txt|png|jpg|jpeg)$/i;
  if (file.originalname.match(allowedExtensions)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, ZIP, PNG, and JPG are permitted.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max
});

// Helper to resolve Project ObjectId
async function resolveProjectId(projectId) {
  if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
    return projectId;
  }
  const proj = await Project.findOne({
    $or: [
      { title: new RegExp(projectId || '', 'i') }
    ]
  }) || await Project.findOne();
  return proj ? proj._id : null;
}

/**
 * POST /api/documents/upload
 * Upload a document with real multipart file upload and save metadata in DB.
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const {
      projectId,
      docType = 'Synopsis',
      version = '1.0',
      uploaderName = 'Student',
      uploaderId,
      uploaderModel = 'Student'
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file was uploaded.' });
    }

    const resolvedPId = await resolveProjectId(projectId);
    if (!resolvedPId) {
      return res.status(400).json({ success: false, error: 'Could not associate document with a valid project.' });
    }

    const projDoc = await Project.findById(resolvedPId);
    if (projDoc && !['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(projDoc.status)) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(403).json({
        success: false,
        error: 'Cannot upload project documents. Project proposal must be approved by the faculty guide first.'
      });
    }

    let resolvedUploaderId = uploaderId;
    if (!resolvedUploaderId || !mongoose.Types.ObjectId.isValid(resolvedUploaderId)) {
      const student = await Student.findOne() || null;
      resolvedUploaderId = student ? student._id : null;
    }

    const ext = path.extname(req.file.originalname).replace('.', '').toUpperCase();
    const formattedSize = formatBytes(req.file.size);
    const relativeFilePath = `/uploads/documents/${req.file.filename}`;

    const newDoc = await Document.create({
      project: resolvedPId,
      fileName: req.file.originalname,
      originalName: req.file.originalname,
      docType: docType,
      documentType: ext || 'PDF',
      version: version || '1.0',
      uploadedBy: resolvedUploaderId,
      uploaderName: uploaderName || 'Student',
      uploaderModel: uploaderModel || 'Student',
      uploadDate: new Date(),
      fileSize: formattedSize,
      filePath: relativeFilePath,
      fileUrl: relativeFilePath,
      mimeType: req.file.mimetype
    });

    res.status(201).json({
      success: true,
      message: `Document "${req.file.originalname}" uploaded successfully.`,
      data: newDoc
    });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to upload document.' });
  }
});

/**
 * GET /api/documents/project/:projectId
 * Retrieve all uploaded documents for a project.
 */
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const resolvedPId = await resolveProjectId(projectId);

    const query = resolvedPId ? { project: resolvedPId } : {};
    const docs = await Document.find(query).sort({ uploadDate: -1 });

    res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    console.error('Error fetching project documents:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch project documents.' });
  }
});

/**
 * GET /api/documents/all
 * Retrieve all repository documents across all projects for Faculty/Admin.
 */
router.get('/all', async (req, res) => {
  try {
    const docs = await Document.find()
      .populate('project', 'title dept leadName domain guide')
      .sort({ uploadDate: -1 });

    res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    console.error('Error fetching all repository documents:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch repository documents.' });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document from MongoDB and disk.
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    let doc = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      doc = await Document.findById(id);
    } else {
      doc = await Document.findOne({ fileName: id });
    }

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    // Try deleting file from disk
    if (doc.filePath) {
      const fullPath = path.join(__dirname, '..', doc.filePath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (fsErr) {
          console.warn('Could not remove file from disk:', fsErr.message);
        }
      }
    }

    await Document.findByIdAndDelete(doc._id);

    res.json({
      success: true,
      message: `Document "${doc.fileName}" deleted successfully.`
    });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ success: false, error: 'Failed to delete document.' });
  }
});

module.exports = router;
