/**
 * Master Database Seeder for PROJINTEL
 * Seeds Academic Departments, Users (Admin, Faculty, Students),
 * Projects, Milestones, Tasks, Weekly Progress Reports, and Reviews.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const Department = require('../models/Department');
const Admin = require('../models/Admin');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const Task = require('../models/Task');
const WeeklyProgress = require('../models/WeeklyProgress');
const Review = require('../models/Review');
const ReviewSubmission = require('../models/ReviewSubmission');
const ReviewEvaluation = require('../models/ReviewEvaluation');
const Notification = require('../models/Notification');

async function seedDatabase() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected to MongoDB Atlas successfully.');

  console.log('Clearing existing documents...');
  await Promise.all([
    Department.deleteMany({}),
    Admin.deleteMany({}),
    Faculty.deleteMany({}),
    Student.deleteMany({}),
    Project.deleteMany({}),
    Milestone.deleteMany({}),
    Task.deleteMany({}),
    WeeklyProgress.deleteMany({}),
    Review.deleteMany({}),
    ReviewSubmission.deleteMany({}),
    ReviewEvaluation.deleteMany({}),
    Notification.deleteMany({})
  ]);
  console.log('Cleaned database.');

  // 1. Seed Departments
  console.log('Seeding academic departments...');
  const deptCSE = await Department.create({ name: 'Computer Science & Engineering', code: 'CSE' });
  const deptIT = await Department.create({ name: 'Information Technology', code: 'IT' });
  const deptECE = await Department.create({ name: 'Electronics & Communication Engineering', code: 'ECE' });
  const deptEEE = await Department.create({ name: 'Electrical & Electronics Engineering', code: 'EEE' });
  const deptMECH = await Department.create({ name: 'Mechanical Engineering', code: 'MECH' });

  // 2. Hash Common Password
  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // 3. Seed Admin
  console.log('Seeding institutional admin...');
  const admin = await Admin.create({
    name: 'Dr. K. Arulmozhi',
    email: 'admin@vcet.edu.in',
    password: hashedPassword,
    role: 'ADMIN',
    department: deptCSE._id
  });

  // 4. Seed Faculty Guides
  console.log('Seeding faculty guides...');
  const guide1 = await Faculty.create({
    name: 'Dr. M. Sundararajan',
    email: 'guide@vcet.edu.in',
    password: hashedPassword,
    facultyId: 'FAC-CSE-012',
    role: 'FACULTY',
    department: deptCSE._id,
    designation: 'Associate Professor / Project Guide',
    maxProjects: 6
  });

  const guide2 = await Faculty.create({
    name: 'Dr. S. Kavitha',
    email: 'faculty2@vcet.edu.in',
    password: hashedPassword,
    facultyId: 'FAC-CSE-005',
    role: 'FACULTY',
    department: deptCSE._id,
    designation: 'Professor / Senior Guide',
    maxProjects: 6
  });

  // 5. Seed Students
  console.log('Seeding students...');
  const student1 = await Student.create({
    name: 'Kishore T S',
    email: 'student@vcet.edu.in',
    password: hashedPassword,
    regNo: '913121104001',
    role: 'STUDENT',
    department: deptCSE._id,
    year: 4
  });

  const student2 = await Student.create({
    name: 'Praveen S',
    email: 'praveen@vcet.edu.in',
    password: hashedPassword,
    regNo: '913121104002',
    role: 'STUDENT',
    department: deptCSE._id,
    year: 4
  });

  const student3 = await Student.create({
    name: 'Sanjay V',
    email: 'sanjay@vcet.edu.in',
    password: hashedPassword,
    regNo: '913121104003',
    role: 'STUDENT',
    department: deptCSE._id,
    year: 4
  });

  const student4 = await Student.create({
    name: 'Ananya R',
    email: 'ananya@vcet.edu.in',
    password: hashedPassword,
    regNo: '913121104015',
    role: 'STUDENT',
    department: deptCSE._id,
    year: 4
  });

  const student5 = await Student.create({
    name: 'Dinesh Kumar M',
    email: 'dinesh@vcet.edu.in',
    password: hashedPassword,
    regNo: '913121104022',
    role: 'STUDENT',
    department: deptCSE._id,
    year: 4
  });

  // 6. Seed Projects
  console.log('Seeding projects...');
  // Project 1: Approved & In Progress (Assigned to Kishore T S, Praveen S, Sanjay V)
  const proj1 = await Project.create({
    title: 'AI-Driven Academic Project Intelligence Platform (ProjIntel)',
    description: 'An AI-assisted full-lifecycle academic project intelligence platform featuring automated milestone tracking, weekly progress reviews, and rubric-driven evaluations.',
    abstract: 'This platform addresses delays, fragmentation, and subjectivity in university academic project oversight through a centralized workflow engine, automated progress verification, and objective rubric analytics.',
    problemStatement: 'Institutions lack structured, transparent mechanisms to track student academic projects throughout the semester, causing last-minute rushes and uneven evaluations.',
    objectives: [
      'Implement real-time milestone management and Kanban task board',
      'Provide structured weekly progress logging and faculty scoring',
      'Deliver automated rubric-based review scoring and evaluation reports',
      'Facilitate student-guide advisory feedback loops'
    ],
    domain: 'Artificial Intelligence & Machine Learning',
    technologies: ['React', 'Node.js', 'Express', 'MongoDB Atlas', 'JWT', 'Lucide Icons', 'Vite'],
    teamMembers: [student1._id, student2._id, student3._id],
    department: deptCSE._id,
    status: 'APPROVED',
    guide: guide1._id,
    submittedDate: new Date('2026-08-15'),
    approvedDate: new Date('2026-08-20'),
    comments: [
      {
        author: guide1.name,
        text: 'The problem statement is well-formulated. Proposal approved. Proceed with Milestone 1 and 2.',
        isGuide: true,
        time: new Date('2026-08-20T10:30:00Z')
      },
      {
        author: student1.name,
        text: 'Thank you Dr. Sundararajan! We will complete the architecture and schema design this week.',
        isGuide: false,
        time: new Date('2026-08-21T09:15:00Z')
      }
    ]
  });

  // Link student1 to project 1
  student1.project = proj1._id;
  await student1.save();
  student2.project = proj1._id;
  await student2.save();
  student3.project = proj1._id;
  await student3.save();

  // Project 2: Submitted (Awaiting Guide Assignment / Review)
  const proj2 = await Project.create({
    title: 'Autonomous Agricultural Drone Navigation System',
    description: 'Vision-based orchard drone navigation using YOLOv8 edge inference and LiDAR SLAM for real-time orchard mapping and pest infestation localization without GPS dependencies.',
    abstract: 'Autonomous UAV system using stereoscopic cameras and neural inference to inspect crop canopy and detect early fungal blight with sub-meter spatial accuracy.',
    problemStatement: 'GPS occlusion under dense foliage hampers conventional agricultural drones from flying autonomous low-altitude canopy inspection paths.',
    objectives: [
      'Train lightweight edge YOLOv8 model for real-time blight detection',
      'Implement visual-inertial odometry for GPS-denied localization',
      'Build telemetric mission control dashboard'
    ],
    domain: 'Robotics & Computer Vision',
    technologies: ['Python', 'YOLOv8', 'ROS2', 'OpenCV', 'PyTorch', 'Gazebo'],
    teamMembers: [student4._id],
    department: deptCSE._id,
    status: 'SUBMITTED',
    guide: guide2._id,
    submittedDate: new Date('2026-09-02'),
    comments: []
  });
  student4.project = proj2._id;
  await student4.save();

  // Project 3: Revision Required
  const proj3 = await Project.create({
    title: 'Blockchain Credential Verification Network',
    description: 'Decentralized institutional diploma and transcript verification protocol built on Ethereum smart contracts with IPFS metadata storage.',
    abstract: 'A privacy-preserving smart contract system allowing employers and academic bodies to verify graduate degrees cryptographically without third-party brokers.',
    problemStatement: 'Fraudulent paper credentials continue to compromise university reputations, while centralized verification databases are prone to single points of failure.',
    objectives: [
      'Design ERC-721 soulbound diploma smart contracts',
      'Integrate IPFS pinning for immutable transcript metadata',
      'Develop instant QR-code verification portal'
    ],
    domain: 'Blockchain & Cybersecurity',
    technologies: ['Solidity', 'Ethereum', 'Web3.js', 'IPFS', 'Next.js'],
    teamMembers: [student5._id],
    department: deptCSE._id,
    status: 'REVISION_REQUIRED',
    guide: guide1._id,
    submittedDate: new Date('2026-09-10'),
    revisionNotes: 'Please provide mathematical benchmark on gas fee overhead for batch certificate minting and clarify key management for institutional issuers.',
    comments: [
      {
        author: guide1.name,
        text: 'Concept has merit, but the gas consumption analysis is missing. Please revise and resubmit by next Friday.',
        isGuide: true,
        time: new Date('2026-09-12T14:00:00Z')
      }
    ]
  });
  student5.project = proj3._id;
  await student5.save();

  // 7. Seed Milestones for Project 1
  console.log('Seeding milestones for Project 1...');
  const m1 = await Milestone.create({
    project: proj1._id,
    number: 1,
    title: 'Project Proposal & Literature Survey',
    description: 'IEEE style project synopsis, comprehensive literature review of 15+ benchmark papers, and finalized problem scope.',
    startDate: new Date('2026-08-20'),
    dueDate: new Date('2026-09-05'),
    status: 'COMPLETED',
    completionPercentage: 100
  });

  const m2 = await Milestone.create({
    project: proj1._id,
    number: 2,
    title: 'System Architecture & UI Design',
    description: 'High-level architectural blueprint, database relational schema, and Figma high-fidelity interface prototype.',
    startDate: new Date('2026-09-06'),
    dueDate: new Date('2026-09-25'),
    status: 'COMPLETED',
    completionPercentage: 100
  });

  const m3 = await Milestone.create({
    project: proj1._id,
    number: 3,
    title: 'Core Backend API & Intelligence Engine',
    description: 'Express REST microservices, MongoDB Atlas integration, JWT auth guard, and AI evaluation engine.',
    startDate: new Date('2026-09-26'),
    dueDate: new Date('2026-10-30'),
    status: 'IN_PROGRESS',
    completionPercentage: 75
  });

  const m4 = await Milestone.create({
    project: proj1._id,
    number: 4,
    title: 'Integration, Final Viva & Institutional Demo',
    description: 'Full stack integration, cross-device testing, documentation report compilation, and final project review demonstration.',
    startDate: new Date('2026-11-01'),
    dueDate: new Date('2026-11-20'),
    status: 'PENDING',
    completionPercentage: 0
  });

  // 8. Seed Tasks for Project 1
  console.log('Seeding Kanban tasks...');
  await Task.create([
    {
      project: proj1._id,
      milestone: m1._id,
      title: 'Draft IEEE Format Project Proposal',
      description: 'Formalize problem statement, scope boundaries, and review literature.',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueDate: new Date('2026-09-02')
    },
    {
      project: proj1._id,
      milestone: m2._id,
      title: 'Design MongoDB Schemas & Relations',
      description: 'Construct normalized collections for Students, Faculty, Projects, Milestones, and Reviews.',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueDate: new Date('2026-09-18')
    },
    {
      project: proj1._id,
      milestone: m3._id,
      title: 'Implement JWT Authentication & Role Guards',
      description: 'Build secure token signing and verification with student, faculty, and admin role middlewares.',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueDate: new Date('2026-10-10')
    },
    {
      project: proj1._id,
      milestone: m3._id,
      title: 'Develop Student & Guide Interactive Dashboards',
      description: 'Deliver rich, real-time responsive analytics, milestones tracking, and weekly progress charts.',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      dueDate: new Date('2026-10-28')
    },
    {
      project: proj1._id,
      milestone: m4._id,
      title: 'End-to-End System Testing & Deliverable Packaging',
      description: 'Perform unit, integration, and security checks before final viva submission.',
      priority: 'MEDIUM',
      status: 'TODO',
      dueDate: new Date('2026-11-15')
    }
  ]);

  // 9. Seed Weekly Progress Reports for Project 1
  console.log('Seeding weekly progress reports...');
  await WeeklyProgress.create([
    {
      project: proj1._id,
      weekNumber: 1,
      workCompleted: 'Completed literature survey of 15 papers on LMS and academic project tracking systems. Formulated project synopsis.',
      problemsFaced: 'Selecting appropriate database model for heterogeneous user hierarchies.',
      nextWeekPlan: 'Draft entity-relationship diagrams and begin UI wireframes.',
      progressPercentage: 100,
      submittedBy: student1._id,
      submissionDate: new Date('2026-09-01'),
      facultyScore: 95,
      facultyFeedback: 'Excellent research depth and clear problem scope. Approved.',
      status: 'GRADED'
    },
    {
      project: proj1._id,
      weekNumber: 2,
      workCompleted: 'Designed system architecture, modular components in React, and database schemas with Mongoose.',
      problemsFaced: 'Balancing schema flexibility with strict academic rubric validation requirements.',
      nextWeekPlan: 'Connect frontend dashboard components to Express server endpoints.',
      progressPercentage: 90,
      submittedBy: student1._id,
      submissionDate: new Date('2026-09-15'),
      facultyScore: 92,
      facultyFeedback: 'Good architectural modularity. Ensure JWT tokens carry appropriate role payload.',
      status: 'GRADED'
    },
    {
      project: proj1._id,
      weekNumber: 3,
      workCompleted: 'Implemented JWT auth routes, project milestone services, and connected live MongoDB Atlas collections.',
      problemsFaced: 'DNS resolution timeouts on Windows dev environment resolved via fallback nameservers.',
      nextWeekPlan: 'Conduct end-to-end user testing for Review 1 presentation.',
      progressPercentage: 85,
      submittedBy: student1._id,
      submissionDate: new Date('2026-10-18'),
      facultyScore: 90,
      facultyFeedback: 'Solid progress on the backend services. Well done overcoming the DNS configuration challenge.',
      status: 'GRADED'
    }
  ]);

  // 10. Seed Reviews for Project 1
  console.log('Seeding reviews and evaluations...');
  // Review 0: Completed & Evaluated
  const review0 = await Review.create({
    project: proj1._id,
    guide: guide1._id,
    title: 'Review 0: Synopsis & Scope Approval',
    reviewType: 'REVIEW_0',
    scheduledDate: new Date('2026-09-08T10:00:00Z'),
    deadline: new Date('2026-09-07T23:59:00Z'),
    instructions: 'Upload presentation slides (PPTX) and technical proposal document (PDF).',
    requiredDocType: 'ALL',
    maxMarks: 50,
    rubricCriteria: [
      { name: 'Problem Identification & Domain Relevance', maxScore: 15, description: 'Clarity of real-world problem statement' },
      { name: 'Literature Survey & Comparative Study', maxScore: 15, description: 'Coverage of recent benchmark publications' },
      { name: 'Feasibility & Methodology Proposed', maxScore: 10, description: 'Technical viability and planned tech stack' },
      { name: 'Oral Presentation & Q&A Discussion', maxScore: 10, description: 'Ability to answer panel queries convincingly' }
    ],
    status: 'COMPLETED'
  });

  const sub0 = await ReviewSubmission.create({
    review: review0._id,
    project: proj1._id,
    submittedBy: student1._id,
    fileName: 'ProjIntel_Synopsis_Review_Slides.pptx',
    filePath: '/uploads/reviews/ProjIntel_Synopsis_Review_Slides.pptx',
    documentType: 'PPTX',
    fileSize: '4.2 MB',
    notes: 'Includes problem statement, literature survey matrix, and proposed architecture.',
    submissionTime: new Date('2026-09-06T18:30:00Z'),
    status: 'REVIEWED'
  });

  await ReviewEvaluation.create({
    review: review0._id,
    submission: sub0._id,
    evaluator: guide1._id,
    evaluationType: 'FACULTY',
    marks: 47,
    maxMarks: 50,
    grade: 'A+',
    rubricBreakdown: [
      { criterion: 'Problem Identification & Domain Relevance', score: 15, maxScore: 15, remarks: 'Outstanding rationale' },
      { criterion: 'Literature Survey & Comparative Study', score: 14, maxScore: 15, remarks: 'Thorough coverage' },
      { criterion: 'Feasibility & Methodology Proposed', score: 9, maxScore: 10, remarks: 'Solid stack choice' },
      { criterion: 'Oral Presentation & Q&A Discussion', score: 9, maxScore: 10, remarks: 'Confident presentation and clear discussion' }
    ],
    strengths: ['Highly relevant academic utility', 'Clear full-stack architectural roadmap'],
    weaknesses: ['Ensure edge cases in role transitions are handled cleanly'],
    comments: 'Commendable presentation. Proposal is officially cleared for full implementation.',
    feedback: 'Keep up the momentum into the mid-term review.',
    evaluatedTime: new Date('2026-09-08T12:00:00Z')
  });

  // Review 1: Scheduled (Upcoming)
  const review1 = await Review.create({
    project: proj1._id,
    guide: guide1._id,
    title: 'Review 1: System Architecture & Mid-Term Progress',
    reviewType: 'REVIEW_1',
    scheduledDate: new Date('2026-10-28T14:00:00Z'),
    deadline: new Date('2026-10-27T18:00:00Z'),
    instructions: 'Upload live demo screencast, system architecture diagram PDF, and repository code link.',
    requiredDocType: 'ALL',
    maxMarks: 50,
    rubricCriteria: [
      { name: 'System Architecture & Schema Design', maxScore: 15, description: 'Quality and normalization of data layer' },
      { name: 'Module Implementation Progress', maxScore: 15, description: 'Working status of core backend APIs & UI' },
      { name: 'Quality of Code & Testing', maxScore: 10, description: 'Adherence to design patterns and test coverage' },
      { name: 'Demo Presentation & Technical Q&A', maxScore: 10, description: 'Live feature demonstration to review committee' }
    ],
    status: 'SCHEDULED'
  });

  // 11. Seed Notifications
  console.log('Seeding notifications...');
  await Notification.create([
    {
      recipient: student1._id,
      recipientModel: 'Student',
      sender: admin._id,
      senderModel: 'Admin',
      title: 'Project Proposal Approved',
      message: 'Your project proposal "AI-Driven Academic Project Intelligence Platform" has been approved by the PRC.',
      type: 'PROPOSAL_APPROVED',
      read: true
    },
    {
      recipient: student1._id,
      recipientModel: 'Student',
      sender: guide1._id,
      senderModel: 'Faculty',
      title: 'Review 1 Scheduled',
      message: 'Mid-term Review 1 is scheduled for Oct 28, 2026. Please upload slides before the deadline.',
      type: 'DEADLINE',
      read: false
    },
    {
      recipient: guide1._id,
      recipientModel: 'Faculty',
      sender: student1._id,
      senderModel: 'Student',
      title: 'Weekly Progress Submitted',
      message: 'Kishore T S submitted Week 3 progress report for review.',
      type: 'STATUS_CHANGE',
      read: true
    }
  ]);

  console.log('----------------------------------------------------');
  console.log('🎉 PROJINTEL DATABASE SEEDED SUCCESSFULLY!');
  console.log('Institutional Test Credentials:');
  console.log('  👨‍🎓 Student:  student@vcet.edu.in  / Password@123 (Kishore T S)');
  console.log('  👨‍🏫 Faculty:  guide@vcet.edu.in    / Password@123 (Dr. M. Sundararajan)');
  console.log('  🛡️ Admin:    admin@vcet.edu.in    / Password@123 (Dr. K. Arulmozhi)');
  console.log('----------------------------------------------------');
  process.exit(0);
}

seedDatabase().catch((err) => {
  console.error('Database seeding failed:', err);
  process.exit(1);
});
