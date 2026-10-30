const { callGroqChat } = require('./groqClient');
const { buildProjectContext } = require('./contextAdapters');

const SYSTEM_PROMPT = `You are the ProjIntel Task Prioritization & Scheduling Advisor.
Evaluate the tasks and milestones for an academic project to recommend optimal work priority.
Rules:
- Base priority ranking strictly on task deadlines, current task status (TODO, IN_PROGRESS, COMPLETED), milestones, and potential technical blockers.
- Do NOT modify or delete tasks automatically.
- Provide clear, concise reasons for each recommended priority.
- If no tasks exist, return an empty list with an explanatory note.`;

/**
 * Prioritize tasks for a given project.
 */
async function prioritizeTasks(project) {
  if (!project) {
    return {
      success: false,
      error: 'No project data provided.'
    };
  }

  const tasks = project.tasks || [];
  if (tasks.length === 0) {
    return {
      success: true,
      prioritizedTasks: [],
      summary: 'No active tasks found in this project. Create tasks under your active milestone to receive prioritization recommendations.'
    };
  }

  const projectContext = buildProjectContext(project);

  const prompt = `Analyze and prioritize the following project tasks:
PROJECT & TASKS CONTEXT:
${JSON.stringify({
  projectTitle: projectContext.title,
  currentStatus: projectContext.status,
  milestones: projectContext.milestones,
  tasks: projectContext.tasks
}, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "summary": "Brief 1-2 sentence overall guidance on where the team should focus their development effort",
  "prioritizedTasks": [
    {
      "taskId": "matched task title or identifier",
      "title": "Exact title of the task",
      "currentPriority": "HIGH / MEDIUM / LOW",
      "recommendedPriority": "CRITICAL / HIGH / MEDIUM / LOW",
      "rank": 1,
      "reason": "Clear explanation of why this should be worked on at this priority (e.g. Milestone due soon, foundational architecture, or non-blocking)"
    }
  ]
}`;

  const result = await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });

  if (!result.success || !result.data) {
    // Fallback: order by priority and status deterministically
    const sorted = [...tasks].sort((a, b) => {
      const pMap = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (pMap[b.priority] || 2) - (pMap[a.priority] || 2);
    });

    return {
      success: true,
      summary: 'Tasks sorted by priority level and milestone progression.',
      prioritizedTasks: sorted.map((t, idx) => ({
        taskId: t.id || t.title,
        title: t.title,
        currentPriority: t.priority || 'MEDIUM',
        recommendedPriority: t.priority || 'MEDIUM',
        rank: idx + 1,
        reason: t.status === 'IN_PROGRESS' ? 'Currently in progress' : 'Scheduled for current milestone'
      }))
    };
  }

  return {
    success: true,
    summary: result.data.summary,
    prioritizedTasks: result.data.prioritizedTasks || []
  };
}

module.exports = {
  prioritizeTasks
};
