const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Project = require('../models/Project');
const Team = require('../models/Team');

const POPULATE_STUDENT_PROJECT = 'title status domain batch academicYear leadName leadRegNo';

// GET /api/users/students — list all students
router.get('/students', async (req, res) => {
  try {
    let students = await Student.find()
      .populate('department', 'name code')
      .populate('project', POPULATE_STUDENT_PROJECT)
      .sort({ name: 1 });

    // Self-healing synchronization: check if any student has an active project in Project.teamMembers but missing student.project
    let needsRefetch = false;
    for (const student of students) {
      if (!student.project) {
        const activeProj = await Project.findOne({
          teamMembers: student._id
        }).sort({ createdAt: -1 });
        if (activeProj) {
          student.project = activeProj._id;
          await Student.findByIdAndUpdate(student._id, { project: activeProj._id });
          needsRefetch = true;
        }
      }
    }

    if (needsRefetch) {
      students = await Student.find()
        .populate('department', 'name code')
        .populate('project', POPULATE_STUDENT_PROJECT)
        .sort({ name: 1 });
    }

    res.json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch students.' });
  }
});

// GET /api/users/students/email/:email — find student by email
router.get('/students/email/:email', async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.params.email })
      .populate('department', 'name code')
      .populate('project', POPULATE_STUDENT_PROJECT);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch student.' });
  }
});

// GET /api/users/students/:id — find student by ID
router.get('/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('department', 'name code')
      .populate('project', POPULATE_STUDENT_PROJECT);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch student.' });
  }
});

// POST /api/users/students — Admin manually registers student
router.post('/students', async (req, res) => {
  try {
    const { name, email, password, regNo, department, departmentName, year, yearOfStudy, batch } = req.body;
    const cleanEmail = email ? email.toLowerCase().trim() : '';
    const cleanReg = regNo ? regNo.trim() : '';
    const studentPassword = (password && password.trim()) ? password.trim() : cleanReg;

    if (!name || !cleanEmail || !cleanReg || !studentPassword) {
      return res.status(400).json({ success: false, error: 'Name, email, and register number are required.' });
    }

    const existingStudent = await Student.findOne({ $or: [{ email: cleanEmail }, { regNo: cleanReg }] });
    if (existingStudent) {
      return res.status(409).json({ success: false, error: 'Student with this email or register number already exists.' });
    }

    let deptDoc = null;
    const deptRef = department || departmentName;
    if (deptRef) {
      if (mongoose.Types.ObjectId.isValid(deptRef)) {
        deptDoc = await Department.findById(deptRef);
      }
      if (!deptDoc) {
        deptDoc = await Department.findOne({
          $or: [
            { name: new RegExp(deptRef, 'i') },
            { code: new RegExp(deptRef, 'i') }
          ]
        });
      }
    }
    if (!deptDoc) deptDoc = await Department.findOne();
    if (!deptDoc) return res.status(400).json({ success: false, error: 'No department found.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(studentPassword, salt);

    // Compute Year of Study from academic setting & batch
    const SystemSetting = require('../models/SystemSetting');
    let setting = await SystemSetting.findOne({ key: 'academic_settings' });
    const currentAcademicYear = setting?.currentAcademicYear || '2026-2027';

    const studentBatch = (batch && batch.trim()) ? batch.trim() : '2023-2027';
    let yr = Number(yearOfStudy || year);
    if (studentBatch) {
      const curStart = parseInt(currentAcademicYear.split('-')[0], 10) || 2026;
      const batchStart = parseInt(studentBatch.split('-')[0], 10) || 2023;
      yr = Math.max(1, Math.min(4, (curStart - batchStart) + 1));
    } else if (!yr) {
      yr = 4;
    }

    const student = new Student({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      regNo: cleanReg,
      department: deptDoc._id,
      batch: studentBatch,
      year: yr,
      yearOfStudy: yr,
      role: 'STUDENT'
    });

    await student.save();
    const populated = await Student.findById(student._id)
      .populate('department', 'name code')
      .populate('project', POPULATE_STUDENT_PROJECT);

    res.status(201).json({ success: true, message: 'Student account created successfully.', data: populated });
  } catch (err) {
    console.error('POST /api/users/students error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to create student account.' });
  }
});

// PUT /api/users/students/:id — Admin updates student details
router.put('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, regNo, department, departmentName, year, yearOfStudy, batch, password } = req.body;

    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    if (name) student.name = name.trim();
    if (email) student.email = email.toLowerCase().trim();
    if (regNo) student.regNo = regNo.trim();
    if (batch) {
      student.batch = batch.trim();
      const SystemSetting = require('../models/SystemSetting');
      let setting = await SystemSetting.findOne({ key: 'academic_settings' });
      const currentAcademicYear = setting?.currentAcademicYear || '2026-2027';
      const curStart = parseInt(currentAcademicYear.split('-')[0], 10) || 2026;
      const batchStart = parseInt(student.batch.split('-')[0], 10) || 2023;
      const yr = Math.max(1, Math.min(4, (curStart - batchStart) + 1));
      student.year = yr;
      student.yearOfStudy = yr;
    } else if (yearOfStudy || year) {
      const yr = Number(yearOfStudy || year);
      student.year = yr;
      student.yearOfStudy = yr;
    }

    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      student.password = await bcrypt.hash(password.trim(), salt);
    }

    const deptRef = department || departmentName;
    if (deptRef) {
      let deptDoc = null;
      if (mongoose.Types.ObjectId.isValid(deptRef)) {
        deptDoc = await Department.findById(deptRef);
      }
      if (!deptDoc) {
        deptDoc = await Department.findOne({
          $or: [
            { name: new RegExp(deptRef, 'i') },
            { code: new RegExp(deptRef, 'i') }
          ]
        });
      }
      if (deptDoc) student.department = deptDoc._id;
    }

    await student.save();
    const populated = await Student.findById(student._id)
      .populate('department', 'name code')
      .populate('project', POPULATE_STUDENT_PROJECT);

    res.json({ success: true, message: 'Student updated successfully.', data: populated });
  } catch (err) {
    console.error('PUT /api/users/students/:id error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update student.' });
  }
});

// Helper to completely purge a project and all associated sub-resources from the entire database
async function cleanupAndRemoveProject(projectId) {
  if (!projectId) return;
  const Milestone = require('../models/Milestone');
  const Task = require('../models/Task');
  const WeeklyProgress = require('../models/WeeklyProgress');
  const Document = require('../models/Document');
  const Feedback = require('../models/Feedback');
  const Review = require('../models/Review');
  const ReviewEvaluation = require('../models/ReviewEvaluation');
  const ReviewSubmission = require('../models/ReviewSubmission');
  const Team = require('../models/Team');

  await Promise.allSettled([
    Milestone.deleteMany({ project: projectId }),
    Task.deleteMany({ project: projectId }),
    WeeklyProgress.deleteMany({ project: projectId }),
    Document.deleteMany({ project: projectId }),
    Feedback.deleteMany({ project: projectId }),
    ReviewEvaluation.deleteMany({ project: projectId }),
    ReviewSubmission.deleteMany({ project: projectId }),
    Review.deleteMany({ project: projectId }),
    Team.deleteMany({ project: projectId }),
    Student.updateMany({ project: projectId }, { $unset: { project: '' } }),
    Project.findByIdAndDelete(projectId)
  ]);
}

// DELETE /api/users/students/:id — Admin deletes student
router.delete('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found.' });

    // 1. Identify all projects where this student is a team member or assigned
    const studentProjects = await Project.find({
      $or: [
        { teamMembers: student._id },
        { _id: student.project }
      ]
    });

    for (const proj of studentProjects) {
      // Pull this student from the project's teamMembers
      proj.teamMembers = (proj.teamMembers || []).filter(
        mId => mId && mId.toString() !== student._id.toString()
      );

      // If the last team member of a project is deleted, completely remove the whole project itself
      if (proj.teamMembers.length === 0) {
        await cleanupAndRemoveProject(proj._id);
      } else {
        await proj.save();
      }
    }

    // 2. Clean up from Teams
    const studentTeams = await Team.find({
      $or: [
        { leader: student._id },
        { 'members.student': student._id }
      ]
    });

    for (const team of studentTeams) {
      team.members = (team.members || []).filter(
        m => m.student && m.student.toString() !== student._id.toString()
      );

      if (team.leader && team.leader.toString() === student._id.toString()) {
        if (team.members.length > 0) {
          team.leader = team.members[0].student;
          team.members[0].role = 'LEADER';
          await team.save();
        } else {
          await Team.findByIdAndDelete(team._id);
        }
      } else if (team.members.length === 0) {
        await Team.findByIdAndDelete(team._id);
      } else {
        await team.save();
      }
    }

    // 3. Delete the student document
    await Student.findByIdAndDelete(id);
    res.json({
      success: true,
      message: 'Student account deleted and project associations synchronized successfully.'
    });
  } catch (err) {
    console.error('DELETE /api/users/students/:id error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to delete student.' });
  }
});

// GET /api/users/faculty — list all faculty
router.get('/faculty', async (req, res) => {
  try {
    const faculty = await Faculty.find()
      .populate('department', 'name code')
      .sort({ name: 1 });
    res.json({ success: true, data: faculty });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch faculty.' });
  }
});

// GET /api/users/faculty/email/:email — find faculty by email
router.get('/faculty/email/:email', async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ email: req.params.email })
      .populate('department', 'name code');
    if (!faculty) return res.status(404).json({ success: false, error: 'Faculty not found.' });
    res.json({ success: true, data: faculty });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch faculty.' });
  }
});

// GET /api/users/faculty/:id — find faculty by ID
router.get('/faculty/:id', async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate('department', 'name code');
    if (!faculty) return res.status(404).json({ success: false, error: 'Faculty not found.' });
    res.json({ success: true, data: faculty });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch faculty.' });
  }
});

// POST /api/users/faculty — Admin manually registers faculty
router.post('/faculty', async (req, res) => {
  try {
    const { name, email, password, facultyId, department, departmentName, designation, maxProjects } = req.body;

    const cleanEmail = email ? email.toLowerCase().trim() : '';
    const cleanId = facultyId ? facultyId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : '';
    const facultyPassword = (password && password.trim()) ? password.trim() : 'Password@123';

    if (!name || !cleanEmail || !cleanId) {
      return res.status(400).json({ success: false, error: 'Name, email, and valid faculty ID (up to 8 alphanumeric characters) are required.' });
    }

    const existingFaculty = await Faculty.findOne({ $or: [{ email: cleanEmail }, { facultyId: cleanId }] });
    if (existingFaculty) {
      return res.status(409).json({ success: false, error: 'Faculty with this email or faculty ID already exists.' });
    }

    let deptDoc = null;
    const deptRef = department || departmentName;
    if (deptRef) {
      if (mongoose.Types.ObjectId.isValid(deptRef)) {
        deptDoc = await Department.findById(deptRef);
      }
      if (!deptDoc) {
        deptDoc = await Department.findOne({
          $or: [
            { name: new RegExp(deptRef, 'i') },
            { code: new RegExp(deptRef, 'i') }
          ]
        });
      }
    }
    if (!deptDoc) deptDoc = await Department.findOne();
    if (!deptDoc) return res.status(400).json({ success: false, error: 'No department found.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(facultyPassword, salt);

    let finalDesignation = (designation && designation.trim()) || 'Assistant Professor I';
    if (finalDesignation === 'Professor &Head') finalDesignation = 'Professor & Head';
    const allowedDesignations = [
      'Professor & Head',
      'Professor',
      'Associate Professor',
      'Assistant Professor I',
      'Assistant Professor II',
      'Assistant Professor III'
    ];
    if (!allowedDesignations.includes(finalDesignation)) {
      finalDesignation = 'Assistant Professor I';
    }

    const faculty = new Faculty({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      facultyId: cleanId,
      department: deptDoc._id,
      designation: finalDesignation,
      maxProjects: Number(maxProjects) || 2,
      role: 'FACULTY'
    });

    await faculty.save();
    const populated = await Faculty.findById(faculty._id)
      .populate('department', 'name code');

    res.status(201).json({ success: true, message: 'Faculty account created successfully.', data: populated });
  } catch (err) {
    console.error('POST /api/users/faculty error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to create faculty account.' });
  }
});

// PUT /api/users/faculty/:id — Admin updates faculty details
router.put('/faculty/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, facultyId, department, departmentName, designation, maxProjects, password } = req.body;

    const faculty = await Faculty.findById(id);
    if (!faculty) return res.status(404).json({ success: false, error: 'Faculty not found.' });

    if (name) faculty.name = name.trim();
    if (email) faculty.email = email.toLowerCase().trim();
    if (facultyId) {
      const cleanId = facultyId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (cleanId) faculty.facultyId = cleanId;
    }
    if (designation) {
      let finalDesignation = designation.trim();
      if (finalDesignation === 'Professor &Head') finalDesignation = 'Professor & Head';
      const allowedDesignations = [
        'Professor & Head',
        'Professor',
        'Associate Professor',
        'Assistant Professor I',
        'Assistant Professor II',
        'Assistant Professor III'
      ];
      if (allowedDesignations.includes(finalDesignation)) {
        faculty.designation = finalDesignation;
      }
    }
    if (maxProjects !== undefined) faculty.maxProjects = Number(maxProjects) || 2;

    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      faculty.password = await bcrypt.hash(password.trim(), salt);
    }

    const deptRef = department || departmentName;
    if (deptRef) {
      let deptDoc = null;
      if (mongoose.Types.ObjectId.isValid(deptRef)) {
        deptDoc = await Department.findById(deptRef);
      }
      if (!deptDoc) {
        deptDoc = await Department.findOne({
          $or: [
            { name: new RegExp(deptRef, 'i') },
            { code: new RegExp(deptRef, 'i') }
          ]
        });
      }
      if (deptDoc) faculty.department = deptDoc._id;
    }

    await faculty.save();
    const populated = await Faculty.findById(faculty._id)
      .populate('department', 'name code');

    res.json({ success: true, message: 'Faculty updated successfully.', data: populated });
  } catch (err) {
    console.error('PUT /api/users/faculty/:id error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update faculty.' });
  }
});

// DELETE /api/users/faculty/:id — Admin deletes faculty
router.delete('/faculty/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const faculty = await Faculty.findById(id);
    if (!faculty) return res.status(404).json({ success: false, error: 'Faculty not found.' });

    await Project.updateMany(
      { guide: faculty._id },
      { $unset: { guide: 1 } }
    );

    await Faculty.findByIdAndDelete(id);
    res.json({ success: true, message: 'Faculty account deleted successfully.' });
  } catch (err) {
    console.error('DELETE /api/users/faculty/:id error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to delete faculty.' });
  }
});

// GET /api/users/departments — list all departments
router.get('/departments', async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch departments.' });
  }
});

module.exports = router;
