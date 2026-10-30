const express = require('express');
const router = express.Router();

const { isGroqConfigured } = require('../services/ai/groqClient');
const { explainProjectRisk } = require('../services/ai/riskExplainer');
const { analyzeProposal, analyzeFeasibility } = require('../services/ai/proposalAnalyzer');
const { prioritizeTasks } = require('../services/ai/taskPrioritizer');
const { generateProjectSummary } = require('../services/ai/projectSummary');
const { analyzeWeeklyReport } = require('../services/ai/reportAnalyzer');
const { generateFacultyFeedback } = require('../services/ai/feedbackGenerator');
const { analyzeProjectSimilarity } = require('../services/ai/similarityService');
const { analyzeFacultyWorkload, recommendFacultyAssignment } = require('../services/ai/workloadService');
const { generateAcademicInsights } = require('../services/ai/academicInsights');
const { processAssistantChat } = require('../services/ai/assistantService');
const { calculateProjectRisk } = require('../services/ai/riskEngine');

const mongoose = require('mongoose');
const Task = require('../models/Task');
const Milestone = require('../models/Milestone');
const WeeklyProgress = require('../models/WeeklyProgress');
const Document = require('../models/Document');
const Project = require('../models/Project');

async function ensureProjectData(inputProject) {
  if (!inputProject) return null;
  let project = typeof inputProject === 'object' ? { ...inputProject } : {};
  const projectId = project._id || project.id || (typeof inputProject === 'string' ? inputProject : null);

  if (projectId && mongoose.Types.ObjectId.isValid(projectId) && mongoose.connection.readyState === 1) {
    if (!project.title || !project.domain) {
      try {
        const dbProj = await Project.findById(projectId)
          .populate('guide', 'name facultyId staffId')
          .populate('department', 'name code')
          .lean();
        if (dbProj) {
          project = { ...dbProj, ...project };
        }
      } catch (_) {}
    }
    if (!project.milestones || project.milestones.length === 0) {
      try {
        const dbMilestones = await Milestone.find({ project: projectId }).sort({ number: 1 }).lean();
        if (dbMilestones && dbMilestones.length > 0) {
          project.milestones = dbMilestones;
        }
      } catch (_) {}
    }
    if (!project.tasks || project.tasks.length === 0) {
      try {
        const dbTasks = await Task.find({ project: projectId }).lean();
        if (dbTasks && dbTasks.length > 0) {
          project.tasks = dbTasks;
        }
      } catch (_) {}
    }
    if (!project.weeklyUpdates || project.weeklyUpdates.length === 0) {
      try {
        const dbReports = await WeeklyProgress.find({ project: projectId }).sort({ weekNumber: -1 }).lean();
        if (dbReports && dbReports.length > 0) {
          project.weeklyUpdates = dbReports;
        }
      } catch (_) {}
    }
    if (!project.documents || project.documents.length === 0) {
      try {
        const dbDocs = await Document.find({ project: projectId }).sort({ createdAt: -1 }).lean();
        if (dbDocs && dbDocs.length > 0) {
          project.documents = dbDocs;
        }
      } catch (_) {}
    }
  }
  return project;
}

// 1. Health & Config status
router.get('/health', (req, res) => {
  const configured = isGroqConfigured();
  res.json({
    status: 'ok',
    configured,
    message: configured ? 'AI service is online and configured.' : 'AI service is not configured. Please configure the Groq API key.'
  });
});

// 2. Deterministic Risk calculation only
router.post('/risk-calculate', async (req, res) => {
  try {
    const project = await ensureProjectData(req.body.project);
    const result = calculateProjectRisk(project);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to calculate deterministic project risk.' });
  }
});

// 3. Project Risk Explanation
router.post('/risk-explanation', async (req, res) => {
  try {
    const project = await ensureProjectData(req.body.project);
    const result = await explainProjectRisk(project);
    res.json(result);
  } catch (err) {
    console.error('Error in /risk-explanation:', err);
    res.status(500).json({ success: false, error: 'An error occurred during risk explanation.' });
  }
});

// 4. Proposal Analysis
router.post('/proposal-analysis', async (req, res) => {
  try {
    const proposal = req.body.proposal || req.body.project;
    const result = await analyzeProposal(proposal);
    res.json(result);
  } catch (err) {
    console.error('Error in /proposal-analysis:', err);
    res.status(500).json({ success: false, error: 'An error occurred during proposal analysis.' });
  }
});

// 5. Feasibility Analysis
router.post('/feasibility-analysis', async (req, res) => {
  try {
    const proposal = req.body.proposal || req.body.project;
    const result = await analyzeFeasibility(proposal);
    res.json(result);
  } catch (err) {
    console.error('Error in /feasibility-analysis:', err);
    res.status(500).json({ success: false, error: 'An error occurred during feasibility analysis.' });
  }
});

// 6. Task Prioritization
router.post('/task-prioritization', async (req, res) => {
  try {
    const project = await ensureProjectData(req.body.project);
    const result = await prioritizeTasks(project);
    res.json(result);
  } catch (err) {
    console.error('Error in /task-prioritization:', err);
    res.status(500).json({ success: false, error: 'An error occurred during task prioritization.' });
  }
});

// 7. Project Summary
router.post('/project-summary', async (req, res) => {
  try {
    const project = await ensureProjectData(req.body.project);
    const result = await generateProjectSummary(project);
    res.json(result);
  } catch (err) {
    console.error('Error in /project-summary:', err);
    res.status(500).json({ success: false, error: 'An error occurred during project summary generation.' });
  }
});

// 8. Weekly Report Analysis
router.post('/report-analysis', async (req, res) => {
  try {
    const project = await ensureProjectData(req.body.project);
    const { report } = req.body;
    const result = await analyzeWeeklyReport(report, project);
    res.json(result);
  } catch (err) {
    console.error('Error in /report-analysis:', err);
    res.status(500).json({ success: false, error: 'An error occurred during weekly report analysis.' });
  }
});

// 9. Generate Faculty Feedback
router.post('/generate-feedback', async (req, res) => {
  try {
    const { notes, context } = req.body;
    const result = await generateFacultyFeedback(notes, context);
    res.json(result);
  } catch (err) {
    console.error('Error in /generate-feedback:', err);
    res.status(500).json({ success: false, error: 'An error occurred during feedback generation.' });
  }
});

// 10. Project Similarity Detection (Strictly within same Year/Batch and Department)
router.post('/project-similarity', async (req, res) => {
  try {
    const { project } = req.body;
    let candidateProjects = Array.isArray(req.body.allProjects) ? req.body.allProjects : [];

    // Query DB for candidate projects strictly within the same year/batch and department
    if (mongoose.connection.readyState === 1 && project) {
      try {
        const Department = require('../models/Department');
        const SystemSetting = require('../models/SystemSetting');
        
        let deptId = null;
        let deptName = project.dept || (typeof project.department === 'string' ? project.department : project.department?.name);

        if (project.department && mongoose.Types.ObjectId.isValid(project.department)) {
          deptId = new mongoose.Types.ObjectId(project.department);
          if (!deptName) {
            const dDoc = await Department.findById(deptId).lean();
            if (dDoc) deptName = dDoc.name;
          }
        } else if (deptName) {
          const dDoc = await Department.findOne({
            $or: [
              { name: new RegExp(`^${deptName.trim()}$`, 'i') },
              { code: new RegExp(`^${deptName.trim()}$`, 'i') }
            ]
          }).lean();
          if (dDoc) {
            deptId = dDoc._id;
            deptName = dDoc.name;
          }
        }

        // Determine target batch and academic year
        let targetBatch = project.batch;
        let targetAcadYear = project.academicYear;

        if (!targetBatch || !targetAcadYear) {
          const sys = await SystemSetting.findOne({}).lean();
          if (!targetAcadYear) targetAcadYear = sys?.currentAcademicYear || '2026-2027';
          if (!targetBatch) {
            const startYr = parseInt(targetAcadYear.split('-')[0], 10);
            targetBatch = !isNaN(startYr) ? `${startYr - 3}-${startYr + 1}` : '2023-2027';
          }
        }

        const queryFilter = {
          status: { $ne: 'REJECTED' }
        };

        // Exclude the project itself if it has an ID
        const targetId = project._id || project.id;
        if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
          queryFilter._id = { $ne: new mongoose.Types.ObjectId(targetId) };
        }

        // Department filter (match either ObjectId or dept string)
        if (deptId) {
          queryFilter.$or = [
            { department: deptId },
            ...(deptName ? [{ dept: new RegExp(deptName, 'i') }] : [])
          ];
        } else if (deptName) {
          queryFilter.dept = new RegExp(deptName, 'i');
        }

        // Strict Year / Batch filter
        const batchConditions = [];
        if (targetBatch) batchConditions.push({ batch: targetBatch });
        if (targetAcadYear) batchConditions.push({ academicYear: targetAcadYear });
        if (batchConditions.length > 0) {
          if (queryFilter.$or) {
            queryFilter.$and = [
              { $or: queryFilter.$or },
              { $or: batchConditions }
            ];
            delete queryFilter.$or;
          } else {
            queryFilter.$or = batchConditions;
          }
        }

        const dbProjects = await Project.find(queryFilter)
          .select('title domain dept department batch academicYear technologies problemStatement abstract description')
          .populate('department', 'name code')
          .lean();

        if (dbProjects && dbProjects.length > 0) {
          candidateProjects = dbProjects;
        } else {
          // If no projects found in DB for this department and batch, return Safe Signal immediately
          return res.json({
            success: true,
            isSafe: true,
            hasSimilarProjects: false,
            maxSimilarityPct: 0,
            mostSimilarProjectId: null,
            mostSimilarProjectTitle: null,
            totalProjectsCompared: 0,
            scope: {
              department: deptName || 'Department',
              batch: targetBatch
            },
            comparisons: [],
            commonConcepts: [],
            recommendation: `Safe Signal: No existing projects found in ${deptName || 'your department'} for batch ${targetBatch}. Your proposal is completely novel!`
          });
        }
      } catch (dbErr) {
        console.warn('Error fetching department cohort projects for similarity:', dbErr.message);
      }
    }

    const result = await analyzeProjectSimilarity(project, candidateProjects);
    res.json(result);
  } catch (err) {
    console.error('Error in /project-similarity:', err);
    res.status(500).json({ success: false, error: 'An error occurred during project similarity analysis.' });
  }
});

// 11. Faculty Workload Analysis
router.post('/workload-analysis', async (req, res) => {
  try {
    const { projectsList, facultyList } = req.body;
    const result = await analyzeFacultyWorkload(projectsList, facultyList);
    res.json(result);
  } catch (err) {
    console.error('Error in /workload-analysis:', err);
    res.status(500).json({ success: false, error: 'An error occurred during workload analysis.' });
  }
});

// 12. Recommend Faculty Assignment
router.post('/recommend-faculty', async (req, res) => {
  try {
    const { project, facultyList, allProjects } = req.body;
    const result = await recommendFacultyAssignment(project, facultyList, allProjects);
    res.json(result);
  } catch (err) {
    console.error('Error in /recommend-faculty:', err);
    res.status(500).json({ success: false, error: 'An error occurred during faculty recommendation.' });
  }
});

// 13. Academic Intelligence Summary
router.post('/academic-insights', async (req, res) => {
  try {
    const { projectsList, facultyList } = req.body;
    const result = await generateAcademicInsights(projectsList, facultyList);
    res.json(result);
  } catch (err) {
    console.error('Error in /academic-insights:', err);
    res.status(500).json({ success: false, error: 'An error occurred during academic insights generation.' });
  }
});

// 14. Conversational Assistant
router.post('/chat', async (req, res) => {
  try {
    const { message, userRole, context, chatHistory } = req.body;
    const result = await processAssistantChat({ message, userRole, context, chatHistory });
    res.json(result);
  } catch (err) {
    console.error('Error in /chat:', err);
    res.status(500).json({ success: false, error: 'An error occurred during assistant chat processing.' });
  }
});

// 15. AI Review Evaluation
const { evaluateReviewWithAI } = require('../services/ai/reviewEvaluator');
router.post('/review-evaluation', async (req, res) => {
  try {
    const { review, submission, project } = req.body;
    const result = await evaluateReviewWithAI(review, submission, project);
    res.json(result);
  } catch (err) {
    console.error('Error in /review-evaluation:', err);
    res.status(500).json({ success: false, error: 'An error occurred during AI review evaluation.' });
  }
});

module.exports = router;

