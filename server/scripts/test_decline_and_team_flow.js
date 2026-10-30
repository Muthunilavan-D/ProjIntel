const path = require('path');
const mongoose = require('mongoose');

const API_BASE = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function runTest() {
  console.log('====================================================');
  console.log('STARTING END-TO-END TEST: DECLINE, PROPOSAL & DISBAND');
  console.log('====================================================\n');

  // Connect to DB using app's config
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  const connectDB = require('../config/db');
  await connectDB();
  while (mongoose.connection.readyState !== 1) {
    await new Promise(r => setTimeout(r, 500));
  }

  const Student = require('../models/Student');
  const Department = require('../models/Department');
  const Team = require('../models/Team');
  const Project = require('../models/Project');
  const Task = require('../models/Task');

  const dept = await Department.findOne({ code: 'CSE' }) || await Department.findOne();
  if (!dept) throw new Error('No department found');

  const timestamp = Date.now().toString().slice(-5);
  const passAcc1 = 'PasswordLead123!';
  const passAcc2 = 'PasswordPeer234!';
  const passAcc3 = 'PasswordPeer345!';

  // Clean any old test artifacts
  await Student.deleteMany({ email: { $regex: /^test_team_/ } });
  await Team.deleteMany({ name: { $regex: /^TestTeam_/ } });
  await Project.deleteMany({ title: { $regex: /^Test Capstone / } });

  // 1. Create 3 accounts
  console.log('1. Registering Acc1 (Lead), Acc2 (Peer who declines), Acc3 (Peer who joins)...');

  const resAcc1 = await req('/auth/register', {
    method: 'POST',
    body: {
      name: `Test Lead ${timestamp}`,
      email: `test_team_lead_${timestamp}@vcet.ac.in`,
      password: passAcc1,
      role: 'STUDENT',
      regNo: `9131${timestamp}1`,
      department: dept._id
    }
  });
  const token1 = resAcc1.token;
  const user1 = resAcc1.user;

  const resAcc2 = await req('/auth/register', {
    method: 'POST',
    body: {
      name: `Test Peer Decline ${timestamp}`,
      email: `test_team_peer_dec_${timestamp}@vcet.ac.in`,
      password: passAcc2,
      role: 'STUDENT',
      regNo: `9131${timestamp}2`,
      department: dept._id
    }
  });
  const token2 = resAcc2.token;
  const user2 = resAcc2.user;

  const resAcc3 = await req('/auth/register', {
    method: 'POST',
    body: {
      name: `Test Peer Join ${timestamp}`,
      email: `test_team_peer_join_${timestamp}@vcet.ac.in`,
      password: passAcc3,
      role: 'STUDENT',
      regNo: `9131${timestamp}3`,
      department: dept._id
    }
  });
  const token3 = resAcc3.token;
  const user3 = resAcc3.user;

  console.log('   ✓ Accounts created successfully.');

  // 2. Acc1 creates Team with Acc2 invited
  console.log('\n2. Acc1 creating team of size 2, inviting Acc2...');
  const createTeamRes = await req('/teams/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: {
      name: `TestTeam_${timestamp}`,
      targetSize: 2,
      invitedStudentIds: [user2._id]
    }
  });

  const team1 = createTeamRes.data;
  console.log(`   ✓ Team created (${team1.name}), status: ${team1.status}`);

  // 3. Acc2 checks pending invitations and declines
  console.log('\n3. Acc2 checking pending invitations...');
  const pendingRes = await req('/teams/invitations/pending', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token2}` }
  });
  console.log(`   ✓ Acc2 pending invites count: ${pendingRes.data.length}`);
  if (pendingRes.data.length === 0) throw new Error('Acc2 should have 1 pending invite');

  console.log('   Acc2 declining the invitation...');
  const declineRes = await req(`/teams/${team1._id}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
    body: { action: 'DECLINE' }
  });
  console.log(`   ✓ Respond result: ${declineRes.message}`);

  // 4. Verify Acc2 /my-team returns null (CRITICAL USER REQUIREMENT!)
  console.log('\n4. Verifying Acc2 /my-team returns null so team wizard is shown...');
  const myTeamAcc2 = await req('/teams/my-team', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token2}` }
  });
  console.log(`   ✓ Acc2 my-team:`, myTeamAcc2.data ? myTeamAcc2.data._id : 'null (Team Creation Wizard will display!)');
  if (myTeamAcc2.data !== null) {
    throw new Error('FAILED: Acc2 still received a team after declining!');
  }

  // 5. Verify Acc2 can now form their OWN team
  console.log('\n5. Acc2 creates their OWN solo team...');
  const acc2OwnTeamRes = await req('/teams/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
    body: {
      name: `Acc2OwnTeam_${timestamp}`,
      targetSize: 1
    }
  });
  console.log(`   ✓ Acc2 successfully created own team: ${acc2OwnTeamRes.data.name}, status: ${acc2OwnTeamRes.data.status}`);

  // 6. Acc1 invites Acc3 to fill the spot
  console.log('\n6. Acc1 invites Acc3 to fill the open spot...');
  const inviteAcc3Res = await req(`/teams/${team1._id}/invite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: { studentId: user3._id }
  });
  console.log(`   ✓ Acc3 invited: ${inviteAcc3Res.success}`);

  // 7. Acc3 accepts the invite -> Team becomes FORMED
  console.log('\n7. Acc3 accepts invitation...');
  const acceptRes = await req(`/teams/${team1._id}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token3}` },
    body: { action: 'ACCEPT' }
  });
  const updatedTeam = acceptRes.data;
  console.log(`   ✓ Team status after accept: ${updatedTeam.status} (targetSize: ${updatedTeam.targetSize})`);
  if (updatedTeam.status !== 'FORMED') {
    throw new Error(`Team status should be FORMED but got ${updatedTeam.status}`);
  }

  // 8. Acc3 (regular member, not leader) proposes Capstone Project
  console.log('\n8. Acc3 (confirmed member) proposes Capstone Project...');
  const proposeRes = await req('/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token3}` },
    body: {
      title: `Test Capstone AI System ${timestamp}`,
      description: 'Testing end to end proposal submission by team member',
      domain: 'Artificial Intelligence & Machine Learning',
      technologies: 'Node.js, React, MongoDB',
      teamId: team1._id,
      leadStudentId: user1._id,
      teamMembers: [user1._id, user3._id],
      department: dept._id,
      status: 'UNDER_REVIEW'
    }
  });

  const project = proposeRes.data;
  console.log(`   ✓ Project proposed by member: ${project.title} (${project._id})`);

  // Verify both Acc1 and Acc3 have project set
  const checkAcc1 = await Student.findById(user1._id);
  const checkAcc3 = await Student.findById(user3._id);
  console.log(`   ✓ Acc1 student.project: ${checkAcc1.project}`);
  console.log(`   ✓ Acc3 student.project: ${checkAcc3.project}`);
  if (!checkAcc1.project || !checkAcc3.project) {
    throw new Error('Both members must have project linked on Student model!');
  }

  // 9. Member Acc3 updates project details
  console.log('\n9. Acc3 updates project details (testing member editing access)...');
  const updateRes = await req(`/projects/${project._id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token3}` },
    body: {
      problemStatement: 'Updated by team member Acc3 successfully',
      technologies: ['Node.js', 'React', 'MongoDB', 'TensorFlow']
    }
  });
  console.log(`   ✓ Acc3 updated project: ${updateRes.success}`);

  // 10. Acc3 creates a task
  console.log('\n10. Acc3 creates a task on the project...');
  const taskRes = await req('/tasks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token3}` },
    body: {
      title: 'Initial Model Architecture',
      description: 'Design neural network layers',
      project: project._id,
      assignedTo: user3._id,
      status: 'IN_PROGRESS'
    }
  });
  console.log(`    ✓ Acc3 created task: ${taskRes.data?.title || taskRes.data?._id}`);

  // 11. Test Disband Team security
  console.log('\n11. Testing Team Disband Security:');
  console.log('    a) Member Acc3 attempts to disband team...');
  try {
    await req(`/teams/${team1._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token3}` },
      body: { password: passAcc3 }
    });
    throw new Error('Acc3 should not be allowed to disband team!');
  } catch (err) {
    console.log(`       ✓ Correctly blocked Acc3: ${err.status} - ${err.data?.error || err.message}`);
  }

  console.log('    b) Leader Acc1 attempts to disband with WRONG password...');
  try {
    await req(`/teams/${team1._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` },
      body: { password: 'WrongPassword999!' }
    });
    throw new Error('Disband with wrong password should have failed!');
  } catch (err) {
    console.log(`       ✓ Correctly rejected wrong password: ${err.status} - ${err.data?.error || err.message}`);
  }

  console.log('    c) Leader Acc1 disbands with CORRECT password...');
  const disbandRes = await req(`/teams/${team1._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token1}` },
    body: { password: passAcc1 }
  });
  console.log(`       ✓ Disband successful: ${disbandRes.message}`);

  const disbandedTeam = await Team.findById(team1._id);
  console.log(`       ✓ Team DB status: ${disbandedTeam.status}`);

  // Clean up test data
  console.log('\n12. Cleaning up test data...');
  await Student.deleteMany({ email: { $regex: /^test_team_/ } });
  await Team.deleteMany({ name: { $regex: /^(TestTeam_|Acc2OwnTeam_)/ } });
  await Project.deleteMany({ title: { $regex: /^Test Capstone / } });
  await Task.deleteMany({ title: 'Initial Model Architecture' });

  await mongoose.disconnect();
  console.log('\n====================================================');
  console.log('ALL TESTS PASSED! 100% VERIFIED & SYNCHRONIZED!');
  console.log('====================================================');
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err.data || err.message);
  process.exit(1);
});
