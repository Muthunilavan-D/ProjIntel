const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  milestone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Milestone',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'Low', 'Medium', 'High'],
    default: 'MEDIUM'
  },
  dueDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'Todo', 'In Progress', 'Completed', 'Overdue'],
    default: 'TODO'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Task', TaskSchema);
