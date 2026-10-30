const express = require('express');
const router = express.Router();
const SystemSetting = require('../models/SystemSetting');
const Student = require('../models/Student');
const Project = require('../models/Project');
const Team = require('../models/Team');

// Helper to compute Year of Study and graduation status from academic year & batch
function computeStudentAcademicState(academicYear, batch) {
  if (!academicYear || !batch) return { yearOfStudy: 4, isPassedOut: false, academicStatus: 'ENROLLED' };
  const curStart = parseInt(academicYear.split('-')[0], 10);
  const parts = batch.split('-');
  const batchStart = parseInt(parts[0], 10);
  const batchEnd = parseInt(parts[1], 10);

  if (isNaN(curStart) || isNaN(batchStart)) {
    return { yearOfStudy: 4, isPassedOut: false, academicStatus: 'ENROLLED' };
  }

  const rawYear = (curStart - batchStart) + 1;
  const isPassedOut = (!isNaN(batchEnd) && curStart >= batchEnd) || rawYear > 4;

  if (isPassedOut) {
    return {
      yearOfStudy: Math.max(5, rawYear),
      isPassedOut: true,
      academicStatus: 'PASSED_OUT'
    };
  }

  return {
    yearOfStudy: Math.max(1, Math.min(4, rawYear)),
    isPassedOut: false,
    academicStatus: 'ENROLLED'
  };
}

// Helper to compute active undergraduate cohort batches for any academic year
function generateBatchesForAcademicYear(academicYear) {
  const start = parseInt((academicYear || '').split('-')[0], 10);
  if (isNaN(start)) return ['2023-2027', '2024-2028', '2025-2029', '2026-2030'];
  return [
    `${start - 3}-${start + 1}`, // Year IV (Senior Cohort)
    `${start - 2}-${start + 2}`, // Year III
    `${start - 1}-${start + 3}`, // Year II
    `${start}-${start + 4}`       // Year I (Freshman Cohort)
  ];
}

// Helper to determine allowed academic year choices based strictly on current calendar year
function getAllowedAcademicYears() {
  const calYear = new Date().getFullYear();
  return [
    `${calYear - 1}-${calYear}`,
    `${calYear}-${calYear + 1}`
  ];
}

// Deprecated alias for backwards compatibility
function computeYearOfStudy(academicYear, batch) {
  return computeStudentAcademicState(academicYear, batch).yearOfStudy;
}

// GET /api/settings — get current system academic settings
router.get('/', async (req, res) => {
  try {
    let setting = await SystemSetting.findOne({ key: 'academic_settings' });
    if (!setting) {
      setting = await SystemSetting.create({
        key: 'academic_settings',
        currentAcademicYear: '2026-2027',
        availableBatches: generateBatchesForAcademicYear('2026-2027')
      });
    } else if (!setting.availableBatches || !Array.isArray(setting.availableBatches) || setting.availableBatches.length === 0) {
      setting.availableBatches = generateBatchesForAcademicYear(setting.currentAcademicYear);
      await setting.save();
    }
    const calYear = new Date().getFullYear();
    const allowed = getAllowedAcademicYears();
    const settingObj = setting.toObject();
    res.json({
      success: true,
      data: {
        ...settingObj,
        calendarYear: calYear,
        allowedAcademicYears: allowed
      }
    });
  } catch (err) {
    console.error('GET /api/settings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings — update current academic year and recalculate all students' year of study & graduation status
router.put('/', async (req, res) => {
  try {
    const { currentAcademicYear, availableBatches, force } = req.body;
    if (!currentAcademicYear) {
      return res.status(400).json({ success: false, error: 'currentAcademicYear is required.' });
    }

    const newAcadYear = currentAcademicYear.trim();
    const calYear = new Date().getFullYear();
    const allowed = getAllowedAcademicYears();

    // Calendar Year Enforcement: In 2026, choices are 2025-2026 and 2026-2027
    if (!force && !allowed.includes(newAcadYear)) {
      return res.status(400).json({
        success: false,
        error: `In calendar year ${calYear}, valid academic years are ${allowed.join(' and ')}. Advancing beyond ${allowed[1]} is only permitted when the calendar year progresses to ${calYear + 1}.`
      });
    }

    let setting = await SystemSetting.findOne({ key: 'academic_settings' });
    if (!setting) {
      setting = new SystemSetting({ key: 'academic_settings' });
    }

    const prevAcadYear = setting.currentAcademicYear || '2026-2027';
    const isRevert = parseInt(newAcadYear.split('-')[0], 10) < parseInt(prevAcadYear.split('-')[0], 10);
    const transitionType = isRevert ? 'REVERT' : (newAcadYear === prevAcadYear ? 'UPDATE' : 'ADVANCE');

    // Snapshot backup prior state before making changes
    const students = await Student.find({});
    if (prevAcadYear !== newAcadYear) {
      if (!Array.isArray(setting.snapshots)) {
        setting.snapshots = [];
      }
      setting.snapshots.push({
        academicYear: prevAcadYear,
        timestamp: new Date(),
        transitionType,
        studentsState: students.map(s => ({
          studentId: s._id,
          yearOfStudy: s.yearOfStudy,
          year: s.year,
          batch: s.batch,
          isPassedOut: s.isPassedOut,
          academicStatus: s.academicStatus,
          project: s.project,
          team: s.team
        }))
      });
      if (setting.snapshots.length > 10) {
        setting.snapshots = setting.snapshots.slice(-10);
      }
    }

    setting.currentAcademicYear = newAcadYear;
    if (availableBatches && Array.isArray(availableBatches) && availableBatches.length > 0) {
      setting.availableBatches = availableBatches;
    } else {
      setting.availableBatches = generateBatchesForAcademicYear(newAcadYear);
    }
    await setting.save();

    // Recalculate year of study and re-align active project / team pointers for all students
    let updatedCount = 0;
    for (const student of students) {
      const studentBatch = student.batch || '2023-2027';
      const academicState = computeStudentAcademicState(newAcadYear, studentBatch);

      student.batch = studentBatch;
      student.yearOfStudy = academicState.yearOfStudy;
      student.year = academicState.yearOfStudy;
      student.isPassedOut = academicState.isPassedOut;
      student.academicStatus = academicState.academicStatus;

      if (academicState.isPassedOut) {
        // Graduated / passed-out students cannot have active projects or teams in the new academic cycle
        student.project = null;
        student.team = null;
      } else {
        // Find if enrolled student already has a project created specifically for this academic year
        const currentYearProject = await Project.findOne({
          teamMembers: student._id,
          academicYear: newAcadYear
        });
        student.project = currentYearProject ? currentYearProject._id : null;

        // Find if student has an active team for this academic year
        const currentYearTeam = await Team.findOne({
          academicYear: newAcadYear,
          status: { $ne: 'DISBANDED' },
          $or: [
            { leader: student._id },
            { members: { $elemMatch: { student: student._id, status: 'ACCEPTED' } } }
          ]
        });
        student.team = currentYearTeam ? currentYearTeam._id : null;
      }

      // Synchronize past completed projects into student.projectHistory
      const pastCompletedProjects = await Project.find({
        teamMembers: student._id,
        status: 'COMPLETED'
      });
      if (!Array.isArray(student.projectHistory)) {
        student.projectHistory = [];
      }
      for (const cp of pastCompletedProjects) {
        const inHistory = student.projectHistory.some(
          h => h.project && h.project.toString() === cp._id.toString()
        );
        if (!inHistory) {
          const cpState = computeStudentAcademicState(cp.academicYear || '2026-2027', studentBatch);
          student.projectHistory.push({
            project: cp._id,
            academicYear: cp.academicYear || '2026-2027',
            yearOfStudy: Math.min(4, cpState.yearOfStudy),
            grade: cp.finalGrade || 'A+',
            score: cp.finalScore,
            status: 'COMPLETED',
            completedDate: cp.completedDate || cp.updatedAt
          });
        }
      }

      await student.save();
      updatedCount++;
    }

    const settingObj = setting.toObject();
    res.json({
      success: true,
      data: {
        ...settingObj,
        calendarYear: calYear,
        allowedAcademicYears: allowed
      },
      updatedCount,
      transitionType,
      message: `System Academic Year updated to ${setting.currentAcademicYear} (${transitionType}). Recalculated cohorts and synchronized workspaces for ${updatedCount} students.`
    });
  } catch (err) {
    console.error('PUT /api/settings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
