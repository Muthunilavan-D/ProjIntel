const mongoose = require('mongoose');

const FacultySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  facultyId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: 8
  },
  role: {
    type: String,
    default: 'FACULTY',
    enum: ['FACULTY', 'Faculty', 'Guide']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  designation: {
    type: String,
    enum: [
      'Professor & Head',
      'Professor',
      'Associate Professor',
      'Assistant Professor I',
      'Assistant Professor II',
      'Assistant Professor III'
    ],
    default: 'Assistant Professor I'
  },
  maxProjects: {
    type: Number,
    default: 2
  },
  // Secure Email Change Verification
  pendingEmail: {
    type: String,
    lowercase: true,
    trim: true,
    default: null
  },
  emailVerificationOtp: {
    type: String,
    default: null
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  // Password Reset OTP and Token
  resetPasswordOtp: {
    type: String,
    default: null
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Faculty', FacultySchema);
