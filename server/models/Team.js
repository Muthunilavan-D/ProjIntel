const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  role: {
    type: String,
    enum: ['LEADER', 'MEMBER'],
    default: 'MEMBER'
  },
  status: {
    type: String,
    enum: ['ACCEPTED', 'PENDING', 'DECLINED', 'EXPIRED'],
    default: 'PENDING'
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  }
}, { _id: true });

const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: function() {
      return `Team-${Date.now().toString().slice(-4)}`;
    }
  },
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  targetSize: {
    type: Number,
    required: true,
    min: 1,
    max: 4,
    default: 1
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  status: {
    type: String,
    enum: ['FORMING', 'FORMED', 'PROPOSED', 'DISBANDED'],
    default: 'FORMING'
  },
  members: [TeamMemberSchema],
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  academicYear: {
    type: String,
    default: '2026-2027',
    trim: true
  },
  batch: {
    type: String,
    default: '2023-2027',
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Team', TeamSchema);
