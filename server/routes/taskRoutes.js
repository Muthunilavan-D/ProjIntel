const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Milestone = require('../models/Milestone');
const Project = require('../models/Project');
let { mockTasks, mockUsers } = require('../mockData');

// GET /api/tasks/project/:projectId — all tasks for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: mockTasks });
    }
    const { projectId } = req.params;
    let query = null;
    if (mongoose.Types.ObjectId.isValid(projectId)) {
      query = { project: new mongoose.Types.ObjectId(projectId) };
    } else {
      const proj = await Project.findOne({
        $or: [{ title: new RegExp(projectId, 'i') }]
      });
      if (proj) query = { project: proj._id };
    }

    if (!query) {
      return res.json({ success: true, data: [] });
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name regNo')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

// POST /api/tasks — create a new task
router.post('/', async (req, res) => {
  try {
    let { project, milestone, milestoneId, title, description, priority, dueDate, assignedTo } = req.body;
    milestone = milestone || milestoneId;

    if (mongoose.connection.readyState !== 1) {
      const newTask = {
        _id: 'task_' + Date.now(),
        id: 'task_' + Date.now(),
        project: project || 'proj_1',
        milestone: milestone || 'ms_3',
        title: title || 'New Presentation Task',
        description: description || '',
        priority: priority || 'MEDIUM',
        dueDate: dueDate || new Date().toISOString(),
        assignedTo: mockUsers.student,
        status: 'TODO'
      };
      mockTasks.unshift(newTask);
      return res.status(201).json({ success: true, data: newTask });
    }

    // Resolve Project ObjectId
    let resolvedProjectId = project;
    if (!resolvedProjectId || !mongoose.Types.ObjectId.isValid(resolvedProjectId)) {
      const p = await Project.findById(project).catch(() => null) 
             || await Project.findOne({ title: new RegExp(project || '', 'i') })
             || await Project.findOne();
      if (p) resolvedProjectId = p._id;
    }

    if (resolvedProjectId) {
      const p = await Project.findById(resolvedProjectId);
      if (p && !['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(p.status)) {
        return res.status(403).json({
          success: false,
          error: 'Cannot create tasks. Project proposal must be approved by the faculty guide first.'
        });
      }
    }

    // Resolve Milestone ObjectId
    let resolvedMilestoneId = milestone;
    if (!resolvedMilestoneId || !mongoose.Types.ObjectId.isValid(resolvedMilestoneId)) {
      let milestoneNum = null;
      if (typeof milestone === 'string' && /^m\d+$/i.test(milestone)) {
        milestoneNum = parseInt(milestone.replace(/m/i, ''), 10);
      }
      let targetMilestone = null;
      if (milestoneNum && resolvedProjectId) {
        targetMilestone = await Milestone.findOne({ project: resolvedProjectId, number: milestoneNum });
      }
      if (!targetMilestone && resolvedProjectId) {
        targetMilestone = await Milestone.findOne({ project: resolvedProjectId }).sort({ number: 1 });
      }
      if (targetMilestone) {
        resolvedMilestoneId = targetMilestone._id;
      }
    }

    // Sanitize assignedTo
    let validAssignedTo = undefined;
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
      validAssignedTo = assignedTo;
    } else if (assignedTo && assignedTo._id && mongoose.Types.ObjectId.isValid(assignedTo._id)) {
      validAssignedTo = assignedTo._id;
    }

    // Sanitize dueDate
    let validDueDate = undefined;
    if (dueDate) {
      const d = new Date(dueDate);
      if (!isNaN(d.getTime())) validDueDate = d;
    }

    const task = new Task({
      project: resolvedProjectId,
      milestone: resolvedMilestoneId,
      title: title || 'New Task',
      description: description || '',
      priority: (priority || 'MEDIUM').toUpperCase(),
      dueDate: validDueDate,
      assignedTo: validAssignedTo,
      status: 'TODO'
    });

    await task.save();

    // Recalculate milestone progress after creating new task
    if (task.milestone) {
      try {
        const total = await Task.countDocuments({ milestone: task.milestone });
        const completed = await Task.countDocuments({ 
          milestone: task.milestone, 
          status: { $in: ['COMPLETED', 'Completed'] } 
        });
        if (total > 0) {
          const pct = Math.round((completed / total) * 100);
          await Milestone.findByIdAndUpdate(task.milestone, {
            $set: {
              completionPercentage: pct,
              status: pct === 100 ? 'COMPLETED' : (pct > 0 ? 'IN_PROGRESS' : 'PENDING')
            }
          });
          const allMs = await Milestone.find({ project: resolvedProjectId || task.project });
          if (allMs.length > 0) {
            const sum = allMs.reduce((acc, m) => acc + (m._id.toString() === task.milestone.toString() ? pct : (m.completionPercentage || 0)), 0);
            await Project.findByIdAndUpdate(resolvedProjectId || task.project, { progress: Math.round(sum / allMs.length) });
          }
        }
        if (resolvedProjectId) {
          await Project.findOneAndUpdate(
            { _id: resolvedProjectId, status: { $in: ['APPROVED', 'Approved'] } },
            { $set: { status: 'IN_PROGRESS' } }
          );
        }
      } catch (calcErr) {
        console.warn('Milestone recalculation error:', calcErr.message);
      }
    }

    const populated = await Task.findById(task._id).populate('assignedTo', 'name regNo');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.warn('Error creating task, falling back:', err.message);
    const newTask = {
      _id: 'task_' + Date.now(),
      id: 'task_' + Date.now(),
      title: req.body.title || 'New Task',
      status: 'TODO',
      priority: req.body.priority || 'MEDIUM',
      assignedTo: mockUsers.student
    };
    mockTasks.unshift(newTask);
    res.status(201).json({ success: true, data: newTask });
  }
});

// PUT /api/tasks/:id — update task status or details
router.put('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const t = mockTasks.find(item => item._id === req.params.id || item.id === req.params.id);
      if (t) {
        Object.assign(t, req.body);
        return res.json({ success: true, data: t });
      }
      return res.json({ success: true, data: { ...req.body, id: req.params.id } });
    }

    if (req.body.milestoneId && !req.body.milestone) {
      req.body.milestone = req.body.milestoneId;
    }
    delete req.body.milestoneId;

    if (req.body.milestone && !mongoose.Types.ObjectId.isValid(req.body.milestone)) {
      let milestoneNum = null;
      if (typeof req.body.milestone === 'string' && /^m\d+$/i.test(req.body.milestone)) {
        milestoneNum = parseInt(req.body.milestone.replace(/m/i, ''), 10);
      }
      let targetMilestone = null;
      if (milestoneNum) {
        const existingTask = await Task.findById(req.params.id);
        if (existingTask) {
          targetMilestone = await Milestone.findOne({ project: existingTask.project, number: milestoneNum });
        }
      }
      if (targetMilestone) {
        req.body.milestone = targetMilestone._id;
      } else {
        delete req.body.milestone;
      }
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).populate('assignedTo', 'name regNo');

    if (!task) return res.status(404).json({ success: false, error: 'Task not found.' });

    // Automatically recalculate milestone progress and project overall progress
    if (task.milestone) {
      try {
        const total = await Task.countDocuments({ milestone: task.milestone });
        const completed = await Task.countDocuments({ 
          milestone: task.milestone, 
          status: { $in: ['COMPLETED', 'Completed'] } 
        });
        if (total > 0) {
          const pct = Math.round((completed / total) * 100);
          await Milestone.findByIdAndUpdate(task.milestone, {
            $set: {
              completionPercentage: pct,
              status: pct === 100 ? 'COMPLETED' : (pct > 0 ? 'IN_PROGRESS' : 'PENDING')
            }
          });
          if (task.project) {
            const allMs = await Milestone.find({ project: task.project });
            if (allMs.length > 0) {
              const sum = allMs.reduce((acc, m) => acc + (m._id.toString() === task.milestone.toString() ? pct : (m.completionPercentage || 0)), 0);
              await Project.findByIdAndUpdate(task.project, { progress: Math.round(sum / allMs.length) });
            }
          }
        }
        if (task.project) {
          await Project.findOneAndUpdate(
            { _id: task.project, status: { $in: ['APPROVED', 'Approved'] } },
            { $set: { status: 'IN_PROGRESS' } }
          );
        }
      } catch (calcErr) {
        console.warn('Recalculation error:', calcErr.message);
      }
    }

    res.json({ success: true, data: task });
  } catch (err) {
    const t = mockTasks.find(item => item._id === req.params.id || item.id === req.params.id);
    if (t) Object.assign(t, req.body);
    res.json({ success: true, data: t || { ...req.body, id: req.params.id } });
  }
});

// DELETE /api/tasks/:id — delete a task
router.delete('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      mockTasks = mockTasks.filter(item => item._id !== req.params.id && item.id !== req.params.id);
      return res.json({ success: true, message: 'Task deleted.' });
    }
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found.' });

    const milestoneId = task.milestone;
    const projectId = task.project;

    await Task.findByIdAndDelete(req.params.id);

    // Recalculate milestone progress
    if (milestoneId) {
      try {
        const total = await Task.countDocuments({ milestone: milestoneId });
        const completed = await Task.countDocuments({
          milestone: milestoneId,
          status: { $in: ['COMPLETED', 'Completed'] }
        });
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        await Milestone.findByIdAndUpdate(milestoneId, {
          $set: {
            completionPercentage: pct,
            status: pct === 100 ? 'COMPLETED' : (pct > 0 ? 'IN_PROGRESS' : 'PENDING')
          }
        });
        if (projectId) {
          const allMs = await Milestone.find({ project: projectId });
          if (allMs.length > 0) {
            const sum = allMs.reduce((acc, m) => acc + (m._id.toString() === milestoneId.toString() ? pct : (m.completionPercentage || 0)), 0);
            await Project.findByIdAndUpdate(projectId, { progress: Math.round(sum / allMs.length) });
          }
        }
      } catch (e) {}
    }

    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    mockTasks = mockTasks.filter(item => item._id !== req.params.id && item.id !== req.params.id);
    res.json({ success: true, message: 'Task deleted.' });
  }
});

module.exports = router;
