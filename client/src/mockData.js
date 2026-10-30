export const clientMockProjects = [
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
    dept: 'Computer Science & Engineering',
    status: 'APPROVED',
    guideName: 'Dr. M. Sundararajan',
    guideId: 'user_faculty_1',
    leadName: 'Muthunilavan D',
    teamMembers: ['Muthunilavan D'],
    progress: 72,
    submittedDate: '2026-08-15T00:00:00.000Z',
    approvedDate: '2026-08-20T00:00:00.000Z',
    milestones: [
      { id: 'ms_1', number: 1, title: 'Milestone 1: Requirement Analysis & Architectural Blueprint', description: 'Comprehensive SRS, database ER schema, and system boundary analysis.', status: 'COMPLETED', progress: 100, dueDate: 'Sep 15' },
      { id: 'ms_2', number: 2, title: 'Milestone 2: Core Microservices & Database API Engine', description: 'RESTful API controllers for project lifecycle, JWT RBAC security middleware.', status: 'COMPLETED', progress: 100, dueDate: 'Oct 10' },
      { id: 'ms_3', number: 3, title: 'Milestone 3: AI Inference Engine & Rubric Evaluator Integration', description: 'Groq Cloud LLM agent integration for proposal novelty scoring and risk detection.', status: 'IN_PROGRESS', progress: 65, dueDate: 'Nov 05' },
      { id: 'ms_4', number: 4, title: 'Milestone 4: End-to-End User Verification & Final Presentation', description: 'Comprehensive load testing, deployment, and thesis documentation.', status: 'TODO', progress: 0, dueDate: 'Dec 01' }
    ],
    tasks: [
      { id: 'task_1', title: 'Design high-fidelity UI wireframes in Figma', description: 'Develop responsive dashboard wireframes with dark-mode aesthetic.', status: 'DONE', priority: 'HIGH', milestoneId: 'ms_1', assignedTo: { name: 'Muthunilavan D' } },
      { id: 'task_2', title: 'Implement JWT authentication & role-based route middleware', description: 'Secure all REST endpoints with signed token verification.', status: 'DONE', priority: 'HIGH', milestoneId: 'ms_2', assignedTo: { name: 'Muthunilavan D' } },
      { id: 'task_3', title: 'Integrate Groq AI analysis endpoint for proposals', description: 'Build backend proxy service connecting to Groq SDK to analyze project originality.', status: 'IN_PROGRESS', priority: 'HIGH', milestoneId: 'ms_3', assignedTo: { name: 'Muthunilavan D' } },
      { id: 'task_4', title: 'Build automated rubric scoring calculator', description: 'Implement dynamic criteria matrix: Literature Review, Methodology, Implementation, Viva.', status: 'IN_PROGRESS', priority: 'MEDIUM', milestoneId: 'ms_3', assignedTo: { name: 'Muthunilavan D' } },
      { id: 'task_5', title: 'Compile final thesis report & slide deck for viva', description: 'Draft IEEE formatted final documentation including test results.', status: 'TODO', priority: 'MEDIUM', milestoneId: 'ms_4', assignedTo: { name: 'Muthunilavan D' } }
    ],
    weeklyUpdates: [
      { id: 'w_1', weekNumber: 1, workCompleted: 'Literature survey on automated LMS platforms.', progressPct: 25, score: 9, feedback: 'Thorough literature review.', status: 'GRADED' },
      { id: 'w_2', weekNumber: 2, workCompleted: 'Backend architecture and REST API endpoints design.', progressPct: 50, score: 9.5, feedback: 'Excellent architecture blueprint.', status: 'GRADED' },
      { id: 'w_3', weekNumber: 3, workCompleted: 'AI proposal evaluation agent and Kanban taskboard.', progressPct: 75, score: 9, feedback: 'Very good progress toward Review 1.', status: 'GRADED' }
    ],
    comments: [
      { author: 'Dr. M. Sundararajan', text: 'The problem statement is well-formulated. Proposal approved. Proceed with Milestone 1 and 2.', isGuide: true, time: '2026-08-20T10:30:00Z' },
      { author: 'Muthunilavan D', text: 'Thank you Dr. Sundararajan! We will complete the architecture and schema design this week.', isGuide: false, time: '2026-08-21T09:15:00Z' }
    ],
    documents: [],
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
    description: 'Vision-based orchard drone navigation using YOLOv8 edge inference and LiDAR SLAM for real-time orchard mapping without GPS dependencies.',
    abstract: 'Autonomous UAV system using stereoscopic cameras and neural inference to inspect crop canopy and detect early fungal blight.',
    domain: 'Robotics & Computer Vision',
    technologies: ['Python', 'YOLOv8', 'ROS2', 'OpenCV', 'PyTorch'],
    dept: 'Computer Science & Engineering',
    status: 'SUBMITTED',
    guideName: 'Dr. M. Sundararajan',
    guideId: 'user_faculty_1',
    leadName: 'Ananya R',
    teamMembers: ['Ananya R'],
    progress: 25,
    submittedDate: '2026-09-02T00:00:00.000Z',
    milestones: [],
    tasks: [],
    weeklyUpdates: [],
    comments: [],
    documents: []
  },
  {
    _id: 'proj_3',
    id: 'proj_3',
    title: 'Privacy-Preserving Electronic Health Record Exchange on Ethereum',
    description: 'Decentralized patient consent management and encrypted medical records indexing using zero-knowledge snarks and IPFS decentralized file storage.',
    abstract: 'Eliminating single-point medical data breaches via patient-custodied zero-knowledge permissions on EVM rollups.',
    domain: 'Blockchain & Cryptography',
    technologies: ['Solidity', 'Hardhat', 'IPFS', 'Ethers.js', 'React'],
    dept: 'Information Technology',
    status: 'REVISION_REQUESTED',
    guideName: 'Dr. M. Sundararajan',
    guideId: 'user_faculty_1',
    leadName: 'Meena K',
    teamMembers: ['Meena K'],
    progress: 40,
    submittedDate: '2026-08-25T00:00:00.000Z',
    milestones: [],
    tasks: [],
    weeklyUpdates: [],
    comments: [
      { author: 'Dr. M. Sundararajan', text: 'Please clarify the gas fee mitigation strategy for frequent health record transactions.', isGuide: true, time: '2026-08-28T14:00:00Z' }
    ],
    documents: []
  }
];

export const clientMockReviews = [
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
  }
];

export const clientMockNotifications = [
  {
    _id: 'notif_1',
    id: 'notif_1',
    title: 'Proposal Approved',
    message: 'Dr. M. Sundararajan approved your project proposal. You can now manage milestones and tasks.',
    type: 'SUCCESS',
    read: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'notif_2',
    id: 'notif_2',
    title: 'Weekly Progress Graded',
    message: 'Your Week 3 progress report received a score of 9.0/10 with faculty advisory remarks.',
    type: 'INFO',
    read: false,
    createdAt: new Date().toISOString()
  }
];
