const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Review = require('../models/Review');
const ReviewSubmission = require('../models/ReviewSubmission');
const ReviewEvaluation = require('../models/ReviewEvaluation');
const Project = require('../models/Project');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Department = require('../models/Department');
const { evaluateReviewWithAI } = require('../services/ai/reviewEvaluator');

// Ensure review uploads directory exists
const reviewUploadDir = path.join(__dirname, '../uploads/reviews');
if (!fs.existsSync(reviewUploadDir)) {
  fs.mkdirSync(reviewUploadDir, { recursive: true });
}

const reviewStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, reviewUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const uploadReview = multer({
  storage: reviewStorage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Helper to resolve Project ObjectId from string or ObjectId
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

// Helper to resolve Faculty ObjectId from string or ObjectId
async function resolveFacultyId(guideId) {
  if (guideId && mongoose.Types.ObjectId.isValid(guideId)) {
    return guideId;
  }
  const fac = await Faculty.findOne({
    $or: [
      { facultyId: guideId },
      { email: guideId },
      { name: new RegExp(guideId || '', 'i') }
    ]
  }) || await Faculty.findOne();
  return fac ? fac._id : null;
}

// Helper to resolve Review by ID or title
async function resolveReview(reviewId) {
  if (reviewId && mongoose.Types.ObjectId.isValid(reviewId)) {
    return await Review.findById(reviewId);
  }
  return await Review.findOne({
    $or: [
      { title: new RegExp(reviewId || '', 'i') }
    ]
  }) || await Review.findOne();
}

// Helper to resolve Department ObjectId from string or ObjectId
async function resolveDepartmentId(dept) {
  if (!dept) return null;
  if (mongoose.Types.ObjectId.isValid(dept)) {
    const d = await Department.findById(dept);
    if (d) return d._id;
  }
  const d = await Department.findOne({
    $or: [
      { name: new RegExp(dept, 'i') },
      { code: new RegExp(dept, 'i') }
    ]
  });
  return d ? d._id : null;
}

// Helper to compute strict student submission window:
// Allowed ONLY from 00:00:00 of the day before the review until 23:59:59 of the review day.
function getSubmissionWindowStatus(scheduledDate, deadline) {
  const now = new Date();
  const revDate = new Date(scheduledDate || Date.now());

  // Day before the review at 00:00:00 local time
  const windowStart = new Date(revDate.getFullYear(), revDate.getMonth(), revDate.getDate() - 1, 0, 0, 0, 0);

  // End of the review day at 23:59:59 local time
  const windowEnd = new Date(revDate.getFullYear(), revDate.getMonth(), revDate.getDate(), 23, 59, 59, 999);

  // If deadline extends beyond review day, extend windowEnd accordingly
  if (deadline) {
    const deadDate = new Date(deadline);
    if (deadDate > windowEnd) {
      windowEnd.setTime(deadDate.getTime());
    }
  }

  const isOpen = now >= windowStart && now <= windowEnd;
  const isBefore = now < windowStart;
  const isAfter = now > windowEnd;

  return {
    isOpen,
    isBefore,
    isAfter,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    status: isBefore ? 'BEFORE_WINDOW' : isAfter ? 'WINDOW_CLOSED' : 'WINDOW_ACTIVE'
  };
}

// Helper to compute dynamic review status based on scheduled date
function getDynamicReviewStatus(rev, evaluations = []) {
  if (rev.status === 'CANCELLED' || rev.status === 'POSTPONED') {
    return rev.status;
  }
  const now = new Date();
  const sched = new Date(rev.scheduledDate);
  const schedStart = new Date(sched.getFullYear(), sched.getMonth(), sched.getDate(), 0, 0, 0, 0);
  const schedEnd = new Date(sched.getFullYear(), sched.getMonth(), sched.getDate(), 23, 59, 59, 999);

  if (now > schedEnd) {
    return 'COMPLETED';
  }
  if (now >= schedStart && now <= schedEnd) {
    return 'ONGOING';
  }
  return 'SCHEDULED';
}

const { mockReviews, mockProjects } = require('../mockData');

/**
 * GET /api/reviews
 * List all reviews with populated department, project, and guide details.
 */
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: mockReviews.length, data: mockReviews });
    }

    const { guideId, projectId, departmentId, department, yearOfStudy, status, batch, academicYear } = req.query;
    const filter = {};
    if (guideId) filter.guide = guideId;
    if (projectId) filter.project = projectId;
    if (status) filter.status = status;
    if (yearOfStudy) filter.yearOfStudy = Number(yearOfStudy);
    if (batch && batch !== 'ALL' && batch !== 'NONE') filter.batch = batch;
    if (academicYear && academicYear !== 'ALL') filter.academicYear = academicYear;

    const deptRef = departmentId || department;
    if (deptRef && deptRef !== 'ALL') {
      const resolvedDept = await resolveDepartmentId(deptRef);
      if (resolvedDept) filter.department = resolvedDept;
    }

    const reviews = await Review.find(filter)
      .populate('project', 'title domain status teamMembers leadName')
      .populate('guide', 'name email facultyId designation department')
      .populate('department', 'name code')
      .sort({ scheduledDate: 1 });

    const reviewIds = reviews.map(r => r._id);
    const submissions = await ReviewSubmission.find({ review: { $in: reviewIds } })
      .populate('submittedBy', 'name regNo email')
      .populate('project', 'title domain status teamMembers leadName leadRegNo');
    const evaluations = await ReviewEvaluation.find({ review: { $in: reviewIds } })
      .populate('evaluator', 'name facultyId')
      .populate('project', 'title status leadName');

    const enrichedReviews = reviews.map(rev => {
      const revObj = rev.toObject();
      revObj.submissions = submissions.filter(s => s.review && s.review.toString() === rev._id.toString());
      revObj.evaluations = evaluations.filter(e => e.review && e.review.toString() === rev._id.toString());
      revObj.windowInfo = getSubmissionWindowStatus(rev.scheduledDate, rev.deadline);
      
      // Isolate submission and evaluation strictly per project
      if (projectId) {
        const pIdStr = projectId.toString();
        revObj.submission = revObj.submissions.find(s => String(s.project?._id || s.project || '') === pIdStr) || null;
        revObj.officialEvaluation = revObj.evaluations.find(e => String(e.project?._id || e.project || '') === pIdStr && e.evaluationType === 'FACULTY') || null;
      } else if (rev.project) {
        const pIdStr = (rev.project?._id || rev.project).toString();
        revObj.submission = revObj.submissions.find(s => String(s.project?._id || s.project || '') === pIdStr) || null;
        revObj.officialEvaluation = revObj.evaluations.find(e => String(e.project?._id || e.project || '') === pIdStr && e.evaluationType === 'FACULTY') || null;
      } else {
        // Cohort review: Each team has its own submission in revObj.submissions.
        // DO NOT set revObj.submission to submissions[0] to prevent leaking one team's upload to other teams.
        revObj.submission = null;
        revObj.officialEvaluation = null;
      }
      revObj.aiSuggestedEvaluation = revObj.evaluations.find(e => e.evaluationType === 'AI_SUGGESTED') || null;

      const dynamicStatus = getDynamicReviewStatus(rev, revObj.evaluations || []);
      revObj.status = dynamicStatus;
      if (rev.status !== dynamicStatus && rev._id) {
        Review.findByIdAndUpdate(rev._id, { status: dynamicStatus }).exec().catch(() => {});
      }
      return revObj;
    });

    res.json({ success: true, count: enrichedReviews.length, data: enrichedReviews });
  } catch (err) {
    res.json({ success: true, count: mockReviews.length, data: mockReviews });
  }
});

/**
 * GET /api/reviews/:id
 * Fetch a single review by ID with populated project, guide, submission, and evaluations.
 */
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID.' });
    }

    const review = await Review.findById(req.params.id)
      .populate('project', 'title domain status teamMembers')
      .populate('guide', 'name email facultyId designation')
      .populate('department', 'name code');

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    const submissions = await ReviewSubmission.find({ review: review._id })
      .populate('submittedBy', 'name regNo email')
      .populate('project', 'title domain status teamMembers leadName leadRegNo');
    const evaluations = await ReviewEvaluation.find({ review: review._id })
      .populate('evaluator', 'name facultyId')
      .populate('project', 'title status leadName');

    const revObj = review.toObject();
    revObj.submissions = submissions;
    revObj.evaluations = evaluations;
    revObj.windowInfo = getSubmissionWindowStatus(review.scheduledDate, review.deadline);
    if (review.project) {
      const pIdStr = (review.project?._id || review.project).toString();
      revObj.submission = submissions.find(s => String(s.project?._id || s.project || '') === pIdStr) || null;
      revObj.officialEvaluation = evaluations.find(e => String(e.project?._id || e.project || '') === pIdStr && e.evaluationType === 'FACULTY') || null;
    } else {
      revObj.submission = null;
      revObj.officialEvaluation = null;
    }
    revObj.aiSuggestedEvaluation = evaluations.find(e => e.evaluationType === 'AI_SUGGESTED') || null;

    const dynamicStatus = getDynamicReviewStatus(review, evaluations);
    revObj.status = dynamicStatus;
    if (review.status !== dynamicStatus && review._id) {
      Review.findByIdAndUpdate(review._id, { status: dynamicStatus }).exec().catch(() => {});
    }

    res.json({ success: true, data: revObj });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch review.' });
  }
});

/**
 * GET /api/reviews/project/:projectId
 * Fetch all reviews for a specific project with submissions and evaluations populated.
 */
router.get('/project/:projectId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, count: mockReviews.length, data: mockReviews });
    }

    const { projectId } = req.params;
    const resolvedPId = await resolveProjectId(projectId);

    let query = {};
    let proj = null;
    if (resolvedPId) {
      proj = await Project.findById(resolvedPId);
      if (proj) {
        query = {
          $or: [
            { project: proj._id },
            { 
              $and: [
                proj.department ? { department: proj.department } : {},
                { yearOfStudy: proj.yearOfStudy || 4 }
              ]
            }
          ]
        };
      } else {
        query = { project: resolvedPId };
      }
    }

    const reviews = await Review.find(query)
      .populate('guide', 'name email facultyId designation')
      .populate('department', 'name code')
      .sort({ scheduledDate: 1 });

    const reviewIds = reviews.map(r => r._id);
    const submissions = await ReviewSubmission.find({ 
      review: { $in: reviewIds },
      ...(resolvedPId ? { project: resolvedPId } : {})
    }).populate('submittedBy', 'name regNo email');

    const evaluations = await ReviewEvaluation.find({ 
      review: { $in: reviewIds },
      ...(resolvedPId ? { project: resolvedPId } : {})
    }).populate('evaluator', 'name facultyId');

    const enrichedReviews = reviews.map(rev => {
      const revObj = rev.toObject();
      revObj.submission = submissions.find(s => s.review.toString() === rev._id.toString()) || null;
      revObj.evaluations = evaluations.filter(e => e.review.toString() === rev._id.toString());
      revObj.officialEvaluation = evaluations.find(e => e.review.toString() === rev._id.toString() && e.evaluationType === 'FACULTY') || null;
      revObj.aiSuggestedEvaluation = evaluations.find(e => e.review.toString() === rev._id.toString() && e.evaluationType === 'AI_SUGGESTED') || null;
      revObj.windowInfo = getSubmissionWindowStatus(rev.scheduledDate, rev.deadline);
      const dynamicStatus = getDynamicReviewStatus(rev, revObj.evaluations || []);
      revObj.status = dynamicStatus;
      if (rev.status !== dynamicStatus && rev._id) {
        Review.findByIdAndUpdate(rev._id, { status: dynamicStatus }).exec().catch(() => {});
      }
      return revObj;
    });

    res.json({ success: true, count: enrichedReviews.length, data: enrichedReviews });
  } catch (err) {
    console.error('Error fetching project reviews:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch project reviews.' });
  }
});

/**
 * GET /api/reviews/guide/:guideId
 * Fetch all reviews relevant to a faculty guide (both direct guide assignments & departmental cohort reviews).
 */
router.get('/guide/:guideId', async (req, res) => {
  try {
    const { guideId } = req.params;
    const resolvedGId = await resolveFacultyId(guideId);

    // 1. Find all projects supervised by this faculty member
    const supervisedProjects = await Project.find({
      $or: [
        ...(resolvedGId ? [{ guide: resolvedGId }, { guideId: resolvedGId }] : []),
        { guideName: new RegExp(guideId || '', 'i') }
      ]
    }).populate('department');

    const projectIds = supervisedProjects.map(p => p._id);
    const deptIds = [...new Set(supervisedProjects.map(p => p.department?._id || p.department).filter(Boolean))];

    // 2. Query reviews: direct guide match OR matching department of supervised projects
    const orConditions = [];
    if (resolvedGId) orConditions.push({ guide: resolvedGId });
    if (projectIds.length > 0) orConditions.push({ project: { $in: projectIds } });
    if (deptIds.length > 0) orConditions.push({ department: { $in: deptIds } });

    const query = orConditions.length > 0 ? { $or: orConditions } : {};
    const reviews = await Review.find(query)
      .populate('project', 'title domain status teamMembers leadName')
      .populate('guide', 'name facultyId email')
      .populate('department', 'name code')
      .sort({ scheduledDate: 1 });

    const reviewIds = reviews.map(r => r._id);
    const submissions = await ReviewSubmission.find({ review: { $in: reviewIds } })
      .populate('submittedBy', 'name regNo email')
      .populate('project', 'title domain status teamMembers leadName leadRegNo');
    const evaluations = await ReviewEvaluation.find({ review: { $in: reviewIds } })
      .populate('evaluator', 'name facultyId')
      .populate('project', 'title status leadName');

    const enrichedReviews = reviews.map(rev => {
      const revObj = rev.toObject();
      revObj.submissions = submissions.filter(s => s.review && s.review.toString() === rev._id.toString());
      revObj.evaluations = evaluations.filter(e => e.review && e.review.toString() === rev._id.toString());
      revObj.windowInfo = getSubmissionWindowStatus(rev.scheduledDate, rev.deadline);
      // Faculty supervises multiple teams in the cohort; teams are rendered individually from revObj.submissions
      revObj.submission = null;
      revObj.officialEvaluation = null;
      revObj.aiSuggestedEvaluation = null;
      const dynamicStatus = getDynamicReviewStatus(rev, revObj.evaluations || []);
      revObj.status = dynamicStatus;
      if (rev.status !== dynamicStatus && rev._id) {
        Review.findByIdAndUpdate(rev._id, { status: dynamicStatus }).exec().catch(() => {});
      }
      return revObj;
    });

    res.json({ success: true, count: enrichedReviews.length, data: enrichedReviews });
  } catch (err) {
    console.error('Error fetching guide reviews:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch guide reviews.' });
  }
});

/**
 * POST /api/reviews
 * Guide/Admin schedules a new review.
 * Can be scheduled for a specific project OR across an entire Department & Year of Study cohort.
 */
router.post('/', async (req, res) => {
  try {
    const {
      projectId,
      guideId,
      departmentId,
      department,
      yearOfStudy,
      venue,
      title,
      reviewType,
      scheduledDate,
      deadline,
      instructions,
      requiredDocType,
      maxMarks,
      rubricCriteria
    } = req.body;

    if (!title || !scheduledDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title and scheduledDate are mandatory.'
      });
    }

    const schedDateObj = new Date(scheduledDate);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    if (schedDateObj < todayMidnight) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled review date cannot be in the past.'
      });
    }

    let deadlineObj;
    if (deadline) {
      deadlineObj = new Date(deadline);
    } else {
      deadlineObj = new Date(schedDateObj);
      deadlineObj.setDate(deadlineObj.getDate() - 1);
    }

    const schedDateDay = new Date(schedDateObj.getFullYear(), schedDateObj.getMonth(), schedDateObj.getDate());
    const initialStatus = schedDateDay.getTime() === todayMidnight.getTime() ? 'ONGOING' : 'SCHEDULED';

    let resolvedPId = null;
    if (projectId) {
      resolvedPId = await resolveProjectId(projectId);
    }

    let resolvedDeptId = null;
    const deptRef = departmentId || department;
    if (deptRef && deptRef !== 'ALL') {
      resolvedDeptId = await resolveDepartmentId(deptRef);
    }

    let resolvedGId = null;
    if (resolvedPId) {
      const proj = await Project.findById(resolvedPId);
      if (proj) {
        if (proj.guide) resolvedGId = proj.guide;
        if (!resolvedDeptId && proj.department) resolvedDeptId = proj.department;
      }
    }

    if (!resolvedGId && guideId) {
      resolvedGId = await resolveFacultyId(guideId);
    }

    // Default to first department if none specified
    if (!resolvedDeptId) {
      const firstDept = await Department.findOne();
      if (firstDept) resolvedDeptId = firstDept._id;
    }

    const yr = Number(yearOfStudy) || 4;

    let revAcadYear = req.body.academicYear;
    if (!revAcadYear) {
      const SystemSetting = require('../models/SystemSetting');
      const setting = await SystemSetting.findOne({ key: 'academic_settings' });
      revAcadYear = setting?.currentAcademicYear || '2026-2027';
    }

    let revBatch = req.body.batch;
    if (!revBatch) {
      const startYr = parseInt(revAcadYear.split('-')[0], 10) || 2026;
      revBatch = `${startYr - (yr - 1)}-${startYr + (5 - yr)}`;
    }

    const review = await Review.create({
      project: resolvedPId || undefined,
      guide: resolvedGId || undefined,
      department: resolvedDeptId || undefined,
      yearOfStudy: yr,
      batch: revBatch,
      academicYear: revAcadYear,
      venue: venue ? venue.trim() : 'Seminar Hall / Online',
      title: title.trim(),
      reviewType: reviewType || 'REVIEW_1',
      scheduledDate: schedDateObj,
      deadline: deadlineObj,
      instructions: instructions || 'Upload presentation slides (PPT/PDF) covering project deliverables.',
      requiredDocType: requiredDocType || 'ALL',
      maxMarks: Math.min(100, Math.max(1, Number(maxMarks) || 50)),
      rubricCriteria: rubricCriteria || [
        { name: 'Problem Statement & Scope', maxScore: 10 },
        { name: 'System Architecture & Design', maxScore: 15 },
        { name: 'Implementation & Demo', maxScore: 15 },
        { name: 'Presentation & Q&A Discussion', maxScore: 10 }
      ],
      status: initialStatus
    });

    const populated = await Review.findById(review._id)
      .populate('project', 'title domain status teamMembers leadName')
      .populate('guide', 'name email facultyId designation department')
      .populate('department', 'name code');

    res.status(201).json({ success: true, message: 'Review scheduled successfully.', data: populated });
  } catch (err) {
    console.error('Error scheduling review:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to schedule review.' });
  }
});

/**
 * PUT /api/reviews/:id
 * Admin/Guide reschedules (postpone/prepone), modifies venue, deadline, marks or details.
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found.' });

    const {
      title,
      scheduledDate,
      deadline,
      venue,
      instructions,
      requiredDocType,
      maxMarks,
      rubricCriteria,
      reviewType,
      status,
      yearOfStudy,
      departmentId,
      department
    } = req.body;

    if (title) review.title = title.trim();
    if (scheduledDate) review.scheduledDate = new Date(scheduledDate);
    if (deadline) review.deadline = new Date(deadline);
    if (venue !== undefined) review.venue = venue.trim();
    if (instructions) review.instructions = instructions.trim();
    if (requiredDocType) review.requiredDocType = requiredDocType;
    if (maxMarks !== undefined) review.maxMarks = Number(maxMarks);
    if (rubricCriteria) review.rubricCriteria = rubricCriteria;
    if (reviewType) review.reviewType = reviewType;
    if (status) review.status = status;
    if (yearOfStudy) review.yearOfStudy = Number(yearOfStudy);

    const deptRef = departmentId || department;
    if (deptRef && deptRef !== 'ALL') {
      const resolvedDept = await resolveDepartmentId(deptRef);
      if (resolvedDept) review.department = resolvedDept;
    }

    await review.save();

    const populated = await Review.findById(review._id)
      .populate('project', 'title domain status teamMembers leadName')
      .populate('guide', 'name email facultyId designation department')
      .populate('department', 'name code');

    res.json({ success: true, message: 'Review updated/rescheduled successfully.', data: populated });
  } catch (err) {
    console.error('PUT /api/reviews/:id error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update review.' });
  }
});

/**
 * DELETE /api/reviews/:id
 * Admin deletes a scheduled review and cleans associated submissions/evaluations.
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found.' });

    await ReviewSubmission.deleteMany({ review: review._id });
    await ReviewEvaluation.deleteMany({ review: review._id });
    await Review.findByIdAndDelete(id);

    res.json({ success: true, message: 'Review deleted successfully.' });
  } catch (err) {
    console.error('DELETE /api/reviews/:id error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to delete review.' });
  }
});

/**
 * POST /api/reviews/:id/submit
 * Student uploads required review document and submits deliverables.
 */
/**
 * POST /api/reviews/:id/submit
 * Student uploads required review document and submits deliverables.
 * Enforces strict submission window: from 00:00:00 of the day before the review until 23:59:59 of review day.
 */
router.post('/:id/submit', async (req, res) => {
  try {
    const { id: reviewId } = req.params;
    const {
      projectId,
      studentId,
      fileName,
      filePath,
      fileUrl,
      documentType,
      fileSize,
      notes,
      progressSummary,
      presentationFile,
      presentationUrl,
      demoUrl,
      keyAchievements,
      roadblocks
    } = req.body;

    const review = await resolveReview(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review schedule not found.' });
    }

    // Enforce strict time window: from day before review until end of review day
    const windowInfo = getSubmissionWindowStatus(review.scheduledDate, review.deadline);
    if (!windowInfo.isOpen) {
      const msg = windowInfo.isBefore
        ? `Submission portal is not open yet. Submissions are strictly allowed from the day before the review until the end of the review day.`
        : `Submission portal is closed. The review deadline has passed.`;
      return res.status(403).json({
        success: false,
        error: msg,
        windowInfo
      });
    }

    let resolvedPId = null;
    if (projectId) {
      resolvedPId = await resolveProjectId(projectId);
    } else if (review.project) {
      resolvedPId = review.project;
    }

    if (resolvedPId) {
      const proj = await Project.findById(resolvedPId);
      if (proj && !['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(proj.status)) {
        return res.status(403).json({
          success: false,
          error: 'Cannot submit review deliverables. Project proposal must be approved by the faculty guide first.'
        });
      }
    }

    const isLate = new Date() > new Date(review.deadline);
    const submissionStatus = isLate ? 'LATE' : 'SUBMITTED';

    let resolvedStudentId = studentId;
    if (!resolvedStudentId || !mongoose.Types.ObjectId.isValid(resolvedStudentId)) {
      const student = await Student.findOne() || null;
      resolvedStudentId = student ? student._id : null;
    }

    // Upsert submission per review and project team
    const submissionFilter = { review: review._id };
    if (resolvedPId) submissionFilter.project = resolvedPId;

    const submission = await ReviewSubmission.findOneAndUpdate(
      submissionFilter,
      {
        review: review._id,
        project: resolvedPId || review.project,
        submittedBy: resolvedStudentId,
        fileName: fileName || 'Review_Submission.pdf',
        filePath: filePath || `/uploads/reviews/${fileName || 'Review_Submission.pdf'}`,
        fileUrl: fileUrl || '',
        documentType: documentType || 'PDF',
        fileSize: fileSize || '1.5 MB',
        notes: notes || '',
        progressSummary: progressSummary || notes || '',
        presentationFile: presentationFile || '',
        presentationUrl: presentationUrl || '',
        demoUrl: demoUrl || '',
        keyAchievements: keyAchievements || [],
        roadblocks: roadblocks || '',
        submissionTime: new Date(),
        status: submissionStatus
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: isLate ? 'Document submitted after deadline (Marked as Late).' : 'Review progress report and deliverables submitted successfully.',
      data: submission
    });
  } catch (err) {
    console.error('Error submitting review document:', err);
    res.status(500).json({ success: false, error: 'Failed to submit review document.' });
  }
});

/**
 * POST /api/reviews/:id/upload-deliverable
 * Student uploads an actual file deliverable (PDF, PPT, ZIP) for a review.
 * Enforces strict submission window: from 00:00:00 of the day before the review until 23:59:59 of review day.
 */
router.post('/:id/upload-deliverable', uploadReview.single('file'), async (req, res) => {
  try {
    const { id: reviewId } = req.params;
    const {
      projectId,
      studentId,
      documentType,
      notes,
      progressSummary,
      presentationUrl,
      demoUrl,
      keyAchievements,
      roadblocks
    } = req.body;

    const review = await resolveReview(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review schedule not found.' });
    }

    // Enforce strict time window: from day before review until end of review day
    const windowInfo = getSubmissionWindowStatus(review.scheduledDate, review.deadline);
    if (!windowInfo.isOpen) {
      const msg = windowInfo.isBefore
        ? `Submission portal is not open yet. Submissions are strictly allowed from the day before the review until the end of the review day.`
        : `Submission portal is closed. The review deadline has passed.`;
      return res.status(403).json({
        success: false,
        error: msg,
        windowInfo
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No deliverable file uploaded.' });
    }

    let resolvedPId = null;
    if (projectId) {
      resolvedPId = await resolveProjectId(projectId);
    } else if (review.project) {
      resolvedPId = review.project;
    }

    const isLate = new Date() > new Date(review.deadline);
    const submissionStatus = isLate ? 'LATE' : 'SUBMITTED';

    let resolvedStudentId = studentId;
    if (!resolvedStudentId || !mongoose.Types.ObjectId.isValid(resolvedStudentId)) {
      const student = await Student.findOne() || null;
      resolvedStudentId = student ? student._id : null;
    }

    const ext = path.extname(req.file.originalname).replace('.', '').toUpperCase();
    const formattedSize = req.file.size > 1024 * 1024 
      ? (req.file.size / (1024 * 1024)).toFixed(1) + ' MB'
      : (req.file.size / 1024).toFixed(1) + ' KB';
    const relativeFilePath = `/uploads/reviews/${req.file.filename}`;

    const submissionFilter = { review: review._id };
    if (resolvedPId) submissionFilter.project = resolvedPId;

    let achievementsList = [];
    if (keyAchievements) {
      try {
        achievementsList = Array.isArray(keyAchievements) ? keyAchievements : JSON.parse(keyAchievements);
      } catch (e) {
        achievementsList = [keyAchievements];
      }
    }

    const submission = await ReviewSubmission.findOneAndUpdate(
      submissionFilter,
      {
        review: review._id,
        project: resolvedPId || review.project,
        submittedBy: resolvedStudentId,
        fileName: req.file.originalname,
        filePath: relativeFilePath,
        fileUrl: relativeFilePath,
        documentType: documentType || ext || 'PDF',
        fileSize: formattedSize,
        notes: notes || '',
        progressSummary: progressSummary || notes || '',
        presentationUrl: presentationUrl || '',
        demoUrl: demoUrl || '',
        keyAchievements: achievementsList,
        roadblocks: roadblocks || '',
        submissionTime: new Date(),
        status: submissionStatus
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: isLate ? 'Deliverable uploaded after deadline (Marked as Late).' : 'Deliverables & progress report submitted successfully.',
      data: submission
    });
  } catch (err) {
    console.error('Error uploading review deliverable:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to upload review deliverable.' });
  }
});

/**
 * POST /api/reviews/:id/ai-evaluate
 * AI evaluation of a review submission.
 */
router.post('/:id/ai-evaluate', async (req, res) => {
  try {
    const { id: reviewId } = req.params;
    const { projectId, projectData, submissionData } = req.body;

    const review = await resolveReview(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    await review.populate('guide', 'name facultyId');

    let resolvedPId = null;
    if (projectId) {
      resolvedPId = await resolveProjectId(projectId);
    } else if (review.project) {
      resolvedPId = review.project;
    }

    let submission = submissionData;
    if (!submission) {
      const subQuery = { review: review._id };
      if (resolvedPId) subQuery.project = resolvedPId;
      submission = await ReviewSubmission.findOne(subQuery);
    }

    if (!submission) {
      return res.status(400).json({
        success: false,
        error: 'No submission found for this review to evaluate. Please ensure the student team has uploaded deliverables.'
      });
    }

    let project = projectData;
    if (!project) {
      project = await Project.findById(resolvedPId || review.project);
    }

    const aiResult = await evaluateReviewWithAI(review, submission, project);
    if (!aiResult.success) {
      return res.status(500).json(aiResult);
    }

    // Save or update AI_SUGGESTED evaluation in database for audit trail
    const evalQuery = { review: review._id, evaluationType: 'AI_SUGGESTED' };
    if (resolvedPId) evalQuery.project = resolvedPId;

    const savedAiEval = await ReviewEvaluation.findOneAndUpdate(
      evalQuery,
      {
        review: review._id,
        project: resolvedPId || undefined,
        submission: submission._id || submission.id,
        evaluator: review.guide?._id || review.guide,
        evaluationType: 'AI_SUGGESTED',
        marks: aiResult.data.suggestedMarks,
        maxMarks: aiResult.data.maxMarks || review.maxMarks,
        grade: aiResult.data.suggestedGrade || 'A',
        rubricBreakdown: aiResult.data.rubricBreakdown || [],
        strengths: aiResult.data.strengths || [],
        weaknesses: aiResult.data.weaknesses || [],
        comments: aiResult.data.feedbackSummary || 'AI suggested preliminary evaluation.',
        feedback: aiResult.data.vivaQuestions ? `Recommended Viva Questions:\n- ${aiResult.data.vivaQuestions.join('\n- ')}` : '',
        evaluatedTime: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      isAiSuggested: true,
      data: {
        ...aiResult.data,
        evaluationId: savedAiEval._id
      }
    });
  } catch (err) {
    console.error('Error in /api/reviews/:id/ai-evaluate:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate AI review evaluation.' });
  }
});

/**
 * POST /api/reviews/:id/evaluate
 * Guide submits official evaluation & marks for a specific project team.
 * Can be modified/updated at any time by the faculty.
 */
router.post('/:id/evaluate', async (req, res) => {
  try {
    const { id: reviewId } = req.params;
    const {
      projectId,
      submissionId,
      evaluatorId,
      marks,
      maxMarks,
      grade,
      rubricBreakdown,
      rubricScores,
      strengths,
      weaknesses,
      comments,
      feedback
    } = req.body;

    let finalMarks = marks;
    const finalRubric = rubricBreakdown || rubricScores || [];
    if (finalMarks === undefined && Array.isArray(finalRubric) && finalRubric.length > 0) {
      finalMarks = finalRubric.reduce((acc, r) => acc + (Number(r.score) || 0), 0);
    }

    if (finalMarks === undefined) {
      return res.status(400).json({ success: false, error: 'Marks are required.' });
    }

    const review = await resolveReview(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    let resolvedPId = null;
    if (projectId) {
      resolvedPId = await resolveProjectId(projectId);
    } else if (review.project) {
      resolvedPId = review.project;
    }

    const resolvedEvaluatorId = await resolveFacultyId(evaluatorId) || review.guide;

    let actualSubmissionId = submissionId;
    if (!actualSubmissionId || !mongoose.Types.ObjectId.isValid(actualSubmissionId)) {
      const subQuery = { review: review._id };
      if (resolvedPId) subQuery.project = resolvedPId;
      const sub = await ReviewSubmission.findOne(subQuery);
      if (sub) {
        actualSubmissionId = sub._id;
        if (!resolvedPId && sub.project) resolvedPId = sub.project;
      }
    }

    // Auto calculate grade if not provided
    const calculatedGrade = grade || (
      finalMarks >= 0.9 * (maxMarks || review.maxMarks) ? 'A+' :
      finalMarks >= 0.8 * (maxMarks || review.maxMarks) ? 'A' :
      finalMarks >= 0.7 * (maxMarks || review.maxMarks) ? 'B+' :
      finalMarks >= 0.6 * (maxMarks || review.maxMarks) ? 'B' : 'C'
    );

    // Save or update official faculty evaluation (allows modification anytime)
    const evalFilter = { review: review._id, evaluationType: 'FACULTY' };
    if (resolvedPId) evalFilter.project = resolvedPId;
    else if (actualSubmissionId) evalFilter.submission = actualSubmissionId;

    const evaluation = await ReviewEvaluation.findOneAndUpdate(
      evalFilter,
      {
        review: review._id,
        project: resolvedPId || undefined,
        submission: actualSubmissionId || undefined,
        evaluator: resolvedEvaluatorId,
        evaluationType: 'FACULTY',
        marks: Number(finalMarks),
        maxMarks: Number(maxMarks) || review.maxMarks,
        grade: calculatedGrade,
        rubricBreakdown: finalRubric,
        strengths: strengths || [],
        weaknesses: weaknesses || [],
        comments: comments || 'Review completed successfully.',
        feedback: feedback || '',
        evaluatedTime: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update submission status to REVIEWED
    if (actualSubmissionId) {
      await ReviewSubmission.findByIdAndUpdate(actualSubmissionId, { status: 'REVIEWED' });
    }

    res.json({
      success: true,
      message: 'Official evaluation and marks saved successfully (Can be revised by faculty anytime).',
      data: evaluation
    });
  } catch (err) {
    console.error('Error submitting official review evaluation:', err);
    res.status(500).json({ success: false, error: 'Failed to submit official evaluation.' });
  }
});

module.exports = router;
