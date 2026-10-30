/**
 * In-Memory Presentation Store for PROJINTEL
 * Enables presentation & offline demo mode with full feature interactivity.
 */

const mockDepartments = [
  { _id: 'dept_cse', id: 'dept_cse', name: 'Computer Science & Engineering', code: 'CSE' },
  { _id: 'dept_it', id: 'dept_it', name: 'Information Technology', code: 'IT' },
  { _id: 'dept_aids', id: 'dept_aids', name: 'Artificial Intelligence & Data Science', code: 'AI&DS' },
  { _id: 'dept_ece', id: 'dept_ece', name: 'Electronics & Communication Engineering', code: 'ECE' }
];

const mockUsers = {
  student: {
    _id: '6ada46bbf4076fdbbd7f874c',
    id: '6ada46bbf4076fdbbd7f874c',
    name: 'Muthunilavan D',
    email: 'muthunilavand@gmail.com',
    role: 'STUDENT',
    regNo: '913123104100',
    department: mockDepartments[0],
    year: 4,
    project: '6add84d800b4104a004397e3'
  },
  faculty: {
    _id: 'user_faculty_1',
    id: 'user_faculty_1',
    name: 'Dr. S. Kavitha',
    email: 'faculty2@vcet.edu.in',
    facultyId: 'FAC-CSE-005',
    role: 'FACULTY',
    designation: 'Professor / Senior Guide',
    department: mockDepartments[0],
    maxProjects: 6
  },
  admin: {
    _id: 'user_admin_1',
    id: 'user_admin_1',
    name: 'Dr. K. Arulmozhi',
    email: 'muthunilavand555@gmail.com',
    role: 'ADMIN',
    department: mockDepartments[0]
  }
};

let mockProjects = [
  {
    _id: 'proj_1',
    id: 'proj_1',
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
    teamMembers: [mockUsers.student],
    department: mockDepartments[0],
    dept: 'Computer Science & Engineering',
    status: 'APPROVED',
    guide: mockUsers.faculty,
    guideName: 'Dr. S. Kavitha',
    guideId: 'user_faculty_1',
    leadName: 'Muthunilavan D',
    progress: 72,
    submittedDate: '2026-08-15T00:00:00.000Z',
    approvedDate: '2026-08-20T00:00:00.000Z',
    comments: [
      {
        author: 'Dr. S. Kavitha',
        text: 'The problem statement is well-formulated. Proposal approved. Proceed with Milestone 1 and 2.',
        isGuide: true,
        time: '2026-08-20T10:30:00Z'
      },
      {
        author: 'Muthunilavan D',
        text: 'Thank you Dr. Kavitha! We have completed architecture and API schema design.',
        isGuide: false,
        time: '2026-08-21T09:15:00Z'
      }
    ],
    ieeeDetails: {
      paperTitle: 'Deep Neural Network Architecture for Predictive Academic Milestone Oversight',
      conferenceName: 'IEEE International Conference on Advanced Computing and Communication Systems (ICACCS 2027)',
      conferenceDate: '2027-03-18',
      latestDraft: {
        fileName: 'ieee_projintel_v2.pdf',
        originalName: 'ProjIntel_IEEE_Draft_v2.pdf',
        filePath: '/uploads/documents/sample_ieee_v2.pdf',
        fileSize: '1.8 MB',
        uploadedAt: '2026-10-22T14:30:00.000Z',
        version: 2
      },
      previousDraft: {
        fileName: 'ieee_projintel_v1.docx',
        originalName: 'ProjIntel_IEEE_Draft_v1.docx',
        filePath: '/uploads/documents/sample_ieee_v1.docx',
        fileSize: '1.2 MB',
        uploadedAt: '2026-10-10T11:00:00.000Z',
        version: 1
      },
      isSubmitted: true,
      submissionProof: {
        fileName: 'submission_receipt.pdf',
        originalName: 'IEEE_ICACCS_Submission_Receipt.pdf',
        filePath: '/uploads/documents/sample_receipt.pdf',
        fileSize: '340 KB',
        uploadedAt: '2026-10-23T09:00:00.000Z'
      },
      isAccepted: true,
      acceptanceProof: {
        fileName: 'acceptance_letter.pdf',
        originalName: 'ICACCS_2027_Acceptance_Letter.pdf',
        filePath: '/uploads/documents/sample_acceptance.pdf',
        fileSize: '512 KB',
        uploadedAt: '2026-10-25T16:20:00.000Z'
      },
      isPublished: false,
      publicationProof: null,
      updatedAt: '2026-10-25T16:20:00.000Z'
    }
  },
  {
    _id: 'proj_2',
    id: 'proj_2',
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
    teamMembers: [{ name: 'Ananya R', regNo: '913121104015' }],
    department: mockDepartments[0],
    dept: 'Computer Science & Engineering',
    status: 'SUBMITTED',
    guide: mockUsers.faculty,
    guideName: 'Dr. M. Sundararajan',
    guideId: 'user_faculty_1',
    leadName: 'Ananya R',
    progress: 25,
    submittedDate: '2026-09-02T00:00:00.000Z',
    comments: []
  },
  {
    _id: 'proj_3',
    id: 'proj_3',
    title: 'Privacy-Preserving Electronic Health Record Exchange on Ethereum',
    description: 'Decentralized patient consent management and encrypted medical records indexing using zero-knowledge snarks and IPFS decentralized file storage.',
    abstract: 'Eliminating single-point medical data breaches via patient-custodied zero-knowledge permissions on EVM rollups.',
    problemStatement: 'Centralized healthcare databases are susceptible to data breaches and lack patient audit trails.',
    objectives: [
      'Implement ERC-725/735 decentralized patient identity verification',
      'Build IPFS content addressing with AES-GCM envelope encryption',
      'Deploy Zero-Knowledge access validation on testnet'
    ],
    domain: 'Blockchain & Cryptography',
    technologies: ['Solidity', 'Hardhat', 'IPFS', 'Ethers.js', 'React', 'ZKSnarks'],
    teamMembers: [{ name: 'Meena K', regNo: '913121105018' }],
    department: mockDepartments[1],
    dept: 'Information Technology',
    status: 'REVISION_REQUESTED',
    guide: mockUsers.faculty,
    guideName: 'Dr. M. Sundararajan',
    guideId: 'user_faculty_1',
    leadName: 'Meena K',
    progress: 40,
    submittedDate: '2026-08-25T00:00:00.000Z',
    comments: [
      {
        author: 'Dr. M. Sundararajan',
        text: 'Please clarify the gas fee mitigation strategy for frequent health record transactions.',
        isGuide: true,
        time: '2026-08-28T14:00:00Z'
      }
    ]
  }
];

let mockMilestones = [
  {
    _id: 'ms_1',
    id: 'ms_1',
    project: 'proj_1',
    title: 'Milestone 1: Requirement Analysis & Architectural Blueprint',
    description: 'Comprehensive SRS, database ER schema, AI pipeline specifications and system boundary analysis.',
    order: 1,
    status: 'COMPLETED',
    completionPercentage: 100,
    dueDate: '2026-09-15T00:00:00.000Z'
  },
  {
    _id: 'ms_2',
    id: 'ms_2',
    project: 'proj_1',
    title: 'Milestone 2: Core Microservices & Database API Engine',
    description: 'RESTful API controllers for project lifecycle, JWT RBAC security middleware, and file repositories.',
    order: 2,
    status: 'COMPLETED',
    completionPercentage: 100,
    dueDate: '2026-10-10T00:00:00.000Z'
  },
  {
    _id: 'ms_3',
    id: 'ms_3',
    project: 'proj_1',
    title: 'Milestone 3: AI Inference Engine & Rubric Evaluator Integration',
    description: 'Groq Cloud LLM agent integration for proposal novelty scoring, objective rubric grading, and risk detection.',
    order: 3,
    status: 'IN_PROGRESS',
    completionPercentage: 65,
    dueDate: '2026-11-05T00:00:00.000Z'
  },
  {
    _id: 'ms_4',
    id: 'ms_4',
    project: 'proj_1',
    title: 'Milestone 4: End-to-End User Verification & Final Presentation',
    description: 'Comprehensive load testing, deployment, final thesis documentation, and project demonstration.',
    order: 4,
    status: 'PENDING',
    completionPercentage: 0,
    dueDate: '2026-12-01T00:00:00.000Z'
  }
];

let mockTasks = [
  {
    _id: 'task_1',
    id: 'task_1',
    project: 'proj_1',
    milestone: 'ms_1',
    title: 'Design high-fidelity UI wireframes in Figma',
    description: 'Develop responsive dashboard wireframes with dark-mode aesthetic for Student, Faculty, and Admin personas.',
    status: 'DONE',
    assignedTo: mockUsers.student,
    priority: 'HIGH',
    dueDate: '2026-09-05T00:00:00.000Z'
  },
  {
    _id: 'task_2',
    id: 'task_2',
    project: 'proj_1',
    milestone: 'ms_2',
    title: 'Implement JWT authentication & role-based route middleware',
    description: 'Secure all REST endpoints with signed token verification and student/faculty/admin access checks.',
    status: 'DONE',
    assignedTo: mockUsers.student,
    priority: 'HIGH',
    dueDate: '2026-09-28T00:00:00.000Z'
  },
  {
    _id: 'task_3',
    id: 'task_3',
    project: 'proj_1',
    milestone: 'ms_3',
    title: 'Integrate Groq AI analysis endpoint for proposals',
    description: 'Build backend proxy service connecting to Groq SDK to analyze project originality, risk factor, and complexity.',
    status: 'IN_PROGRESS',
    assignedTo: mockUsers.student,
    priority: 'HIGH',
    dueDate: '2026-10-25T00:00:00.000Z'
  },
  {
    _id: 'task_4',
    id: 'task_4',
    project: 'proj_1',
    milestone: 'ms_3',
    title: 'Build automated rubric scoring calculator',
    description: 'Implement dynamic criteria matrix: Literature Review (20), Methodology (30), Implementation (30), Viva (20).',
    status: 'IN_PROGRESS',
    assignedTo: mockUsers.student,
    priority: 'MEDIUM',
    dueDate: '2026-10-30T00:00:00.000Z'
  },
  {
    _id: 'task_5',
    id: 'task_5',
    project: 'proj_1',
    milestone: 'ms_4',
    title: 'Compile final thesis report & slide deck for viva',
    description: 'Draft IEEE formatted final documentation including test results and architecture diagram.',
    status: 'TODO',
    assignedTo: mockUsers.student,
    priority: 'MEDIUM',
    dueDate: '2026-11-20T00:00:00.000Z'
  }
];

let mockWeeklyUpdates = [
  {
    _id: 'w_1',
    id: 'w_1',
    project: 'proj_1',
    weekNumber: 1,
    title: 'Week 1: Literature Review & Problem Statement Finalization',
    summary: 'Reviewed 15 IEEE papers on automated project management in higher education. Defined system scope and constraints.',
    tasksCompleted: 'Surveyed existing LMS platforms; drafted system boundary specification.',
    challenges: 'Balancing automated AI feedback with university academic autonomy.',
    planForNextWeek: 'Complete entity relationship diagrams and finalize tech stack.',
    progressPercentage: 20,
    facultyScore: 9,
    facultyFeedback: 'Excellent background survey. Ensure adherence to department rubric guidelines.',
    status: 'GRADED',
    submittedAt: '2026-09-08T00:00:00.000Z'
  },
  {
    _id: 'w_2',
    id: 'w_2',
    project: 'proj_1',
    weekNumber: 2,
    title: 'Week 2: Backend Architecture & API Schema Design',
    summary: 'Constructed Node/Express server boilerplate, MongoDB connection pooling, and JWT authorization pipelines.',
    tasksCompleted: 'Tested auth routes; configured Vite development proxy.',
    challenges: 'None encountered.',
    planForNextWeek: 'Begin Milestone 2 API endpoints for project proposals.',
    progressPercentage: 45,
    facultyScore: 9.5,
    facultyFeedback: 'Well structured. Code quality is commendable.',
    status: 'GRADED',
    submittedAt: '2026-09-18T00:00:00.000Z'
  },
  {
    _id: 'w_3',
    id: 'w_3',
    project: 'proj_1',
    weekNumber: 3,
    title: 'Week 3: AI Analysis Integration & Rubric Matrix',
    summary: 'Connecting Groq LLM API for proposal evaluation and building interactive Kanban task board.',
    tasksCompleted: 'Completed Task model and Kanban UI drag-and-drop state updates.',
    challenges: 'Handling token limits during large document analysis.',
    planForNextWeek: 'Finalize Review 1 deliverables and prepare slides.',
    progressPercentage: 70,
    facultyScore: 9,
    facultyFeedback: 'Good progress. Ready for Review 1 presentation.',
    status: 'GRADED',
    submittedAt: '2026-10-15T00:00:00.000Z'
  }
];

let mockReviews = [
  {
    _id: 'rev_0',
    id: 'rev_0',
    project: 'proj_1',
    title: 'Review 0: Project Proposal & Feasibility Review',
    reviewType: 'REVIEW_0',
    description: 'Evaluation of project novelty, technological feasibility, and domain alignment.',
    scheduledDate: '2026-08-20T10:00:00.000Z',
    status: 'COMPLETED',
    score: 88,
    maxScore: 100,
    feedback: 'Strong proposal with high practical value. Approved to proceed.',
    criteria: [
      { name: 'Problem Relevance & Novelty', maxMarks: 25, obtainedMarks: 23 },
      { name: 'Literature Survey & Domain Study', maxMarks: 25, obtainedMarks: 22 },
      { name: 'Feasibility & Technology Stack', maxMarks: 25, obtainedMarks: 21 },
      { name: 'Oral Presentation & Q&A', maxMarks: 25, obtainedMarks: 22 }
    ]
  },
  {
    _id: 'rev_1',
    id: 'rev_1',
    project: 'proj_1',
    title: 'Review 1: Architectural Blueprint & 50% Implementation',
    reviewType: 'REVIEW_1',
    description: 'Assessment of database schema design, core API microservices, and prototype UI.',
    scheduledDate: '2026-10-25T14:00:00.000Z',
    status: 'SCHEDULED',
    score: null,
    maxScore: 100,
    criteria: [
      { name: 'System Architecture & Schema', maxMarks: 30, obtainedMarks: null },
      { name: 'Core Module Execution (50%)', maxMarks: 30, obtainedMarks: null },
      { name: 'Adherence to Milestones', maxMarks: 20, obtainedMarks: null },
      { name: 'Technical Viva Voce', maxMarks: 20, obtainedMarks: null }
    ]
  },
  {
    _id: 'rev_2',
    id: 'rev_2',
    project: 'proj_1',
    title: 'Review 2: Complete Implementation & AI Integration',
    reviewType: 'REVIEW_2',
    description: 'Verification of AI analysis pipelines, end-to-end user workflows, and comprehensive test coverage.',
    scheduledDate: '2026-11-20T11:00:00.000Z',
    status: 'UPCOMING',
    score: null,
    maxScore: 100
  }
];

let mockNotifications = [
  {
    _id: 'notif_1',
    id: 'notif_1',
    user: 'user_student_1',
    title: 'Proposal Approved',
    message: 'Dr. M. Sundararajan approved your project proposal. You can now manage milestones and tasks.',
    type: 'SUCCESS',
    read: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'notif_2',
    id: 'notif_2',
    user: 'user_student_1',
    title: 'Weekly Progress Graded',
    message: 'Your Week 3 progress report received a score of 9.0/10 with faculty advisory remarks.',
    type: 'INFO',
    read: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'notif_3',
    id: 'notif_3',
    user: 'user_student_1',
    title: 'Review 1 Scheduled',
    message: 'Review 1 is scheduled for Oct 25, 2026 at 02:00 PM online / remotely.',
    type: 'WARNING',
    read: false,
    createdAt: new Date().toISOString()
  }
];

module.exports = {
  mockDepartments,
  mockUsers,
  mockProjects,
  mockMilestones,
  mockTasks,
  mockWeeklyUpdates,
  mockReviews,
  mockNotifications
};
