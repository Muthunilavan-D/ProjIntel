const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api';

async function api(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`);
    err.response = { status: res.status, data };
    throw err;
  }
  return data;
}

async function runTest() {
  console.log('--- STARTING END-TO-END TEAM FORMATION WORKFLOW TEST ---');
  
  const timestamp = Date.now();
  const s1Data = {
    name: `Test Leader ${timestamp}`,
    email: `leader_${timestamp}@vcet.edu.in`,
    password: 'Password@123',
    role: 'STUDENT',
    regNo: `REG-LEAD-${timestamp.toString().slice(-4)}`,
    department: 'Computer Science and Engineering',
    year: 4,
    section: 'A'
  };

  const s2Data = {
    name: `Test Member A ${timestamp}`,
    email: `memberA_${timestamp}@vcet.edu.in`,
    password: 'Password@123',
    role: 'STUDENT',
    regNo: `REG-MEM-A-${timestamp.toString().slice(-4)}`,
    department: 'Computer Science and Engineering',
    year: 4,
    section: 'A'
  };

  const s3Data = {
    name: `Test Member B ${timestamp}`,
    email: `memberB_${timestamp}@vcet.edu.in`,
    password: 'Password@123',
    role: 'STUDENT',
    regNo: `REG-MEM-B-${timestamp.toString().slice(-4)}`,
    department: 'Computer Science and Engineering',
    year: 4,
    section: 'A'
  };

  let token1, token2, token3;
  let user1, user2, user3;
  let createdTeamId = null;
  let createdProjectId = null;

  try {
    // 1. Register 3 fresh students
    console.log('1. Registering 3 fresh student accounts...');
    const r1 = await api('/auth/register', 'POST', s1Data);
    token1 = r1.token || r1.data?.token;
    user1 = r1.user || r1.data?.user;

    const r2 = await api('/auth/register', 'POST', s2Data);
    token2 = r2.token || r2.data?.token;
    user2 = r2.user || r2.data?.user;

    const r3 = await api('/auth/register', 'POST', s3Data);
    token3 = r3.token || r3.data?.token;
    user3 = r3.user || r3.data?.user;

    console.log(`   Registered: Lead (${user1.name}), Member A (${user2.name}), Member B (${user3.name})`);

    // 2. Student 1 queries available students
    console.log('2. Student 1 queries available students...');
    const availRes1 = await api(`/teams/available-students?studentId=${user1._id}`, 'GET', null, token1);
    const availList1 = availRes1.data || [];
    const hasS2 = availList1.some(s => s._id === user2._id || s.regNo === s2Data.regNo);
    const hasS3 = availList1.some(s => s._id === user3._id || s.regNo === s3Data.regNo);
    console.log(`   Found ${availList1.length} available students. Member A present: ${hasS2}, Member B present: ${hasS3}`);
    if (!hasS2 || !hasS3) {
      throw new Error('Freshly registered students not found in available students list!');
    }

    // 3. Student 1 creates Team of size 3 and invites Member A & Member B
    console.log('3. Student 1 creates Team of size 3 and invites Member A & B...');
    const createTeamRes = await api('/teams/create', 'POST', {
      leaderId: user1._id,
      name: `Capstone Team Alpha ${timestamp}`,
      targetSize: 3,
      department: user1.department,
      invitedStudentIds: [user2._id, user3._id]
    }, token1);

    const team = createTeamRes.data;
    createdTeamId = team._id;
    console.log(`   Team created! ID: ${team._id}, Status: ${team.status}, TargetSize: ${team.targetSize}`);
    if (team.status !== 'FORMING') {
      throw new Error(`Expected team status to be FORMING, got: ${team.status}`);
    }

    // 4. Student 2 checks pending invitations
    console.log('4. Student 2 checks pending invitations...');
    const invRes2 = await api(`/teams/invitations/pending?studentId=${user2._id}`, 'GET', null, token2);
    const invites2 = invRes2.data || [];
    const teamInvite2 = invites2.find(inv => inv._id === createdTeamId);
    console.log(`   Student 2 has ${invites2.length} pending invites. Team Alpha invite found: ${!!teamInvite2}`);
    if (!teamInvite2) {
      throw new Error('Student 2 did not receive the team invitation!');
    }

    // 5. Student 2 accepts the invitation
    console.log('5. Student 2 accepts invitation...');
    const acceptRes2 = await api(`/teams/${createdTeamId}/respond`, 'POST', {
      studentId: user2._id,
      action: 'ACCEPT'
    }, token2);
    console.log(`   Student 2 accept response: ${acceptRes2.message}. Team status: ${acceptRes2.data?.status}`);

    // 6. Loophole Check: Check available students list again
    console.log('6. Checking available students list after Student 2 accepts...');
    const availRes2 = await api(`/teams/available-students?studentId=${user3._id}`, 'GET', null, token3);
    const availList2 = availRes2.data || [];
    const hasS1After = availList2.some(s => s._id === user1._id);
    const hasS2After = availList2.some(s => s._id === user2._id);
    console.log(`   Member A (accepted) present in available list: ${hasS2After} (Should be FALSE)`);
    console.log(`   Leader (accepted) present in available list: ${hasS1After} (Should be FALSE)`);
    if (hasS1After || hasS2After) {
      throw new Error('Accepted team member or leader is still showing up in available students list!');
    }

    // 7. Student 3 checks invitations and accepts -> Team should become FORMED
    console.log('7. Student 3 accepts invitation...');
    const acceptRes3 = await api(`/teams/${createdTeamId}/respond`, 'POST', {
      studentId: user3._id,
      action: 'ACCEPT'
    }, token3);
    const updatedTeam = acceptRes3.data;
    console.log(`   Team status after all members accept: ${updatedTeam.status} (Should be FORMED)`);
    if (updatedTeam.status !== 'FORMED') {
      throw new Error(`Expected team status to be FORMED, got: ${updatedTeam.status}`);
    }

    // 8. Student 1 proposes Capstone Project linked to the team
    console.log('8. Student 1 proposes Capstone Project linked to the team...');
    const projPayload = {
      title: `AI Capstone Autonomous Drone System ${timestamp}`,
      description: 'End-to-end drone fleet coordination with reinforcement learning.',
      problemStatement: 'Inefficient manual inspection in harsh terrains.',
      objectives: '1. Build swarm simulator, 2. Deploy edge AI inference',
      domain: 'Artificial Intelligence & Machine Learning',
      technologies: 'Python, PyTorch, ROS2, Node.js',
      teamId: createdTeamId,
      leadStudentId: user1._id,
      leadName: user1.name,
      regNo: user1.regNo,
      department: user1.department,
      status: 'UNDER_REVIEW'
    };

    const projRes = await api('/projects', 'POST', projPayload, token1);

    const project = projRes.data;
    createdProjectId = project._id;
    console.log(`   Project proposed successfully! ID: ${project._id}, Title: "${project.title}"`);
    console.log(`   Team members resolved in project: ${project.teamMembers.length}`);

    // 9. Verify database state for all 3 students
    console.log('9. Verifying database state for synchronization...');
    const connectDB = require('../config/db');
    await connectDB();
    const Student = require('../models/Student');
    const Team = require('../models/Team');
    const Project = require('../models/Project');

    const dbTeam = await Team.findById(createdTeamId);
    console.log(`   DB Team status: ${dbTeam.status} (Should be PROPOSED), Linked project: ${dbTeam.project}`);
    if (dbTeam.status !== 'PROPOSED' || !dbTeam.project) {
      throw new Error('Team was not marked as PROPOSED or linked to project in DB!');
    }

    const [dbS1, dbS2, dbS3] = await Promise.all([
      Student.findById(user1._id),
      Student.findById(user2._id),
      Student.findById(user3._id)
    ]);

    console.log(`   Student 1 project: ${dbS1.project}, team: ${dbS1.team}`);
    console.log(`   Student 2 project: ${dbS2.project}, team: ${dbS2.team}`);
    console.log(`   Student 3 project: ${dbS3.project}, team: ${dbS3.team}`);

    if (
      String(dbS1.project) !== String(createdProjectId) ||
      String(dbS2.project) !== String(createdProjectId) ||
      String(dbS3.project) !== String(createdProjectId)
    ) {
      throw new Error('Project was not synchronized to all team members in DB!');
    }

    console.log('\n✅ SUCCESS! Full end-to-end team formation & project synchronization verified perfectly!');

  } catch (err) {
    console.error('❌ Test failed with error:', err.response?.data || err.message);
    throw err;
  } finally {
    // 10. Clean up test records
    console.log('\n10. Cleaning up test records from database...');
    try {
      const connectDB = require('../config/db');
      await connectDB();
      const Student = require('../models/Student');
      const Team = require('../models/Team');
      const Project = require('../models/Project');
      const Milestone = require('../models/Milestone');
      const Notification = require('../models/Notification');

      if (createdProjectId) {
        await Project.findByIdAndDelete(createdProjectId);
        await Milestone.deleteMany({ project: createdProjectId });
      }
      if (createdTeamId) {
        await Team.findByIdAndDelete(createdTeamId);
      }
      if (user1) await Student.findByIdAndDelete(user1._id);
      if (user2) await Student.findByIdAndDelete(user2._id);
      if (user3) await Student.findByIdAndDelete(user3._id);
      if (user1 || user2 || user3) {
        await Notification.deleteMany({
          recipient: { $in: [user1?._id, user2?._id, user3?._id].filter(Boolean) }
        });
      }
      console.log('   Cleaned up test data cleanly.');
      await mongoose.disconnect();
    } catch (cleanErr) {
      console.warn('   Cleanup warning:', cleanErr.message);
    }
  }
}

runTest().then(() => {
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
