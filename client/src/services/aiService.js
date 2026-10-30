/**
 * ProjIntel Frontend AI Client Service
 * Dispatches requests to backend /api/ai endpoints.
 * Never handles or exposes GROQ_API_KEY on the client.
 */

import { API_ORIGIN } from './api';

const API_BASE_URL = `${API_ORIGIN}/api/ai`;

async function postAI(endpoint, data = {}) {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `HTTP ${res.status}: Failed to process AI request.`
      };
    }

    return await res.json();
  } catch (err) {
    console.error(`[AI Client Error - ${endpoint}]:`, err);
    return {
      success: false,
      error: 'Unable to connect to AI backend service. Please check if the server is running.'
    };
  }
}

export async function checkAIHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) return { configured: false, status: 'error' };
    return await res.json();
  } catch (err) {
    return { configured: false, status: 'offline' };
  }
}

export async function calculateProjectRisk(project) {
  return await postAI('/risk-calculate', { project });
}

export async function explainProjectRisk(project) {
  return await postAI('/risk-explanation', { project });
}

export async function analyzeProposal(project) {
  return await postAI('/proposal-analysis', { proposal: project });
}

export async function analyzeFeasibility(project) {
  return await postAI('/feasibility-analysis', { proposal: project });
}

export async function prioritizeTasks(project) {
  return await postAI('/task-prioritization', { project });
}

export async function generateProjectSummary(project) {
  return await postAI('/project-summary', { project });
}

export async function analyzeWeeklyReport(report, project) {
  return await postAI('/report-analysis', { report, project });
}

export async function generateFacultyFeedback(notes, context = {}) {
  return await postAI('/generate-feedback', { notes, context });
}

export async function analyzeProjectSimilarity(project, allProjects = []) {
  return await postAI('/project-similarity', { project, allProjects });
}

export async function analyzeFacultyWorkload(projectsList = [], facultyList = []) {
  return await postAI('/workload-analysis', { projectsList, facultyList });
}

export async function recommendFacultyAssignment(project, facultyList = [], allProjects = []) {
  return await postAI('/recommend-faculty', { project, facultyList, allProjects });
}

export async function generateAcademicInsights(projectsList = [], facultyList = []) {
  return await postAI('/academic-insights', { projectsList, facultyList });
}

export async function sendChatMessage({ message, userRole, context, chatHistory = [] }) {
  return await postAI('/chat', { message, userRole, context, chatHistory });
}

export async function evaluateReviewWithAI(review, submission, project) {
  return await postAI('/review-evaluation', { review, submission, project });
}

