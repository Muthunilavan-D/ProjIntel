const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Milestone = require('../models/Milestone');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { mockMilestones } = require('../mockData');

// Helper to renumber milestone title while preserving rest of title
function renumberMilestoneTitle(title, newNumber) {
  if (!title) return `Stage ${newNumber}`;
  const stageRegex = /^(Stage|Milestone)\s*\d+(\s*[:\-–]\s*|\s+)?(.*)$/i;
  const match = title.match(stageRegex);
  if (match) {
    const prefix = match[1];
    const delim = match[2] ? (match[2].includes(':') ? ': ' : match[2].includes('-') ? ' - ' : ' ') : ': ';
    const rest = (match[3] || '').trim();
    return rest ? `${prefix} ${newNumber}${delim}${rest}` : `${prefix} ${newNumber}`;
  }
  return title;
}

// Helper to sequentially normalize milestone numbers and titles for a project
async function normalizeProjectMilestones(projectId) {
  try {
    if (!projectId) return [];
    const milestones = await Milestone.find({ project: projectId }).sort({ number: 1, createdAt: 1 });
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      const newNum = i + 1;
      const newTitle = renumberMilestoneTitle(m.title, newNum);
      if (m.number !== newNum || m.title !== newTitle) {
        await Milestone.findByIdAndUpdate(m._id, {
          $set: { number: newNum, title: newTitle }
        });
        m.number = newNum;
        m.title = newTitle;
      }
    }
    return milestones;
  } catch (err) {
    console.error('normalizeProjectMilestones error:', err);
    return [];
  }
}

// Helper to recalculate overall project progress from milestones
async function recalculateProjectProgress(projectId) {
  try {
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) return;
    const milestones = await Milestone.find({ project: projectId });
    if (milestones.length === 0) return;
    const sum = milestones.reduce((acc, m) => acc + (m.completionPercentage || 0), 0);
    const avg = Math.round(sum / milestones.length);
    await Project.findByIdAndUpdate(projectId, { progress: avg });
    return avg;
  } catch (e) {
    console.warn('recalculateProjectProgress error:', e.message);
  }
}

// GET /api/milestones/project/:projectId — get all milestones for a project with task statistics
router.get('/project/:projectId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: mockMilestones });
    }
    const { projectId } = req.params;
    let query = null;
    let resolvedId = null;
    if (mongoose.Types.ObjectId.isValid(projectId)) {
      resolvedId = new mongoose.Types.ObjectId(projectId);
      query = { project: resolvedId };
    } else {
      const proj = await Project.findOne({
        $or: [{ title: new RegExp(projectId, 'i') }, { id: projectId }]
      });
      if (proj) {
        resolvedId = proj._id;
        query = { project: proj._id };
      }
    }

    if (!query) {
      return res.json({ success: true, data: [] });
    }

    // Automatically heal and ensure strictly sequential stage numbers
    if (resolvedId) {
      await normalizeProjectMilestones(resolvedId);
    }

    const milestones = await Milestone.find(query).sort({ number: 1 }).lean();

    // Attach task count statistics for each milestone
    const enriched = await Promise.all(
      milestones.map(async (m) => {
        const totalTasks = await Task.countDocuments({ milestone: m._id });
        const completedTasks = await Task.countDocuments({
          milestone: m._id,
          status: { $in: ['COMPLETED', 'Completed'] }
        });
        return {
          ...m,
          id: m._id,
          totalTasks,
          completedTasks
        };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('GET /api/milestones/project/:projectId error:', err);
    res.json({ success: true, data: [] });
  }
});

// POST /api/milestones — dynamically create a new milestone (student or guide)
router.post('/', async (req, res) => {
  try {
    const { projectId, project, title, description, dueDate, startDate, number, status } = req.body;
    const resolvedProjectId = projectId || project;

    if (!resolvedProjectId) {
      return res.status(400).json({ success: false, error: 'Project ID is required.' });
    }

    let pDoc = null;
    if (mongoose.Types.ObjectId.isValid(resolvedProjectId)) {
      pDoc = await Project.findById(resolvedProjectId);
    } else {
      pDoc = await Project.findOne({
        $or: [{ title: new RegExp(resolvedProjectId, 'i') }, { id: resolvedProjectId }]
      });
    }

    if (!pDoc) {
      return res.status(404).json({ success: false, error: 'Project not found.' });
    }

    if (!['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(pDoc.status)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot add milestones. Project proposal must be approved by the faculty guide first.'
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Milestone title is required.' });
    }

    // Determine sequence number if not explicitly specified
    let milestoneNumber = number ? parseInt(number, 10) : null;
    if (!milestoneNumber || isNaN(milestoneNumber)) {
      const latest = await Milestone.findOne({ project: pDoc._id }).sort({ number: -1 });
      milestoneNumber = latest && latest.number ? latest.number + 1 : 1;
    }

    const now = new Date();
    const milestone = new Milestone({
      project: pDoc._id,
      number: milestoneNumber,
      title: title.trim(),
      description: description ? description.trim() : '',
      startDate: startDate ? new Date(startDate) : now,
      dueDate: dueDate ? new Date(dueDate) : new Date(now.getTime() + 14 * 86400000),
      status: status || 'PENDING',
      completionPercentage: 0,
      isCustom: true,
      verifiedByGuide: false
    });

    await milestone.save();

    // Recalculate project progress
    await recalculateProjectProgress(pDoc._id);

    res.status(201).json({
      success: true,
      data: {
        ...milestone.toObject(),
        id: milestone._id,
        totalTasks: 0,
        completedTasks: 0
      },
      message: 'Milestone added successfully.'
    });
  } catch (err) {
    console.error('POST /api/milestones error:', err);
    res.status(500).json({ success: false, error: 'Failed to create milestone: ' + err.message });
  }
});

// PUT /api/milestones/:id — update milestone details, dates, or progress
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, dueDate, status, progress, completionPercentage, number } = req.body;
    const pct = progress !== undefined ? progress : completionPercentage;

    const updates = {};
    if (title !== undefined && title.trim()) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (startDate !== undefined) updates.startDate = new Date(startDate);
    if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
    if (number !== undefined) updates.number = parseInt(number, 10);
    if (status !== undefined) updates.status = status;
    if (pct !== undefined) updates.completionPercentage = Math.min(100, Math.max(0, parseInt(pct, 10) || 0));

    const milestone = await Milestone.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Milestone not found.' });
    }

    // Recalculate overall project progress
    await recalculateProjectProgress(milestone.project);

    const totalTasks = await Task.countDocuments({ milestone: milestone._id });
    const completedTasks = await Task.countDocuments({
      milestone: milestone._id,
      status: { $in: ['COMPLETED', 'Completed'] }
    });

    res.json({
      success: true,
      data: {
        ...milestone.toObject(),
        id: milestone._id,
        totalTasks,
        completedTasks
      },
      message: 'Milestone updated successfully.'
    });
  } catch (err) {
    console.error('PUT /api/milestones/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/milestones/:id/verify — faculty guide signs off / verifies a milestone stage
router.post('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { guideComments } = req.body;

    const milestone = await Milestone.findById(id);
    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Milestone not found.' });
    }

    milestone.verifiedByGuide = true;
    milestone.verifiedAt = new Date();
    milestone.status = 'COMPLETED';
    milestone.completionPercentage = 100;
    if (guideComments && guideComments.trim()) {
      milestone.guideComments = guideComments.trim();
    }

    await milestone.save();

    // Recalculate project progress
    await recalculateProjectProgress(milestone.project);

    res.json({
      success: true,
      data: {
        ...milestone.toObject(),
        id: milestone._id
      },
      message: 'Milestone officially verified by faculty guide.'
    });
  } catch (err) {
    console.error('POST /api/milestones/:id/verify error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/milestones/:id/unverify — revoke / undo verification of a milestone stage
router.post('/:id/unverify', async (req, res) => {
  try {
    const { id } = req.params;
    const milestone = await Milestone.findById(id);
    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Milestone not found.' });
    }

    milestone.verifiedByGuide = false;
    milestone.verifiedAt = null;
    milestone.guideComments = '';

    // Recalculate milestone completion percentage based on its tasks
    const tasks = await Task.find({ milestone: id });
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    milestone.completionPercentage = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    milestone.status = milestone.completionPercentage === 100 ? 'COMPLETED' : milestone.completionPercentage > 0 ? 'IN_PROGRESS' : 'PENDING';

    await milestone.save();
    await recalculateProjectProgress(milestone.project);

    res.json({
      success: true,
      data: {
        ...milestone.toObject(),
        id: milestone._id
      },
      message: 'Milestone verification undone successfully.'
    });
  } catch (err) {
    console.error('POST /api/milestones/:id/unverify error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/milestones/:id — remove a custom milestone
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const milestone = await Milestone.findById(id);
    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Milestone not found.' });
    }

    const projectId = milestone.project;
    const proj = await Project.findById(projectId);
    if (proj && !['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(proj.status)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete milestones. Project proposal must be approved by the faculty guide first.'
      });
    }

    // Check if there are tasks under this milestone
    const taskCount = await Task.countDocuments({ milestone: id });
    if (taskCount > 0) {
      // Find an alternative milestone to reassign tasks, or delete them
      const fallback = await Milestone.findOne({ project: projectId, _id: { $ne: id } }).sort({ number: 1 });
      if (fallback) {
        await Task.updateMany({ milestone: id }, { $set: { milestone: fallback._id } });
      } else {
        await Task.deleteMany({ milestone: id });
      }
    }

    await Milestone.findByIdAndDelete(id);

    // Auto-renumber remaining milestones sequentially with no gaps
    await normalizeProjectMilestones(projectId);

    // Recalculate project progress
    await recalculateProjectProgress(projectId);

    // Fetch refreshed milestones with task statistics to send back
    const refreshed = await Milestone.find({ project: projectId }).sort({ number: 1 }).lean();
    const enriched = await Promise.all(
      refreshed.map(async (m) => {
        const totalTasks = await Task.countDocuments({ milestone: m._id });
        const completedTasks = await Task.countDocuments({
          milestone: m._id,
          status: { $in: ['COMPLETED', 'Completed'] }
        });
        return {
          ...m,
          id: m._id,
          totalTasks,
          completedTasks
        };
      })
    );

    res.json({
      success: true,
      data: enriched,
      message: 'Milestone deleted successfully. Remaining milestone stages automatically renumbered.'
    });
  } catch (err) {
    console.error('DELETE /api/milestones/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
