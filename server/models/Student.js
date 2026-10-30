const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
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
  regNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  role: {
    type: String,
    default: 'STUDENT',
    enum: ['STUDENT', 'Student']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  year: {
    type: Number,
    default: 4,
    min: 1,
    max: 6
  },
  yearOfStudy: {
    type: Number,
    default: 4,
    min: 1,
    max: 6
  },
  isPassedOut: {
    type: Boolean,
    default: false
  },
  academicStatus: {
    type: String,
    enum: ['ENROLLED', 'PASSED_OUT'],
    default: 'ENROLLED'
  },
  batch: {
    type: String,
    default: '2023-2027',
    trim: true
  },
  projectHistory: [{
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    academicYear: {
      type: String,
      trim: true
    },
    yearOfStudy: {
      type: Number,
      min: 1,
      max: 4
    },
    grade: {
      type: String,
      trim: true
    },
    score: {
      type: Number
    },
    status: {
      type: String,
      default: 'COMPLETED'
    },
    completedDate: {
      type: Date
    }
  }]
}, {
  timestamps: true
});

StudentSchema.pre('save', function () {
  if (this.yearOfStudy && !this.year) this.year = this.yearOfStudy;
  if (this.year && !this.yearOfStudy) this.yearOfStudy = this.year;
});

module.exports = mongoose.model('Student', StudentSchema);
