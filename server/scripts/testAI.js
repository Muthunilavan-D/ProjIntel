const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });
dotenv.config(); // fallback

const { isGroqConfigured } = require('../services/ai/groqClient');
const { calculateProjectRisk } = require('../services/ai/riskEngine');
const { explainProjectRisk } = require('../services/ai/riskExplainer');
const { analyzeProposal, analyzeFeasibility } = require('../services/ai/proposalAnalyzer');
const { prioritizeTasks } = require('../services/ai/taskPrioritizer');
const { generateProjectSummary } = require('../services/ai/projectSummary');
const { analyzeWeeklyReport } = require('../services/ai/reportAnalyzer');
const { generateFacultyFeedback } = require('../services/ai/feedbackGenerator');
const { analyzeProjectSimilarity } = require('../services/ai/similarityService');
const { analyzeFacultyWorkload, recommendFacultyAssignment } = require('../services/ai/workloadService');
const { generateAcademicInsights } = require('../services/ai/academicInsights');
const { processAssistantChat } = require('../services/ai/assistantService');

const mockProject = {
  id: 'PROJ-01',
  title: 'AI-Driven Academic Project Intelligence Platform',
  domain: 'Artificial Intelligence & Machine Learning',
  dept: 'Computer Science & Engineering',
  leadName: 'Kishore T S',
  teamMembers: ['Kishore T S', 'Praveen S', 'Sanjay V'],
  abstract: 'A centralized workspace connecting engineering students, faculty guides, and department heads.',
  problemStatement: 'Manual tracking of final year academic projects leads to delays and lack of visibility.',
  objectives: '1. Digitize proposal review. 2. Milestone and task tracking. 3. Weekly progress updates with grading.',
  technologies: 'React, Node.js, Express, MongoDB',
  status: 'APPROVED',
  guideName: 'Dr. A. Sharma (HOD)',
  milestones: [
    { number: 1, title: 'Problem Definition', status: 'COMPLETED', progress: 100 },
    { number: 2, title: 'Literature Survey', status: 'COMPLETED', progress: 100 },
    { number: 3, title: 'Requirements Analysis', status: 'COMPLETED', progress: 100 },
    { number: 4, title: 'System Design', status: 'IN_PROGRESS', progress: 60 },
    { number: 5, title: 'Implementation', status: 'TODO', progress: 0 }
  ],
  tasks: [
    { id: 't1', title: 'Design MongoDB Schemas with Mongoose', priority: 'HIGH', status: 'COMPLETED', dueDate: 'Sep 10' },
    { id: 't2', title: 'Build Express REST Endpoints', priority: 'MEDIUM', status: 'IN_PROGRESS', dueDate: 'Sep 14' },
    { id: 't3', title: 'Implement React Student Workspace UI', priority: 'HIGH', status: 'TODO', dueDate: 'Sep 25' }
  ],
  weeklyUpdates: [
    {
      weekNumber: 1,
      workCompleted: 'Finalized problem statement, literature survey, and repository setup.',
      problemsFaced: 'Selecting database schema structure.',
      nextWeekPlan: 'Draft software requirements specification (SRS).',
      progressPct: 20,
      facultyFeedback: 'Good start. Ensure the requirements document covers all 3 user roles.',
      facultyScore: 92
    }
  ]
};

const mockFacultyList = [
  { id: 'FAC-102', name: 'Dr. A. Sharma (HOD)', dept: 'Computer Science & Engineering', activeProjects: 4, maxProjects: 6 },
  { id: 'FAC-103', name: 'Prof. R. Venkatesh', dept: 'Information Technology', activeProjects: 3, maxProjects: 6 }
];

async function runTests() {
  console.log('--- ProjIntel AI Services Test Suite ---');
  console.log('Groq Configured:', isGroqConfigured());
  console.log('Model:', process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');

  // Test 1: Deterministic Risk Engine
  console.log('\n[TEST 1] Deterministic Risk Engine:');
  const risk = calculateProjectRisk(mockProject);
  console.log('Score:', risk.riskScore, 'Level:', risk.riskLevel, 'Factors:', risk.riskFactors);

  // Test 2: Risk Explanation
  console.log('\n[TEST 2] AI Risk Explanation:');
  const riskExp = await explainProjectRisk(mockProject);
  console.log('Risk Explanation Result:', JSON.stringify(riskExp, null, 2));

  // Test 3: Proposal & Feasibility Analysis
  console.log('\n[TEST 3] AI Proposal Analysis:');
  const propRes = await analyzeProposal(mockProject);
  console.log('Proposal Analysis:', JSON.stringify(propRes.data || propRes, null, 2));

  // Test 4: Task Prioritization
  console.log('\n[TEST 4] AI Task Prioritization:');
  const taskRes = await prioritizeTasks(mockProject);
  console.log('Task Prioritization:', JSON.stringify(taskRes, null, 2));

  // Test 5: Weekly Report Analysis
  console.log('\n[TEST 5] AI Weekly Report Analysis:');
  const reportRes = await analyzeWeeklyReport(mockProject.weeklyUpdates[0], mockProject);
  console.log('Report Analysis:', JSON.stringify(reportRes.data || reportRes, null, 2));

  // Test 6: Faculty Feedback Generator
  console.log('\n[TEST 6] AI Faculty Feedback Generation:');
  const feedbackRes = await generateFacultyFeedback('Schema is clean. Finish Express routing and add error handling middleware.');
  console.log('Feedback Result:', JSON.stringify(feedbackRes.data || feedbackRes, null, 2));

  // Test 7: Faculty Workload & Assignment
  console.log('\n[TEST 7] Faculty Assignment Recommendation:');
  const assignRes = await recommendFacultyAssignment(mockProject, mockFacultyList, [mockProject]);
  console.log('Assignment Recommendation:', JSON.stringify(assignRes.data || assignRes, null, 2));

  // Test 8: Academic Insights
  console.log('\n[TEST 8] Academic Project Intelligence:');
  const insightsRes = await generateAcademicInsights([mockProject], mockFacultyList);
  console.log('Academic Insights:', JSON.stringify(insightsRes, null, 2));

  // Test 9: Assistant Chat
  console.log('\n[TEST 9] Student AI Assistant Chat:');
  const chatRes = await processAssistantChat({
    message: 'What should I work on first for my project?',
    userRole: 'STUDENT',
    context: mockProject
  });
  console.log('Chat Response:', chatRes.content || chatRes.error);

  console.log('\n=== All AI Services Tested Successfully ===');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
});
