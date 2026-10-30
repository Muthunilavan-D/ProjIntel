const { callGroqChat } = require('./groqClient');
const { buildProjectContext } = require('./contextAdapters');

const SYSTEM_PROMPT = `You are the ProjIntel Project Progress & Status Summarizer.
Summarize the current state of the academic project.
Rules:
- Base the summary strictly on the supplied project progress, milestones, completed tasks, pending tasks, and weekly reports.
- Do NOT invent information or speculate.
- Keep the summary clear, well-structured, and concise.`;

/**
 * Generate a comprehensive status summary of a project.
 */
async function generateProjectSummary(project) {
  if (!project) {
    return {
      success: false,
      error: 'Project data is required to generate a summary.'
    };
  }

  const projectContext = buildProjectContext(project);

  const prompt = `Generate an executive status summary for this student academic project:
PROJECT CONTEXT:
${JSON.stringify(projectContext, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "title": "${project.title}",
  "statusSummary": "2-3 sentence overview of current project progress and lifecycle stage",
  "completedWork": [
    "Highlight of completed milestone or task 1",
    "Highlight of completed milestone or task 2"
  ],
  "pendingWork": [
    "Pending task or upcoming milestone item 1",
    "Pending task or upcoming milestone item 2"
  ],
  "milestoneStatus": "Summary of active and completed milestones",
  "currentBlockers": [
    "Any reported blocker from recent weekly updates or flagged dependencies"
  ],
  "upcomingFocus": "Specific recommendation for what the team should accomplish next"
}`;

  return await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });
}

module.exports = {
  generateProjectSummary
};
