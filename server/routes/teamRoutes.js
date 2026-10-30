const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Team = require('../models/Team');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const Project = require('../models/Project');
const SystemSetting = require('../models/SystemSetting');

// Middleware to extract authenticated student
const extractStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'projintel_jwt_secret_vcet_2026_secure_key');
      userId = decoded.id || decoded._id;
    } else if (req.query.studentId || req.body.studentId) {
      userId = req.query.studentId || req.body.studentId;
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, error: 'Student authentication required.' });
    }

    const student = await Student.findById(userId).populate('department', 'name code');
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student account not found.' });
    }
    req.student = student;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
  }
};

// GET /api/teams/my-team — get current student's team for active academic year
router.get('/my-team', extractStudent, async (req, res) => {
  try {
    const studentId = req.student._id;
    let activeAcadYear = '2026-2027';
    try {
      const setting = await SystemSetting.findOne({ key: 'academic_settings' });
      if (setting && setting.currentAcademicYear) {
        activeAcadYear = setting.currentAcademicYear.trim();
      }
    } catch (sErr) {}

    // Find team for active academic year where student is leader or accepted member
    let team = await Team.findOne({
      academicYear: activeAcadYear,
      status: { $ne: 'DISBANDED' },
      $or: [
        { leader: studentId },
        { members: { $elemMatch: { student: studentId, status: 'ACCEPTED' } } }
      ]
    })
      .populate('leader', 'name regNo email department')
      .populate('department', 'name code')
      .populate('members.student', 'name regNo email department')
      .populate('project', 'title status progress academicYear');

    // Fallback: If no team found with explicit academicYear, search latest non-disbanded team
    if (!team) {
      team = await Team.findOne({
        status: { $ne: 'DISBANDED' },
        $or: [
          { leader: studentId },
          { members: { $elemMatch: { student: studentId, status: 'ACCEPTED' } } }
        ]
      })
        .sort({ createdAt: -1 })
        .populate('leader', 'name regNo email department')
        .populate('department', 'name code')
        .populate('members.student', 'name regNo email department')
        .populate('project', 'title status progress academicYear');
      
      // If found team belongs to an old year and already has a completed project, do not lock student into it for current year
      if (team && team.project && team.project.status === 'COMPLETED' && team.academicYear && team.academicYear !== activeAcadYear) {
        team = null;
      }
    }

    if (!team) {
      return res.json({ success: true, data: null, isLeader: false });
    }

    const isLeader = team.leader?._id?.toString() === studentId.toString();
    res.json({ success: true, data: team, isLeader });
  } catch (err) {
    console.error('GET /api/teams/my-team error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/teams/available-students — list students eligible to be invited for active academic year
router.get('/available-students', extractStudent, async (req, res) => {
  try {
    const studentId = req.student._id;
    const { search, department } = req.query;

    let activeAcadYear = '2026-2027';
    try {
      const setting = await SystemSetting.findOne({ key: 'academic_settings' });
      if (setting && setting.currentAcademicYear) {
        activeAcadYear = setting.currentAcademicYear.trim();
      }
    } catch (sErr) {}

    // 1. Find all student IDs that already belong to an active formed or accepted team in current academic year
    const activeTeams = await Team.find({
      academicYear: activeAcadYear,
      status: { $in: ['FORMING', 'FORMED', 'PROPOSED'] }
    });

    const busyStudentIds = new Set();
    busyStudentIds.add(studentId.toString()); // exclude self

    for (const t of activeTeams) {
      if (t.leader) busyStudentIds.add(t.leader.toString());
      for (const m of t.members) {
        if (m.status === 'ACCEPTED' || (t.status === 'FORMING' && m.status === 'PENDING')) {
          busyStudentIds.add(m.student.toString());
        }
      }
    }

    // Also exclude any student who already has a project for this academic year
    const currentYearProjects = await Project.find({ academicYear: activeAcadYear });
    for (const p of currentYearProjects) {
      if (Array.isArray(p.teamMembers)) {
        for (const m of p.teamMembers) {
          busyStudentIds.add(m.toString());
        }
      }
    }

    const leaderDeptId = (req.student.department?._id || req.student.department);
    const leaderBatch = (req.student.batch || '').trim();
    const leaderYear = Number(req.student.yearOfStudy || req.student.year || 4);

    // 2. Query students who are not in busyStudentIds and are actively enrolled (not graduated)
    // Team formation is strictly restricted to students of the SAME batch and SAME department!
    const query = {
      _id: { $nin: Array.from(busyStudentIds).map(id => new mongoose.Types.ObjectId(id)) },
      isPassedOut: { $ne: true },
      academicStatus: { $ne: 'PASSED_OUT' }
    };

    if (leaderDeptId) {
      query.department = leaderDeptId;
    }

    if (leaderBatch) {
      query.batch = leaderBatch;
    } else if (leaderYear) {
      query.yearOfStudy = leaderYear;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { regNo: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } }
      ];
    }

    const available = await Student.find(query)
      .select('name regNo email department year yearOfStudy batch')
      .populate('department', 'name code')
      .sort({ regNo: 1 })
      .limit(50);

    res.json({ success: true, data: available });
  } catch (err) {
    console.error('GET /api/teams/available-students error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/teams/invitations/pending — get pending invites received by student
router.get('/invitations/pending', extractStudent, async (req, res) => {
  try {
    const studentId = req.student._id;

    const invitations = await Team.find({
      status: 'FORMING',
      members: {
        $elemMatch: {
          student: studentId,
          status: 'PENDING'
        }
      }
    })
      .populate('leader', 'name regNo email department')
      .populate('department', 'name code')
      .populate('members.student', 'name regNo email');

    res.json({ success: true, data: invitations });
  } catch (err) {
    console.error('GET /api/teams/invitations/pending error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/teams/create — initialize a new team with target size (1-4)
router.post('/create', extractStudent, async (req, res) => {
  try {
    const student = req.student;
    const { targetSize, name, invitedStudentIds = [] } = req.body;

    const size = parseInt(targetSize, 10);
    if (isNaN(size) || size < 1 || size > 4) {
      return res.status(400).json({ success: false, error: 'Team size must be between 1 and 4 members.' });
    }

    // Guard: Passed-out or graduated students cannot create teams
    if (student.isPassedOut || student.academicStatus === 'PASSED_OUT' || (student.yearOfStudy && student.yearOfStudy > 4)) {
      return res.status(403).json({
        success: false,
        error: 'Graduated / passed-out students cannot create teams or propose projects.'
      });
    }

    let activeAcadYear = '2026-2027';
    try {
      const setting = await SystemSetting.findOne({ key: 'academic_settings' });
      if (setting && setting.currentAcademicYear) {
        activeAcadYear = setting.currentAcademicYear.trim();
      }
    } catch (sErr) {}

    // Check if student already has a project in active academic year
    const existingProject = await Project.findOne({
      teamMembers: student._id,
      academicYear: activeAcadYear
    });
    if (existingProject) {
      return res.status(400).json({
        success: false,
        error: `You already have a project for Academic Year ${activeAcadYear} ("${existingProject.title}"). As per university regulations, each student can only do one project per academic year.`
      });
    }

    // Check if student already belongs to an active team in active academic year
    const existingActiveTeam = await Team.findOne({
      academicYear: activeAcadYear,
      status: { $in: ['FORMING', 'FORMED', 'PROPOSED'] },
      $or: [
        { leader: student._id },
        { members: { $elemMatch: { student: student._id, status: 'ACCEPTED' } } }
      ]
    });
    if (existingActiveTeam) {
      return res.status(400).json({ success: false, error: `You already belong to an active team for Academic Year ${activeAcadYear}.` });
    }

    // Build members list starting with leader (auto-accepted)
    const members = [
      {
        student: student._id,
        role: 'LEADER',
        status: 'ACCEPTED',
        invitedAt: new Date(),
        respondedAt: new Date()
      }
    ];

    // For group teams (size > 1), validate and add invited students
    if (size > 1 && Array.isArray(invitedStudentIds) && invitedStudentIds.length > 0) {
      if (invitedStudentIds.length > (size - 1)) {
        return res.status(400).json({
          success: false,
          error: `A team of size ${size} can have at most ${size - 1} invited member(s).`
        });
      }

      for (const invId of invitedStudentIds) {
        if (!mongoose.Types.ObjectId.isValid(invId)) continue;
        if (invId.toString() === student._id.toString()) continue;

        // Check if student exists and has no project/team in current academic year
        const targetStudent = await Student.findById(invId).populate('department');
        if (targetStudent) {
          if (targetStudent.isPassedOut || targetStudent.academicStatus === 'PASSED_OUT' || (targetStudent.yearOfStudy && targetStudent.yearOfStudy > 4)) {
            continue; // Skip graduated / passed-out students
          }

          // Strict Validation: Must be same department
          const targetDeptId = (targetStudent.department?._id || targetStudent.department)?.toString();
          const leaderDeptId = (student.department?._id || student.department)?.toString();
          if (targetDeptId && leaderDeptId && targetDeptId !== leaderDeptId) {
            return res.status(400).json({
              success: false,
              error: `Team formation is only permitted between students of the same department. ${targetStudent.name} is in a different department.`
            });
          }

          // Strict Validation: Must be same batch
          const targetBatch = (targetStudent.batch || '').trim();
          const leaderBatch = (student.batch || '').trim();
          if (targetBatch && leaderBatch && targetBatch !== leaderBatch) {
            return res.status(400).json({
              success: false,
              error: `Team formation is only permitted between students of the same batch. ${targetStudent.name} is in batch ${targetBatch}, while you are in batch ${leaderBatch}.`
            });
          }

          const targetProj = await Project.findOne({ teamMembers: targetStudent._id, academicYear: activeAcadYear });
          const targetTeam = await Team.findOne({
            academicYear: activeAcadYear,
            status: { $in: ['FORMING', 'FORMED', 'PROPOSED'] },
            $or: [
              { leader: targetStudent._id },
              { members: { $elemMatch: { student: targetStudent._id, status: 'ACCEPTED' } } }
            ]
          });
          if (!targetProj && !targetTeam) {
            members.push({
              student: targetStudent._id,
              role: 'MEMBER',
              status: 'PENDING',
              invitedAt: new Date()
            });
          }
        }
      }
    }

    const isSolo = size === 1;
    const team = new Team({
      name: (name && name.trim()) || `${student.name.split(' ')[0]}'s Team`,
      leader: student._id,
      targetSize: size,
      department: student.department?._id || student.department,
      status: isSolo ? 'FORMED' : 'FORMING',
      academicYear: activeAcadYear,
      batch: student.batch || '2023-2027',
      members
    });

    await team.save();

    // Update student's team reference
    student.team = team._id;
    await student.save();

    // Send notifications to invited students
    if (!isSolo) {
      for (const m of members) {
        if (m.role === 'MEMBER' && m.status === 'PENDING') {
          try {
            await Notification.create({
              recipient: m.student,
              recipientModel: 'Student',
              sender: student._id,
              senderModel: 'Student',
              title: 'Team Invitation Received',
              message: `${student.name} (${student.regNo}) has invited you to join their ${size}-member project team: "${team.name}".`,
              type: 'STATUS_CHANGE'
            });
          } catch (notifErr) {
            console.warn('Could not dispatch team invite notification:', notifErr.message);
          }
        }
      }
    }

    const populated = await Team.findById(team._id)
      .populate('leader', 'name regNo email department')
      .populate('department', 'name code')
      .populate('members.student', 'name regNo email department');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /api/teams/create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/teams/:teamId/respond — accept or decline an invitation
router.post('/:teamId/respond', extractStudent, async (req, res) => {
  try {
    const student = req.student;
    const { action } = req.body; // 'ACCEPT' | 'DECLINE'
    const { teamId } = req.params;

    if (!['ACCEPT', 'DECLINE'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action must be ACCEPT or DECLINE.' });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found.' });
    }

    if (team.status !== 'FORMING') {
      return res.status(400).json({ success: false, error: `Team is already in ${team.status} state.` });
    }

    if (action === 'ACCEPT' && (student.isPassedOut || student.academicStatus === 'PASSED_OUT' || (student.yearOfStudy && student.yearOfStudy > 4))) {
      return res.status(403).json({ success: false, error: 'Graduated / passed-out students cannot join project teams.' });
    }

    const memberEntry = team.members.find(
      m => m.student.toString() === student._id.toString() && m.status === 'PENDING'
    );

    if (!memberEntry) {
      return res.status(400).json({ success: false, error: 'No pending invitation found for your account in this team.' });
    }

    if (action === 'ACCEPT') {
      // Check if student is already in another formed team
      const alreadyAccepted = await Team.findOne({
        _id: { $ne: team._id },
        status: { $in: ['FORMING', 'FORMED', 'PROPOSED'] },
        $or: [
          { leader: student._id },
          { members: { $elemMatch: { student: student._id, status: 'ACCEPTED' } } }
        ]
      });
      if (alreadyAccepted) {
        return res.status(400).json({ success: false, error: 'You are already an accepted member of another team.' });
      }

      memberEntry.status = 'ACCEPTED';
      memberEntry.respondedAt = new Date();

      student.team = team._id;
      await student.save();

      // Check if all slots are now accepted
      const acceptedCount = team.members.filter(m => m.status === 'ACCEPTED').length;
      if (acceptedCount >= team.targetSize) {
        team.status = 'FORMED';

        // Notify leader that team is complete
        await Notification.create({
          recipient: team.leader,
          recipientModel: 'Student',
          title: 'Project Team Fully Formed!',
          message: `All ${team.targetSize} members have accepted! You can now propose your academic project proposal.`,
          type: 'STATUS_CHANGE'
        });
      } else {
        // Notify leader of acceptance
        await Notification.create({
          recipient: team.leader,
          recipientModel: 'Student',
          title: 'Team Member Joined',
          message: `${student.name} (${student.regNo}) has accepted your team invitation. (${acceptedCount}/${team.targetSize} members ready)`,
          type: 'STATUS_CHANGE'
        });
      }

      // Invalidate any other pending invitations for this student in other teams
      await Team.updateMany(
        {
          _id: { $ne: team._id },
          status: 'FORMING',
          'members.student': student._id,
          'members.status': 'PENDING'
        },
        {
          $set: { 'members.$[elem].status': 'EXPIRED' }
        },
        {
          arrayFilters: [{ 'elem.student': student._id, 'elem.status': 'PENDING' }]
        }
      );
    } else {
      // DECLINE
      memberEntry.status = 'DECLINED';
      memberEntry.respondedAt = new Date();

      // Clear team reference from the declining student's profile
      await Student.findByIdAndUpdate(student._id, { $unset: { team: '' } });

      await team.save();

      // Notify leader of decline so they can invite another member
      try {
        await Notification.create({
          recipient: team.leader,
          recipientModel: 'Student',
          sender: student._id,
          senderModel: 'Student',
          title: 'Team Invitation Declined',
          message: `${student.name} (${student.regNo}) declined your team invitation. You can select and invite another member.`,
          type: 'STATUS_CHANGE'
        });
      } catch (notifErr) {
        console.warn('Could not dispatch decline notification:', notifErr.message);
      }

      return res.json({ success: true, data: null, message: 'Invitation declined successfully.' });
    }

    await team.save();

    const populated = await Team.findById(team._id)
      .populate('leader', 'name regNo email department')
      .populate('department', 'name code')
      .populate('members.student', 'name regNo email department');

    res.json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /api/teams/:teamId/respond error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/teams/:teamId/invite — leader invites an additional/replacement member
router.post('/:teamId/invite', extractStudent, async (req, res) => {
  try {
    const student = req.student;
    const { teamId } = req.params;
    let { studentId, targetStudentId, regNo } = req.body;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });

    if (team.leader.toString() !== student._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only the team leader can invite members.' });
    }

    if (team.status !== 'FORMING') {
      return res.status(400).json({ success: false, error: 'Cannot add members to a team that is already formed or proposed.' });
    }

    // Resolve target student
    let target = null;
    const candidateId = targetStudentId || (studentId && studentId.toString() !== student._id.toString() ? studentId : null);
    if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
      target = await Student.findById(candidateId).populate('department');
    } else if (regNo) {
      target = await Student.findOne({ regNo: regNo.trim() }).populate('department');
    }

    if (!target) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    if (target.isPassedOut || target.academicStatus === 'PASSED_OUT' || (target.yearOfStudy && target.yearOfStudy > 4)) {
      return res.status(400).json({ success: false, error: `${target.name} has graduated / passed out and cannot join a project team.` });
    }

    if (target._id.toString() === student._id.toString()) {
      return res.status(400).json({ success: false, error: 'You are already the team leader.' });
    }

    // Strict Validation: Must be same department as leader/team
    const targetDeptId = (target.department?._id || target.department)?.toString();
    const leaderDeptId = (student.department?._id || student.department)?.toString();
    if (targetDeptId && leaderDeptId && targetDeptId !== leaderDeptId) {
      return res.status(400).json({
        success: false,
        error: `Team formation is only permitted between students of the same department. ${target.name} is from a different department.`
      });
    }

    // Strict Validation: Must be same batch
    const targetBatch = (target.batch || '').trim();
    const leaderBatch = (student.batch || '').trim();
    if (targetBatch && leaderBatch && targetBatch !== leaderBatch) {
      return res.status(400).json({
        success: false,
        error: `Team formation is only permitted between students of the same batch. ${target.name} is in batch ${targetBatch}, while you are in batch ${leaderBatch}.`
      });
    }

    if (target.project) {
      return res.status(400).json({ success: false, error: `${target.name} is already assigned to a project.` });
    }

    // Check if target is already accepted in another team
    const inOtherTeam = await Team.findOne({
      status: { $in: ['FORMING', 'FORMED', 'PROPOSED'] },
      $or: [
        { leader: target._id },
        { members: { $elemMatch: { student: target._id, status: 'ACCEPTED' } } }
      ]
    });
    if (inOtherTeam) {
      return res.status(400).json({ success: false, error: `${target.name} already belongs to another team.` });
    }

    // Check active slots (accepted + pending)
    const activeMembers = team.members.filter(m => m.status === 'ACCEPTED' || m.status === 'PENDING');
    if (activeMembers.length >= team.targetSize) {
      return res.status(400).json({
        success: false,
        error: `Team capacity reached (${team.targetSize} members). Cancel a pending invite or adjust size.`
      });
    }

    // Check if target already has an entry in this team
    const existingIndex = team.members.findIndex(m => m.student.toString() === target._id.toString());
    if (existingIndex >= 0) {
      if (team.members[existingIndex].status === 'ACCEPTED') {
        return res.status(400).json({ success: false, error: `${target.name} is already an accepted member.` });
      }
      // Re-invite if previously declined/expired
      team.members[existingIndex].status = 'PENDING';
      team.members[existingIndex].invitedAt = new Date();
      team.members[existingIndex].respondedAt = undefined;
    } else {
      team.members.push({
        student: target._id,
        role: 'MEMBER',
        status: 'PENDING',
        invitedAt: new Date()
      });
    }

    await team.save();

    // Send notification to target
    await Notification.create({
      recipient: target._id,
      recipientModel: 'Student',
      sender: student._id,
      senderModel: 'Student',
      title: 'Team Invitation Received',
      message: `${student.name} (${student.regNo}) has invited you to join their team: "${team.name}".`,
      type: 'STATUS_CHANGE'
    });

    const populated = await Team.findById(team._id)
      .populate('leader', 'name regNo email department')
      .populate('department', 'name code')
      .populate('members.student', 'name regNo email department');

    res.json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /api/teams/:teamId/invite error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/teams/:teamId/cancel-invite — leader revokes a pending invitation
router.post('/:teamId/cancel-invite', extractStudent, async (req, res) => {
  try {
    const student = req.student;
    const { teamId } = req.params;
    const { studentId } = req.body;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });

    if (team.leader.toString() !== student._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only the team leader can cancel invites.' });
    }

    team.members = team.members.filter(
      m => !(m.student.toString() === studentId.toString() && m.status === 'PENDING')
    );

    await team.save();

    const populated = await Team.findById(team._id)
      .populate('leader', 'name regNo email department')
      .populate('department', 'name code')
      .populate('members.student', 'name regNo email department');

    res.json({ success: true, data: populated });
  } catch (err) {
    console.error('POST /api/teams/:teamId/cancel-invite error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/teams/:teamId — leader disbands team (only before proposal, password verified)
router.delete('/:teamId', extractStudent, async (req, res) => {
  try {
    const student = req.student;
    const { teamId } = req.params;
    const password = req.body?.password || req.query?.password;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });

    if (team.leader.toString() !== student._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only the team leader has permission to disband the team.' });
    }

    // Require leader account password for irreversible disband action
    if (!password || !password.trim()) {
      return res.status(400).json({ success: false, error: 'Leader account password is required to disband the team.' });
    }

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password.trim(), student.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Incorrect account password. Team disbanding cancelled.' });
    }

    if (team.project) {
      const Project = require('../models/Project');
      const Milestone = require('../models/Milestone');
      const Task = require('../models/Task');
      const projDoc = await Project.findById(team.project);
      if (projDoc && (projDoc.status === 'APPROVED' || projDoc.status === 'IN_PROGRESS' || projDoc.status === 'COMPLETED')) {
        return res.status(400).json({ success: false, error: 'Cannot disband team after project proposal has been officially approved by faculty.' });
      }
      if (projDoc) {
        await Milestone.deleteMany({ project: projDoc._id });
        await Task.deleteMany({ project: projDoc._id });
        await Project.findByIdAndDelete(projDoc._id);
      }
    }

    team.status = 'DISBANDED';
    await team.save();

    // Clear team & project reference from all members
    const memberIds = team.members.map(m => m.student);
    if (team.leader && !memberIds.some(id => id.toString() === team.leader.toString())) {
      memberIds.push(team.leader);
    }
    await Student.updateMany(
      { _id: { $in: memberIds } },
      { $unset: { team: '', project: '' } }
    );

    // Notify other members
    for (const memId of memberIds) {
      if (memId.toString() !== student._id.toString()) {
        try {
          await Notification.create({
            recipient: memId,
            recipientModel: 'Student',
            title: 'Project Team Disbanded',
            message: `Team leader ${student.name} has disbanded the team "${team.name}". You are now free to configure or join another team.`,
            type: 'STATUS_CHANGE'
          });
        } catch (e) {}
      }
    }

    res.json({ success: true, message: 'Team disbanded successfully.' });
  } catch (err) {
    console.error('DELETE /api/teams/:teamId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/teams/:teamId/leave — leaving disabled; only team lead disbanding is allowed
router.post('/:teamId/leave', extractStudent, async (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'Individual members cannot leave a team. The only way to dissolve the team is by the team leader disbanding it.'
  });
});

module.exports = router;
