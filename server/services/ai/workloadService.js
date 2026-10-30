const { callGroqChat } = require('./groqClient');
const { buildAdminContext } = require('./contextAdapters');

const SYSTEM_PROMPT = `You are the ProjIntel Faculty Workload & Project Allocation Advisor.
Analyze department projects and faculty guide rosters to balance workloads and recommend ideal faculty guides.
Rules:
- Strictly obey faculty capacity constraints (e.g. activeProjects vs maxProjects).
- Match faculty department and domain expertise with project requirements.
- AI provides ADVISORY RECOMMENDATIONS ONLY. Admin makes final decisions.
- Do NOT automatically assign faculty or reassign projects.`;

/**
 * Analyze overall faculty workload across departments.
 */
async function analyzeFacultyWorkload(projectsList = [], facultyList = []) {
  const adminContext = buildAdminContext(projectsList, facultyList);

  const prompt = `Analyze current faculty workload and distribution:
ADMIN CONTEXT:
${JSON.stringify(adminContext, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "workloadSummary": "2-sentence executive summary of department faculty allocation balance",
  "facultyInsights": [
    {
      "facultyId": "FAC-102",
      "facultyName": "Dr. A. Sharma (HOD)",
      "currentProjects": 4,
      "capacityStatus": "Moderate Load / Near Capacity / Available",
      "observation": "Observation regarding current projects and domain coverage",
      "recommendation": "Advisory recommendation for future assignments"
    }
  ],
  "distributionRisks": [
    "Identified risk or bottleneck in workload distribution 1"
  ],
  "overallRecommendation": "Actionable departmental balancing advice for the admin"
}`;

  return await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });
}

/**
 * Recommend the most suitable faculty guide for a specific unassigned project.
 */
async function recommendFacultyAssignment(project, facultyList = [], allProjects = []) {
  if (!project) {
    return {
      success: false,
      error: 'Project data is required for faculty assignment recommendation.'
    };
  }

  const prompt = `Recommend the most suitable faculty guide for this project:
PROJECT DETAILS:
- Title: ${project.title}
- Domain: ${project.domain}
- Department: ${project.dept}
- Technologies: ${project.technologies}
- Problem Statement: ${project.problemStatement || project.abstract || ''}

AVAILABLE FACULTY GUIDES:
${JSON.stringify(facultyList, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "recommendedFacultyName": "Name of best matching faculty",
  "recommendedFacultyId": "FAC-XXX",
  "matchScore": 92,
  "reason": "Detailed justification connecting faculty department/domain expertise with project needs and current workload balance",
  "relevantExpertise": [
    "Domain alignment 1",
    "Technology synergy 2"
  ],
  "currentWorkloadStatus": "e.g. 3/6 active projects - suitable capacity available",
  "alternativeRecommendation": {
    "facultyName": "Alternative Faculty Name",
    "reason": "Secondary option justification"
  }
}`;

  return await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });
}

module.exports = {
  analyzeFacultyWorkload,
  recommendFacultyAssignment
};
