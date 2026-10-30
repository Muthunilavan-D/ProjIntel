const mongoose = require('mongoose');

const SystemSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'academic_settings'
  },
  currentAcademicYear: {
    type: String,
    required: true,
    default: '2026-2027',
    trim: true
  },
  availableBatches: [{
    type: String,
    trim: true
  }],
  updatedBy: {
    type: String,
    default: 'Admin'
  },
  snapshots: [{
    academicYear: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    transitionType: { type: String, enum: ['ADVANCE', 'REVERT', 'INITIAL'], default: 'ADVANCE' },
    studentsState: [{
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
      yearOfStudy: Number,
      year: Number,
      batch: String,
      isPassedOut: Boolean,
      academicStatus: String,
      project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
      team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }
    }]
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('SystemSetting', SystemSettingSchema);
