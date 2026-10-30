const express = require('express');
const router = express.Router();
const WeeklyProgress = require('../models/WeeklyProgress');
const Project = require('../models/Project');

const mongoose = require('mongoose');
let { mockWeeklyUpdates } = require('../mockData');

// GET /api/weekly-progress/project/:projectId
router.get('/project/:projectId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: mockWeeklyUpdates });
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

    const reports = await WeeklyProgress.find(query)
      .sort({ weekNumber: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

// POST /api/weekly-progress — student submits weekly report
router.post('/', async (req, res) => {
  try {
    const {
      project, projectId, student, submittedBy, weekNumber, workCompleted,
      problemsFaced, challengesFaced, nextWeekPlan, progressPct, progressPercentage, cumulativePercentage
    } = req.body;

    const targetProject = project || projectId;
    const finalProblems = problemsFaced || challengesFaced || '';
    const finalPlan = nextWeekPlan || '';
    const finalPct = Number(progressPercentage ?? progressPct ?? cumulativePercentage ?? 0);

    if (mongoose.connection.readyState !== 1) {
      const newReport = {
        _id: 'w_' + Date.now(),
        id: 'w_' + Date.now(),
        project: targetProject || 'proj_1',
        submittedBy: submittedBy || student,
        weekNumber: Number(weekNumber) || (mockWeeklyUpdates.length + 1),
        workCompleted: workCompleted || 'Weekly progress update.',
        problemsFaced: finalProblems,
        nextWeekPlan: finalPlan,
        progressPercentage: finalPct,
        submissionDate: new Date().toISOString(),
        status: 'SUBMITTED'
      };
      mockWeeklyUpdates.unshift(newReport);
      return res.status(201).json({ success: true, data: newReport });
    }

    if (targetProject) {
      let resolvedP = null;
      if (mongoose.Types.ObjectId.isValid(targetProject)) {
        resolvedP = await Project.findById(targetProject);
      } else {
        resolvedP = await Project.findOne({ $or: [{ title: new RegExp(targetProject, 'i') }, { id: targetProject }] });
      }
      if (resolvedP && !['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(resolvedP.status)) {
        return res.status(403).json({
          success: false,
          error: 'Cannot submit weekly progress. Project proposal must be approved by the faculty guide first.'
        });
      }
    }

    const report = new WeeklyProgress({
      project: targetProject,
      submittedBy: submittedBy || student,
      weekNumber: Number(weekNumber) || 1,
      workCompleted: workCompleted || 'Weekly progress update.',
      problemsFaced: finalProblems,
      nextWeekPlan: finalPlan,
      progressPercentage: finalPct,
      submissionDate: new Date(),
      status: 'SUBMITTED'
    });

    await report.save();

    // Advance project status to IN_PROGRESS if currently APPROVED
    try {
      if (targetProject && mongoose.Types.ObjectId.isValid(targetProject)) {
        const proj = await Project.findById(targetProject);
        if (proj && (proj.status === 'APPROVED' || proj.status === 'Approved')) {
          proj.status = 'IN_PROGRESS';
          await proj.save();
        }
      }
    } catch (pErr) {
      console.warn('Could not update project status on weekly progress submission:', pErr);
    }

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    console.error('POST /api/weekly-progress error:', err);
    if (mongoose.connection.readyState === 1) {
      return res.status(500).json({ success: false, error: err.message });
    }
    const newReport = {
      _id: 'w_' + Date.now(),
      id: 'w_' + Date.now(),
      weekNumber: Number(req.body.weekNumber) || (mockWeeklyUpdates.length + 1),
      workCompleted: req.body.workCompleted || 'Update submitted.',
      progressPercentage: Number(req.body.progressPercentage || 50),
      status: 'SUBMITTED'
    };
    mockWeeklyUpdates.unshift(newReport);
    res.status(201).json({ success: true, data: newReport });
  }
});

// PUT /api/weekly-progress/:id/grade — faculty provides feedback/evaluation on a report
router.put('/:id/grade', async (req, res) => {
  try {
    const { facultyScore, facultyFeedback, score, feedback } = req.body;
    const finalScore = facultyScore !== undefined ? facultyScore : score;
    const finalFeedback = facultyFeedback !== undefined ? facultyFeedback : feedback;

    if (mongoose.connection.readyState !== 1) {
      const rep = mockWeeklyUpdates.find(w => w._id === req.params.id || w.id === req.params.id);
      if (rep) {
        if (finalScore !== undefined && finalScore !== null && finalScore !== '') {
          rep.facultyScore = Number(finalScore);
        }
        rep.facultyFeedback = finalFeedback || '';
        rep.status = 'GRADED';
        return res.json({ success: true, data: rep });
      }
      return res.json({ success: true, data: { ...req.body, id: req.params.id, status: 'GRADED' } });
    }

    const updateFields = {
      facultyFeedback: finalFeedback || '',
      status: 'GRADED'
    };
    if (finalScore !== undefined && finalScore !== null && finalScore !== '') {
      updateFields.facultyScore = Number(finalScore);
    }

    let report = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      report = await WeeklyProgress.findByIdAndUpdate(
        req.params.id,
        { $set: updateFields },
        { new: true }
      );
    }

    if (!report) {
      const rep = mockWeeklyUpdates.find(w => w._id === req.params.id || w.id === req.params.id);
      if (rep) {
        rep.facultyFeedback = finalFeedback || '';
        rep.status = 'GRADED';
        return res.json({ success: true, data: rep });
      }
      return res.status(404).json({ success: false, error: 'Report not found.' });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    const rep = mockWeeklyUpdates.find(w => w._id === req.params.id || w.id === req.params.id);
    if (rep) {
      if (req.body.facultyScore !== undefined || req.body.score !== undefined) {
        rep.facultyScore = Number(req.body.facultyScore || req.body.score || 0);
      }
      rep.facultyFeedback = req.body.facultyFeedback || req.body.feedback || '';
      rep.status = 'GRADED';
    }
    res.json({ success: true, data: rep || { ...req.body, id: req.params.id } });
  }
});

// PUT /api/weekly-progress/:id — student edits weekly report (ONLY allowed before guide feedback)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { workCompleted, problemsFaced, nextWeekPlan, progressPercentage, progressPct } = req.body;
    const finalPct = progressPercentage !== undefined ? progressPercentage : progressPct;

    let report = null;
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      report = await WeeklyProgress.findById(id);
    }

    // Fallback to mockWeeklyUpdates if not found in DB or if non-ObjectId
    if (!report) {
      const rep = mockWeeklyUpdates.find(w => w._id === id || w.id === id);
      if (!rep) {
        return res.status(404).json({ success: false, error: 'Weekly report not found.' });
      }

      // Disallow edit if feedback from guide is already present
      if (rep.facultyFeedback || rep.feedback || rep.status === 'GRADED') {
        return res.status(403).json({
          success: false,
          error: 'Cannot edit weekly report. Faculty guide has already provided feedback.'
        });
      }

      if (workCompleted !== undefined) rep.workCompleted = String(workCompleted).trim();
      if (problemsFaced !== undefined) rep.problemsFaced = String(problemsFaced).trim();
      if (nextWeekPlan !== undefined) rep.nextWeekPlan = String(nextWeekPlan).trim();
      if (finalPct !== undefined && !isNaN(Number(finalPct))) {
        rep.progressPercentage = Math.max(0, Math.min(100, Number(finalPct)));
        rep.progressPct = rep.progressPercentage;
      }
      return res.json({ success: true, data: rep });
    }

    // Disallow edit if faculty feedback has already been provided
    if (report.facultyFeedback || report.status === 'GRADED') {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit weekly report. Faculty guide has already provided feedback.'
      });
    }

    if (workCompleted !== undefined) report.workCompleted = String(workCompleted).trim();
    if (problemsFaced !== undefined) report.problemsFaced = String(problemsFaced).trim();
    if (nextWeekPlan !== undefined) report.nextWeekPlan = String(nextWeekPlan).trim();
    if (finalPct !== undefined && !isNaN(Number(finalPct))) {
      report.progressPercentage = Math.max(0, Math.min(100, Number(finalPct)));
    }

    await report.save();
    return res.json({ success: true, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
