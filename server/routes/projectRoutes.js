const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Department = require('../models/Department');
const Milestone = require('../models/Milestone');
const SystemSetting = require('../models/SystemSetting');
const mongoose = require('mongoose');
const { mockProjects, mockDepartments, mockUsers } = require('../mockData');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure IEEE upload directory exists
const ieeeUploadDir = path.join(__dirname, '../uploads/ieee');
if (!fs.existsSync(ieeeUploadDir)) {
  fs.mkdirSync(ieeeUploadDir, { recursive: true });
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const ieeeStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, ieeeUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    cb(null, `ieee-${baseName}-${uniqueSuffix}${ext}`);
  }
});

const uploadIeeeDraft = multer({
  storage: ieeeStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.docx', '.doc'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only DOCX and PDF documents are allowed for IEEE papers.'), false);
    }
  },
  limits: { fileSize: 30 * 1024 * 1024 }
});

const uploadIeeeProof = multer({
  storage: ieeeStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, PNG, and JPG files are allowed for IEEE proofs.'), false);
    }
  },
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Comprehensive population configuration for projects
const POPULATE_PROJECT = [
  { path: 'guide', select: 'name facultyId staffId email department' },
  {
    path: 'teamMembers',
    select: 'name regNo email department yearOfStudy year batch',
    populate: { path: 'department', select: 'name code' }
  },
  { path: 'department', select: 'name code' }
];

// GET /api/projects — list all projects (with populated refs)
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: mockProjects });
    }

    const { status, dept, guideId, academicYear } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (dept) filter.department = dept;
    if (academicYear) filter.academicYear = academicYear;
    if (guideId) {
      const guideConditions = [];
      if (mongoose.Types.ObjectId.isValid(guideId)) {
        guideConditions.push({ guide: new mongoose.Types.ObjectId(guideId) });
      }
      try {
        const faculty = await Faculty.findOne({
          $or: [
            ...(mongoose.Types.ObjectId.isValid(guideId) ? [{ _id: guideId }] : []),
            { facultyId: guideId },
            { staffId: guideId }
          ]
        });
        if (faculty && !guideConditions.some(c => c.guide?.toString() === faculty._id.toString())) {
          guideConditions.push({ guide: faculty._id });
        }
      } catch (fErr) {}

      if (guideConditions.length > 0) {
        filter.$or = guideConditions;
      } else {
        filter.guide = new mongoose.Types.ObjectId();
      }
    }

    const projects = await Project.find(filter)
      .populate(POPULATE_PROJECT)
      .sort({ createdAt: -1 });

    // Filter out and self-heal any orphaned projects with 0 team members
    const validProjects = [];
    for (const p of projects) {
      if (Array.isArray(p.teamMembers) && p.teamMembers.length > 0) {
        validProjects.push(p);
      } else if (mongoose.connection.readyState === 1 && p._id) {
        // Clean up orphan in background
        const Milestone = require('../models/Milestone');
        const Task = require('../models/Task');
        const WeeklyProgress = require('../models/WeeklyProgress');
        const Document = require('../models/Document');
        const Team = require('../models/Team');
        Promise.allSettled([
          Milestone.deleteMany({ project: p._id }),
          Task.deleteMany({ project: p._id }),
          WeeklyProgress.deleteMany({ project: p._id }),
          Document.deleteMany({ project: p._id }),
          Team.deleteMany({ project: p._id }),
          Student.updateMany({ project: p._id }, { $unset: { project: '' } }),
          Project.findByIdAndDelete(p._id)
        ]).catch(() => {});
      }
    }

    res.json({ success: true, data: validProjects });
  } catch (err) {
    if (mongoose.connection.readyState === 1) {
      return res.json({ success: true, data: [] });
    }
    res.json({ success: true, data: mockProjects });
  }
});

// GET /api/projects/:id — get single project
router.get('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const proj = mockProjects.find(p => p._id === req.params.id || p.id === req.params.id);
      return proj ? res.json({ success: true, data: proj }) : res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, error: 'Invalid project ID format' });
    }

    const project = await Project.findById(req.params.id)
      .populate(POPULATE_PROJECT);

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects — create a new project proposal
router.post('/', async (req, res) => {
  try {
    const {
      title, description, abstract, problemStatement, objectives,
      domain, technologies, teamMembers, department, leadStudentId, status,
      guide, guideId, guideName
    } = req.body;

    // Resolve guide if specified
    let guideDoc = null;
    const rawGuide = guideId || guide || guideName;
    if (rawGuide) {
      const gId = (typeof rawGuide === 'object' && rawGuide !== null)
        ? (rawGuide._id || rawGuide.id)
        : rawGuide;

      const guideConditions = [];
      if (gId && mongoose.Types.ObjectId.isValid(gId)) {
        guideConditions.push({ _id: new mongoose.Types.ObjectId(gId) });
      }
      if (typeof gId === 'string' && gId.trim()) {
        const cleanGId = gId.trim();
        guideConditions.push({ facultyId: cleanGId });
        guideConditions.push({ staffId: cleanGId });
        guideConditions.push({ email: cleanGId.toLowerCase() });
        guideConditions.push({ name: new RegExp(`^${cleanGId}$`, 'i') });
      }
      if (guideName && typeof guideName === 'string' && guideName.trim()) {
        guideConditions.push({ name: new RegExp(`^${guideName.trim()}$`, 'i') });
      }

      if (guideConditions.length > 0 && mongoose.connection.readyState === 1) {
        guideDoc = await Faculty.findOne({ $or: guideConditions });
      }
    }

    // Resolve department
    let deptDoc = null;
    if (department && mongoose.connection.readyState === 1) {
      if (mongoose.Types.ObjectId.isValid(department)) {
        deptDoc = await Department.findById(department);
      }
      if (!deptDoc) {
        deptDoc = await Department.findOne({
          $or: [
            { name: new RegExp(department, 'i') },
            { code: new RegExp(department, 'i') }
          ]
        });
      }
    }
    if (!deptDoc && mongoose.connection.readyState === 1) {
      deptDoc = await Department.findOne();
    }
    if (!deptDoc && mongoose.connection.readyState === 1) {
      return res.status(400).json({ success: false, error: 'Department not found.' });
    }

    // Resolve team members to actual Student ObjectIds
    let resolvedTeamMembers = [];
    if (leadStudentId) {
      if (mongoose.Types.ObjectId.isValid(leadStudentId)) {
        const foundLead = await Student.findById(leadStudentId);
        if (foundLead) resolvedTeamMembers.push(foundLead._id);
      } else {
        const found = await Student.findOne({
          $or: [
            { email: String(leadStudentId).toLowerCase() },
            { name: String(leadStudentId) },
            { regNo: String(leadStudentId) }
          ]
        });
        if (found) resolvedTeamMembers.push(found._id);
      }
    }
    if (Array.isArray(teamMembers)) {
      for (const m of teamMembers) {
        if (!m) continue;
        const idVal = (typeof m === 'object' && m !== null) ? (m._id || m.id) : m;
        if (idVal && mongoose.Types.ObjectId.isValid(idVal)) {
          if (!resolvedTeamMembers.some(id => id.toString() === idVal.toString())) {
            resolvedTeamMembers.push(new mongoose.Types.ObjectId(idVal));
          }
        } else if (typeof idVal === 'string' && idVal.trim()) {
          const found = await Student.findOne({
            $or: [
              { name: new RegExp(`^${idVal.trim()}$`, 'i') },
              { email: idVal.trim().toLowerCase() },
              { regNo: idVal.trim() }
            ]
          });
          if (found && !resolvedTeamMembers.some(id => id.toString() === found._id.toString())) {
            resolvedTeamMembers.push(found._id);
          }
        }
      }
    }

    const safeTitle = (title || 'Academic Project').trim();
    const safeDesc = (description || abstract || problemStatement || safeTitle).trim();
    const safeProblem = (problemStatement || description || abstract || safeTitle).trim();

    // If teamId is passed or lead student has an active formed Team, bind project to team
    const Team = require('../models/Team');
    let teamDoc = null;
    if (req.body.teamId && mongoose.Types.ObjectId.isValid(req.body.teamId)) {
      teamDoc = await Team.findById(req.body.teamId);
    } else if (resolvedTeamMembers.length > 0 && mongoose.connection.readyState === 1) {
      teamDoc = await Team.findOne({
        status: { $in: ['FORMING', 'FORMED'] },
        $or: [
          { leader: { $in: resolvedTeamMembers } },
          { members: { $elemMatch: { student: { $in: resolvedTeamMembers }, status: 'ACCEPTED' } } }
        ]
      });
    }

    if (teamDoc) {
      // Ensure leader is always added
      if (teamDoc.leader && !resolvedTeamMembers.some(id => id.toString() === teamDoc.leader.toString())) {
        resolvedTeamMembers.unshift(teamDoc.leader);
      }
      // Ensure all accepted team members are added to resolvedTeamMembers
      for (const m of teamDoc.members) {
        if (m.status === 'ACCEPTED' && !resolvedTeamMembers.some(id => id.toString() === m.student.toString())) {
          resolvedTeamMembers.push(m.student);
        }
      }
      // Keep official team leader at index 0 of resolvedTeamMembers
      if (teamDoc.leader) {
        const leaderIdStr = teamDoc.leader.toString();
        resolvedTeamMembers = [
          teamDoc.leader,
          ...resolvedTeamMembers.filter(id => id.toString() !== leaderIdStr)
        ];
      }
    }

    // Determine current academic year and batch
    let activeAcadYear = '2026-2027';
    try {
      const setting = await SystemSetting.findOne({ key: 'academic_settings' });
      if (setting && setting.currentAcademicYear) {
        activeAcadYear = setting.currentAcademicYear.trim();
      }
    } catch (sErr) {}
    if (req.body.academicYear && typeof req.body.academicYear === 'string') {
      activeAcadYear = req.body.academicYear.trim();
    }

    let activeBatch = '2023-2027';
    if (resolvedTeamMembers.length > 0 && mongoose.connection.readyState === 1) {
      const leadStudentDoc = await Student.findById(resolvedTeamMembers[0]);
      if (leadStudentDoc && leadStudentDoc.batch) {
        activeBatch = leadStudentDoc.batch;
      }
    }
    if (req.body.batch && typeof req.body.batch === 'string') {
      activeBatch = req.body.batch.trim();
    }

    // Presentation / Mock mode fallback if MongoDB is not connected
    if (mongoose.connection.readyState !== 1) {
      const mockId = 'mock_proj_' + Date.now();
      const mockNewProj = {
        _id: mockId,
        id: mockId,
        title: safeTitle,
        description: safeDesc,
        abstract: abstract || safeDesc,
        problemStatement: safeProblem,
        objectives: Array.isArray(objectives) ? objectives : (objectives ? [objectives] : []),
        domain: domain || 'General Engineering',
        technologies: Array.isArray(technologies) ? technologies : (technologies ? technologies.split(',').map(t => t.trim()) : []),
        teamMembers: resolvedTeamMembers.length > 0 ? resolvedTeamMembers : (leadStudentId ? [leadStudentId] : ['student_1']),
        department: deptDoc || { _id: 'dept_1', name: 'Electrical & Electronics Engineering', code: 'EEE' },
        guide: guideDoc || null,
        status: status || 'UNDER_REVIEW',
        batch: activeBatch,
        academicYear: activeAcadYear,
        submittedDate: new Date(),
        approvedDate: null,
        milestones: []
      };
      mockProjects.unshift(mockNewProj);
      return res.status(201).json({ success: true, data: mockNewProj });
    }

    // Guard: Verify that none of the team members are passed-out or graduated students
    if (resolvedTeamMembers.length > 0) {
      const passedOutMember = await Student.findOne({
        _id: { $in: resolvedTeamMembers },
        $or: [
          { isPassedOut: true },
          { academicStatus: 'PASSED_OUT' },
          { yearOfStudy: { $gt: 4 } }
        ]
      });
      if (passedOutMember) {
        return res.status(403).json({
          success: false,
          error: `Student ${passedOutMember.name} (${passedOutMember.regNo}) has graduated / passed out and cannot submit or participate in new project proposals.`
        });
      }
    }

    // Guard: Verify that none of the team members already have an active project for this academic year
    if (resolvedTeamMembers.length > 0) {
      const existingProj = await Project.findOne({
        academicYear: activeAcadYear,
        status: { $nin: ['REJECTED'] },
        teamMembers: { $in: resolvedTeamMembers }
      }).populate('teamMembers', 'name regNo');

      if (existingProj) {
        return res.status(400).json({
          success: false,
          error: `One or more team members are already assigned to project "${existingProj.title}" for Academic Year ${activeAcadYear}. Each student can only do one project per academic year.`
        });
      }
    }

    // Guard: Check guide quota if a guide is specified for this academic year
    if (guideDoc) {
      const activeGuideProjects = await Project.countDocuments({
        guide: guideDoc._id,
        academicYear: activeAcadYear,
        status: { $nin: ['REJECTED'] }
      });
      const maxQuota = guideDoc.maxProjects || 2;
      if (activeGuideProjects >= maxQuota) {
        return res.status(400).json({
          success: false,
          error: `Faculty ${guideDoc.name} has reached maximum supervision quota (${maxQuota} projects). Cannot allocate additional projects.`
        });
      }
    }

    const project = new Project({
      title: safeTitle,
      description: safeDesc,
      abstract: abstract || safeDesc,
      problemStatement: safeProblem,
      objectives: Array.isArray(objectives) ? objectives : (objectives ? [objectives] : []),
      domain: domain || 'General Engineering',
      technologies: Array.isArray(technologies) ? technologies : (technologies ? technologies.split(',').map(t => t.trim()) : []),
      teamMembers: resolvedTeamMembers,
      department: deptDoc._id,
      guide: guideDoc ? guideDoc._id : undefined,
      status: status || 'UNDER_REVIEW',
      batch: activeBatch,
      academicYear: activeAcadYear,
      submittedDate: (status === 'UNDER_REVIEW' || status === 'SUBMITTED') ? new Date() : new Date(),
      approvedDate: null
    });

    await project.save();

    if (teamDoc) {
      teamDoc.project = project._id;
      teamDoc.status = 'PROPOSED';
      await teamDoc.save();
    }

    // Link project and team back to each student in teamMembers
    for (const memId of resolvedTeamMembers) {
      const updateData = { project: project._id };
      if (teamDoc) updateData.team = teamDoc._id;
      await Student.findByIdAndUpdate(memId, updateData);
    }

    // Initialize the standard 6 generic academic project milestones for the newly created project with 0% progress
    const now = new Date();
    const defaultMilestones = [
      { number: 1, title: 'Stage 1: Problem Definition & Literature Review', description: 'Analyze background literature, state-of-the-art research, and formalize project objectives.', startDate: now, dueDate: new Date(now.getTime() + 20 * 86400000), status: 'PENDING', completionPercentage: 0 },
      { number: 2, title: 'Stage 2: Requirements Specification & System Architecture', description: 'Define functional requirements, architectural blueprints, and module specifications.', startDate: new Date(now.getTime() + 21 * 86400000), dueDate: new Date(now.getTime() + 40 * 86400000), status: 'PENDING', completionPercentage: 0 },
      { number: 3, title: 'Stage 3: Detailed Design & Prototype Development', description: 'Formulate core system models, design schematics/data flows, and build baseline working prototypes.', startDate: new Date(now.getTime() + 41 * 86400000), dueDate: new Date(now.getTime() + 60 * 86400000), status: 'PENDING', completionPercentage: 0 },
      { number: 4, title: 'Stage 4: Core Implementation & System Integration', description: 'Execute primary build phases, integrate modular subsystems, and assemble end-to-end functionality.', startDate: new Date(now.getTime() + 61 * 86400000), dueDate: new Date(now.getTime() + 80 * 86400000), status: 'PENDING', completionPercentage: 0 },
      { number: 5, title: 'Stage 5: Testing, Verification & Performance Analysis', description: 'Conduct experimental validation, latency benchmarks, test suites, and bug fixes.', startDate: new Date(now.getTime() + 81 * 86400000), dueDate: new Date(now.getTime() + 100 * 86400000), status: 'PENDING', completionPercentage: 0 },
      { number: 6, title: 'Stage 6: Project Documentation & Final Thesis', description: 'Compile comprehensive project dissertation, prepare presentation review, and finalize deliverables.', startDate: new Date(now.getTime() + 101 * 86400000), dueDate: new Date(now.getTime() + 120 * 86400000), status: 'PENDING', completionPercentage: 0 }
    ];

    try {
      await Milestone.insertMany(defaultMilestones.map(m => ({ ...m, project: project._id })));
    } catch (mErr) {
      console.warn('Warning: Default milestones insertion error:', mErr.message);
    }

    const populated = await Project.findById(project._id)
      .populate(POPULATE_PROJECT);

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /api/projects error:', err);
    res.status(500).json({ success: false, error: 'Failed to create project: ' + err.message });
  }
});

// PUT /api/projects/:id — general update (title, abstract, comments, etc.)
router.put('/:id', async (req, res) => {
  try {
    const rawUpdates = { ...req.body };
    delete rawUpdates._id;
    delete rawUpdates.id;
    delete rawUpdates.__v;
    delete rawUpdates.createdAt;
    delete rawUpdates.updatedAt;

    // Sanitize populated references if sent as objects or strings
    if (rawUpdates.guide) {
      const gId = (typeof rawUpdates.guide === 'object' && rawUpdates.guide !== null) ? (rawUpdates.guide._id || rawUpdates.guide.id) : rawUpdates.guide;
      if (gId && mongoose.Types.ObjectId.isValid(gId)) {
        rawUpdates.guide = new mongoose.Types.ObjectId(gId);
      } else if (typeof gId === 'string' && gId.trim()) {
        const fac = await Faculty.findOne({ $or: [{ name: new RegExp(gId.trim(), 'i') }, { email: gId.trim() }, { facultyId: gId.trim() }] });
        if (fac) rawUpdates.guide = fac._id;
        else delete rawUpdates.guide;
      } else {
        delete rawUpdates.guide;
      }
    }

    if (rawUpdates.department) {
      const dId = (typeof rawUpdates.department === 'object' && rawUpdates.department !== null) ? (rawUpdates.department._id || rawUpdates.department.id) : rawUpdates.department;
      if (dId && mongoose.Types.ObjectId.isValid(dId)) {
        rawUpdates.department = new mongoose.Types.ObjectId(dId);
      } else if (typeof dId === 'string' && dId.trim()) {
        const dept = await Department.findOne({ $or: [{ name: new RegExp(dId.trim(), 'i') }, { code: dId.trim().toUpperCase() }] });
        if (dept) rawUpdates.department = dept._id;
        else delete rawUpdates.department;
      } else {
        delete rawUpdates.department;
      }
    }

    if (Array.isArray(rawUpdates.teamMembers)) {
      const resolvedMembers = [];
      for (const m of rawUpdates.teamMembers) {
        const idVal = (typeof m === 'object' && m !== null) ? (m._id || m.id) : m;
        if (idVal && mongoose.Types.ObjectId.isValid(idVal)) {
          resolvedMembers.push(new mongoose.Types.ObjectId(idVal));
        } else if (typeof idVal === 'string' && idVal.trim()) {
          const s = await Student.findOne({ $or: [{ name: new RegExp(idVal.trim(), 'i') }, { email: idVal.trim() }, { regNo: idVal.trim() }] });
          if (s && !resolvedMembers.some(r => r.toString() === s._id.toString())) {
            resolvedMembers.push(s._id);
          }
        }
      }
      if (resolvedMembers.length > 0) {
        rawUpdates.teamMembers = resolvedMembers;
      } else {
        delete rawUpdates.teamMembers;
      }
    }

    // Clean up collection references that are handled by separate models
    delete rawUpdates.milestones;
    delete rawUpdates.tasks;
    delete rawUpdates.weeklyUpdates;
    delete rawUpdates.documents;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: rawUpdates },
      { new: true, runValidators: true }
    )
      .populate(POPULATE_PROJECT);

    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });
    res.json({ success: true, data: project });
  } catch (err) {
    console.error('PUT /api/projects/:id error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update project.' });
  }
});

// PUT /api/projects/:id/submit — student submits proposal for review
router.put('/:id/submit', async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status: 'SUBMITTED', submittedDate: new Date() },
      { new: true }
    ).populate('guide', 'name facultyId staffId email department').populate('department', 'name code');

    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit proposal.' });
  }
});

// PUT /api/projects/:id/approve — faculty/admin approves proposal
router.put('/:id/approve', async (req, res) => {
  try {
    const { guideName, guideId } = req.body;

    const existing = await Project.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Project not found.' });

    const updates = {
      status: 'APPROVED',
      approvedDate: new Date()
    };

    // Resolve guide from DB
    const conditions = [];
    if (guideId && mongoose.Types.ObjectId.isValid(guideId)) {
      conditions.push({ _id: guideId });
    }
    if (guideId) {
      conditions.push({ facultyId: guideId });
      conditions.push({ staffId: guideId });
    }
    if (guideName) {
      conditions.push({ name: new RegExp(guideName.trim(), 'i') });
    }

    let targetFaculty = null;
    if (conditions.length > 0) {
      targetFaculty = await Faculty.findOne({ $or: conditions });
      if (targetFaculty) updates.guide = targetFaculty._id;
    }

    if (!targetFaculty && existing.guide) {
      targetFaculty = await Faculty.findById(existing.guide);
    }

    // Guard: A proposal MUST have an assigned faculty guide before it can be approved
    if (!targetFaculty && !existing.guide) {
      return res.status(400).json({
        success: false,
        error: 'Cannot approve proposal without an assigned faculty guide. The institutional administrator must allocate a guide first.'
      });
    }

    // Quota Enforcement: Verify that the approving/supervising faculty has not reached maxProjects for this academic year
    if (targetFaculty) {
      const activeCount = await Project.countDocuments({
        _id: { $ne: existing._id },
        guide: targetFaculty._id,
        academicYear: existing.academicYear || '2026-2027',
        status: { $nin: ['REJECTED'] }
      });
      const maxQuota = targetFaculty.maxProjects || 2;
      if (activeCount >= maxQuota) {
        return res.status(400).json({
          success: false,
          error: `Faculty ${targetFaculty.name} has reached maximum supervision quota (${maxQuota} projects). Cannot approve or supervise additional projects.`
        });
      }
    }

    const project = await Project.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate(POPULATE_PROJECT);

    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to approve project: ' + err.message });
  }
});

// PUT /api/projects/:id/revision — request revision
router.put('/:id/revision', async (req, res) => {
  try {
    const { revisionNotes } = req.body;
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status: 'REVISION_REQUIRED', revisionNotes },
      { new: true }
    ).populate('guide', 'name facultyId staffId email department').populate('department', 'name code');

    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to request revision.' });
  }
});

// PUT /api/projects/:id/reject — reject proposal
router.put('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status: 'REJECTED', revisionNotes: reason },
      { new: true }
    ).populate('guide', 'name facultyId staffId email department').populate('department', 'name code');

    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reject project.' });
  }
});

// PUT /api/projects/:id/assign-guide — assign/reassign guide
router.put('/:id/assign-guide', async (req, res) => {
  try {
    const { guideName, guideId, status, approve } = req.body;
    const conditions = [];
    if (guideId && mongoose.Types.ObjectId.isValid(guideId)) {
      conditions.push({ _id: guideId });
    }
    if (guideId) {
      conditions.push({ facultyId: guideId });
      conditions.push({ staffId: guideId });
    }
    if (guideName) {
      conditions.push({ name: new RegExp(guideName.trim(), 'i') });
    }

    let faculty = null;
    if (conditions.length > 0) {
      faculty = await Faculty.findOne({ $or: conditions });
    }

    if (!faculty) return res.status(404).json({ success: false, error: 'Faculty guide not found.' });

    const existing = await Project.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Project not found.' });

    // Quota Enforcement: Ensure the faculty member does not exceed maxProjects for this academic year
    const isDifferentGuide = !existing.guide || String(existing.guide) !== String(faculty._id);
    if (isDifferentGuide) {
      const activeCount = await Project.countDocuments({
        _id: { $ne: existing._id },
        guide: faculty._id,
        academicYear: existing.academicYear || '2026-2027',
        status: { $nin: ['REJECTED'] }
      });
      const maxQuota = faculty.maxProjects || 2;
      if (activeCount >= maxQuota) {
        return res.status(400).json({
          success: false,
          error: `Faculty ${faculty.name} has reached maximum supervision quota (${maxQuota} projects). Cannot allocate additional projects.`
        });
      }
    }

    const updateFields = { guide: faculty._id };
    if (status) {
      updateFields.status = status;
    } else if (approve === true) {
      updateFields.status = 'APPROVED';
    }
    // If neither status nor approve is explicitly provided, preserve existing proposal status
    // (e.g. SUBMITTED or UNDER_REVIEW remains unchanged so faculty can review & approve it)

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    )
      .populate(POPULATE_PROJECT);

    res.json({ success: true, data: project });
  } catch (err) {
    console.error('PUT /api/projects/:id/assign-guide error:', err);
    res.status(500).json({ success: false, error: 'Failed to assign guide: ' + err.message });
  }
});

// POST /api/projects/:id/comments — add a comment
router.post('/:id/comments', async (req, res) => {
  try {
    const { author, text, isGuide } = req.body;
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { author, text, isGuide: !!isGuide, time: new Date() } } },
      { new: true }
    );

    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });
    res.json({ success: true, data: project.comments });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add comment.' });
  }
});

// PUT /api/projects/:id/complete — faculty guide marks project officially as COMPLETED
router.put('/:id/complete', async (req, res) => {
  try {
    const rawBody = req.body || {};
    let safeNotes = '';
    if (typeof rawBody.finalNotes === 'string') {
      safeNotes = rawBody.finalNotes.trim();
    } else if (typeof rawBody.signOffNotes === 'string') {
      safeNotes = rawBody.signOffNotes.trim();
    } else if (typeof rawBody.remarks === 'string') {
      safeNotes = rawBody.remarks.trim();
    } else if (rawBody.finalNotes && typeof rawBody.finalNotes === 'object') {
      safeNotes = String(rawBody.finalNotes.signOffNotes || rawBody.finalNotes.finalNotes || '').trim();
    }

    const finalGrade = typeof rawBody.finalGrade === 'string' && rawBody.finalGrade.trim()
      ? rawBody.finalGrade.trim()
      : 'A+';
    const finalScore = (rawBody.finalScore !== undefined && rawBody.finalScore !== null && rawBody.finalScore !== '')
      ? Number(rawBody.finalScore)
      : null;

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });

    project.status = 'COMPLETED';
    project.progress = 100;
    project.completedDate = new Date();
    project.finalSignedByGuide = true;
    if (safeNotes) {
      project.finalSignOffNotes = safeNotes;
    }
    project.finalGrade = finalGrade;
    if (finalScore !== null && !isNaN(finalScore)) {
      project.finalScore = finalScore;
    }
    await project.save();

    // Synchronize completion into each team member's projectHistory
    if (Array.isArray(project.teamMembers) && project.teamMembers.length > 0) {
      for (const memId of project.teamMembers) {
        try {
          const studentDoc = await Student.findById(memId);
          if (studentDoc) {
            // Remove previous entry for this project if re-completing
            if (Array.isArray(studentDoc.projectHistory)) {
              studentDoc.projectHistory = studentDoc.projectHistory.filter(
                h => h.project && h.project.toString() !== project._id.toString()
              );
            } else {
              studentDoc.projectHistory = [];
            }
            studentDoc.projectHistory.push({
              project: project._id,
              academicYear: project.academicYear || '2026-2027',
              yearOfStudy: studentDoc.yearOfStudy || 4,
              grade: finalGrade,
              score: finalScore,
              status: 'COMPLETED',
              completedDate: project.completedDate
            });
            await studentDoc.save();
          }
        } catch (memErr) {
          console.warn('Failed to update student projectHistory:', memErr.message);
        }
      }
    }

    const populated = await Project.findById(project._id)
      .populate(POPULATE_PROJECT);

    res.json({
      success: true,
      data: populated,
      message: 'Project officially signed off and marked as COMPLETED.'
    });
  } catch (err) {
    console.error('PUT /api/projects/:id/complete error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/projects/:id/reopen — reopen project if mistakenly marked as completed
router.put('/:id/reopen', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found.' });

    project.status = 'APPROVED';
    project.completedDate = null;
    project.finalSignedByGuide = false;
    await project.save();

    // Remove from team members' projectHistory
    if (Array.isArray(project.teamMembers) && project.teamMembers.length > 0) {
      for (const memId of project.teamMembers) {
        try {
          const studentDoc = await Student.findById(memId);
          if (studentDoc && Array.isArray(studentDoc.projectHistory)) {
            studentDoc.projectHistory = studentDoc.projectHistory.filter(
              h => h.project && h.project.toString() !== project._id.toString()
            );
            await studentDoc.save();
          }
        } catch (mErr) {}
      }
    }

    const populated = await Project.findById(project._id)
      .populate(POPULATE_PROJECT);

    res.json({
      success: true,
      data: populated,
      message: 'Project status restored to Approved/Active.'
    });
  } catch (err) {
    console.error('PUT /api/projects/:id/reopen error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// IEEE DETAILS & STATUS ROUTES
// ==========================================

// Helper to find project in DB or mock
async function findProjectById(id) {
  if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
    const doc = await Project.findById(id).populate(POPULATE_PROJECT);
    if (doc) return doc;
  }
  const mockP = mockProjects.find(p => p._id === id || p.id === id);
  return mockP || null;
}

// GET /api/projects/:id/ieee — Get IEEE Details for a project
router.get('/:id/ieee', async (req, res) => {
  try {
    const project = await findProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    const ieeeDetails = project.ieeeDetails || {
      paperTitle: '',
      conferenceName: '',
      conferenceDate: '',
      latestDraft: null,
      previousDraft: null,
      isSubmitted: false,
      submissionProof: null,
      isAccepted: false,
      acceptanceProof: null,
      isPublished: false,
      publicationProof: null,
      updatedAt: new Date()
    };
    res.json({ success: true, data: ieeeDetails });
  } catch (err) {
    console.error('GET /api/projects/:id/ieee error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/projects/:id/ieee — Update IEEE Details (text & statuses)
router.put('/:id/ieee', async (req, res) => {
  try {
    const {
      paperTitle,
      conferenceName,
      conferenceDate,
      isSubmitted,
      isAccepted,
      isPublished
    } = req.body;

    let project = null;
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id);
    }
    if (!project) {
      project = mockProjects.find(p => p._id === req.params.id || p.id === req.params.id);
    }

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!project.ieeeDetails) {
      project.ieeeDetails = {};
    }

    if (paperTitle !== undefined) project.ieeeDetails.paperTitle = paperTitle;
    if (conferenceName !== undefined) project.ieeeDetails.conferenceName = conferenceName;
    if (conferenceDate !== undefined) project.ieeeDetails.conferenceDate = conferenceDate;
    if (isSubmitted !== undefined) project.ieeeDetails.isSubmitted = !!isSubmitted;
    if (isAccepted !== undefined) project.ieeeDetails.isAccepted = !!isAccepted;
    if (isPublished !== undefined) project.ieeeDetails.isPublished = !!isPublished;
    project.ieeeDetails.updatedAt = new Date();

    if (typeof project.save === 'function') {
      project.markModified('ieeeDetails');
      await project.save();
    }

    res.json({
      success: true,
      data: project.ieeeDetails,
      message: 'IEEE details updated successfully'
    });
  } catch (err) {
    console.error('PUT /api/projects/:id/ieee error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/ieee/draft — Upload new draft (advances latest to previous)
router.post('/:id/ieee/draft', uploadIeeeDraft.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No document file uploaded' });
    }

    let project = null;
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id);
    }
    if (!project) {
      project = mockProjects.find(p => p._id === req.params.id || p.id === req.params.id);
    }

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!project.ieeeDetails) {
      project.ieeeDetails = {};
    }

    const currentLatest = project.ieeeDetails.latestDraft;
    let nextVersion = 1;

    // Shift latest draft to previous draft if latest exists
    if (currentLatest && (currentLatest.fileName || currentLatest.filePath)) {
      nextVersion = (currentLatest.version || 1) + 1;
      project.ieeeDetails.previousDraft = {
        fileName: currentLatest.fileName,
        originalName: currentLatest.originalName || currentLatest.fileName,
        filePath: currentLatest.filePath,
        fileSize: currentLatest.fileSize,
        uploadedAt: currentLatest.uploadedAt || new Date(),
        version: currentLatest.version || 1
      };
    }

    project.ieeeDetails.latestDraft = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: `/uploads/ieee/${req.file.filename}`,
      fileSize: formatBytes(req.file.size),
      uploadedAt: new Date(),
      version: nextVersion
    };
    project.ieeeDetails.updatedAt = new Date();

    if (typeof project.save === 'function') {
      project.markModified('ieeeDetails');
      await project.save();
    }

    res.json({
      success: true,
      data: project.ieeeDetails,
      message: `Draft v${nextVersion} uploaded successfully. Previous draft retained.`
    });
  } catch (err) {
    console.error('POST /api/projects/:id/ieee/draft error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/ieee/proof — Upload proof document for submission, acceptance, or publication
router.post('/:id/ieee/proof', uploadIeeeProof.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No proof file uploaded' });
    }

    const { proofType } = req.body;
    if (!['submission', 'acceptance', 'publication'].includes(proofType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proofType. Must be submission, acceptance, or publication.'
      });
    }

    let project = null;
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(req.params.id)) {
      project = await Project.findById(req.params.id);
    }
    if (!project) {
      project = mockProjects.find(p => p._id === req.params.id || p.id === req.params.id);
    }

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!project.ieeeDetails) {
      project.ieeeDetails = {};
    }

    const proofData = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: `/uploads/ieee/${req.file.filename}`,
      fileSize: formatBytes(req.file.size),
      uploadedAt: new Date()
    };

    if (proofType === 'submission') {
      project.ieeeDetails.submissionProof = proofData;
      project.ieeeDetails.isSubmitted = true;
    } else if (proofType === 'acceptance') {
      project.ieeeDetails.acceptanceProof = proofData;
      project.ieeeDetails.isAccepted = true;
    } else if (proofType === 'publication') {
      project.ieeeDetails.publicationProof = proofData;
      project.ieeeDetails.isPublished = true;
    }

    project.ieeeDetails.updatedAt = new Date();

    if (typeof project.save === 'function') {
      project.markModified('ieeeDetails');
      await project.save();
    }

    res.json({
      success: true,
      data: project.ieeeDetails,
      message: `${proofType.charAt(0).toUpperCase() + proofType.slice(1)} proof uploaded successfully.`
    });
  } catch (err) {
    console.error('POST /api/projects/:id/ieee/proof error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
