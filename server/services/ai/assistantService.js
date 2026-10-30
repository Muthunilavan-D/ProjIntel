const { callGroqChat, isGroqConfigured } = require('./groqClient');
const { calculateProjectRisk } = require('./riskEngine');
const { buildProjectContext } = require('./contextAdapters');

/**
 * Validate and sanitize JSON response returned by AI according to ProjIntel schema.
 */
function parseAndValidateAiJson(rawContent) {
  if (!rawContent) return null;
  let parsed = null;

  if (typeof rawContent === 'object') {
    parsed = rawContent;
  } else if (typeof rawContent === 'string') {
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      // Attempt to extract JSON substring from potential fences or extra text
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          return null;
        }
      } else {
        return null;
      }
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  // Clean strings of rogue markdown / HTML tags if any leaked through
  const cleanStr = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val)
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/^[-*•]\s+/gm, '')
      .trim();

    // Clean dangling hyphens or unfinished connectors at the end of string
    if (/[-–—/]\s*$/.test(str)) {
      str = str.replace(/[-–—/]\s*$/, '').trim();
      if (str.length > 0 && !/[.!?]$/.test(str)) {
        str += '.';
      }
    }
    return str;
  };

  const cleanArrayOfStr = (arr) => {
    if (!Array.isArray(arr)) {
      return arr ? [cleanStr(arr)] : [];
    }
    return arr.map(cleanStr).filter(s => s.length > 0);
  };

  // Structured sanitized schema
  const sanitized = {
    response_type: typeof parsed.response_type === 'string' ? cleanStr(parsed.response_type) : 'project_insight',
    title: typeof parsed.title === 'string' && parsed.title.trim() ? cleanStr(parsed.title) : 'Project Insight',
    summary: typeof parsed.summary === 'string' ? cleanStr(parsed.summary) : '',
    observation: parsed.observation && typeof parsed.observation === 'object' ? {
      key_points: cleanArrayOfStr(parsed.observation.key_points || parsed.observation.keyPoints || []),
      status_overview: cleanStr(parsed.observation.status_overview || parsed.observation.statusOverview || ''),
      blockers: cleanArrayOfStr(parsed.observation.blockers || [])
    } : {
      key_points: typeof parsed.observation === 'string' ? [cleanStr(parsed.observation)] : [],
      status_overview: '',
      blockers: []
    },
    risk: {
      level: parsed.risk?.level ? String(parsed.risk.level).toUpperCase() : 'LOW',
      reason: cleanArrayOfStr(parsed.risk?.reason || [])
    },
    priority_tasks: Array.isArray(parsed.priority_tasks) ? parsed.priority_tasks.map((t, idx) => ({
      rank: Number(t.rank) || idx + 1,
      task_id: cleanStr(t.task_id || t.taskId || `T-${idx + 1}`),
      title: cleanStr(t.title || 'Task'),
      priority: String(t.priority || 'MEDIUM').toUpperCase(),
      status: String(t.status || 'TODO').toUpperCase(),
      due_date: cleanStr(t.due_date || t.dueDate || ''),
      action: cleanStr(t.action || ''),
      reason: cleanStr(t.reason || '')
    })) : [],
    recommendation: {
      immediate_action: cleanStr(parsed.recommendation?.immediate_action || parsed.recommendation?.immediateAction || ''),
      next_step: cleanStr(parsed.recommendation?.next_step || parsed.recommendation?.nextStep || ''),
      reason: cleanStr(parsed.recommendation?.reason || '')
    },
    next_milestone: parsed.next_milestone && typeof parsed.next_milestone === 'object' ? {
      milestone_number: Number(parsed.next_milestone.milestone_number || parsed.next_milestone.number) || 1,
      title: cleanStr(parsed.next_milestone.title || ''),
      due_date: cleanStr(parsed.next_milestone.due_date || parsed.next_milestone.dueDate || ''),
      progress: typeof parsed.next_milestone.progress === 'number' ? parsed.next_milestone.progress : 0,
      status: String(parsed.next_milestone.status || 'IN_PROGRESS').toUpperCase(),
      focus: cleanStr(parsed.next_milestone.focus || parsed.next_milestone.deliverable || '')
    } : null
  };

  // Must have some minimal valid content
  if (!sanitized.summary && sanitized.priority_tasks.length === 0 && !sanitized.recommendation.immediate_action) {
    return null;
  }

  return sanitized;
}

/**
 * Build deterministic fallback response when AI is offline or Groq is unconfigured.
 */
function buildDeterministicResponse(message, userRole, projectData) {
  const risk = calculateProjectRisk(projectData);
  const tasks = projectData?.tasks || [];
  const milestones = projectData?.milestones || [];
  const activeMilestone = milestones.find(m => m.status === 'IN_PROGRESS') || milestones[0] || null;

  const sortedTasks = [...tasks].sort((a, b) => {
    const pMap = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (pMap[b.priority] || 2) - (pMap[a.priority] || 2);
  });

  return {
    response_type: 'project_insight',
    title: 'Project Intelligence Insight',
    summary: `Project "${projectData?.title || 'Academic Project'}" is currently ${projectData?.status || 'active'} with a deterministic risk rating of ${risk.riskLevel} (${risk.riskScore}/100).`,
    observation: {
      key_points: [
        `Active milestones: ${milestones.filter(m => m.status === 'IN_PROGRESS').length} in progress, ${milestones.filter(m => m.status === 'COMPLETED').length} completed.`,
        `Task backlog: ${tasks.filter(t => t.status === 'COMPLETED').length}/${tasks.length} tasks completed.`
      ],
      status_overview: `Project is tracking towards ${activeMilestone ? activeMilestone.title : 'milestone completion'}.`,
      blockers: risk.riskFactors.filter(f => f.toLowerCase().includes('blocker') || f.toLowerCase().includes('high-priority'))
    },
    risk: {
      level: risk.riskLevel,
      reason: risk.riskFactors
    },
    priority_tasks: sortedTasks.slice(0, 4).map((t, idx) => ({
      rank: idx + 1,
      task_id: t.id || `T-${idx + 1}`,
      title: t.title,
      priority: t.priority || 'MEDIUM',
      status: t.status || 'TODO',
      due_date: t.dueDate || 'Upcoming',
      action: t.status === 'IN_PROGRESS' ? 'Continue implementation' : 'Begin scheduled task',
      reason: t.priority === 'HIGH' ? 'High-priority blocker for active milestone' : 'Standard milestone deliverable'
    })),
    recommendation: {
      immediate_action: sortedTasks.find(t => t.status !== 'COMPLETED')?.title ? `Focus on completing: ${sortedTasks.find(t => t.status !== 'COMPLETED').title}` : 'Review upcoming milestone deliverables.',
      next_step: 'Submit the latest weekly progress report with verified faculty feedback.',
      reason: 'Regular progress tracking reduces risk escalation and maintains steady milestone progression.'
    },
    next_milestone: activeMilestone ? {
      milestone_number: activeMilestone.number || 1,
      title: activeMilestone.title,
      due_date: activeMilestone.dueDate || '',
      progress: activeMilestone.progress || 0,
      status: activeMilestone.status || 'IN_PROGRESS',
      focus: 'Complete active development deliverables on schedule.'
    } : null
  };
}

/**
 * Process AI Assistant chat message strictly returning validated JSON.
 */
async function processAssistantChat({ message, userRole = 'STUDENT', context = {}, chatHistory = [] }) {
  if (!message || !message.trim()) {
    return {
      success: false,
      error: 'Message is required.'
    };
  }

  // Extract structured project context if present
  let projectData = context?.project || (context?.title ? context : null);
  let deterministicRisk = null;
  if (projectData) {
    deterministicRisk = calculateProjectRisk(projectData);
  }

  // Handle unconfigured or offline state gracefully
  if (!isGroqConfigured()) {
    const fallbackData = buildDeterministicResponse(message, userRole, projectData);
    return {
      success: true,
      data: fallbackData,
      content: fallbackData
    };
  }

  const roleInstruction = {
    STUDENT: 'You are the ProjIntel Student Academic Project Assistant. Provide clean, actionable intelligence for academic projects.',
    FACULTY: 'You are the ProjIntel Faculty Advisory Assistant. Provide concise supervision intelligence, proposal reviews, and progress tracking.',
    ADMIN: 'You are the ProjIntel Institutional Admin Intelligence Assistant. Provide department-level workload, risk distribution, and project monitoring.'
  }[userRole] || 'You are the ProjIntel Academic Assistant.';

  const systemPrompt = `${roleInstruction}

CRITICAL OUTPUT REQUIREMENT:
You must respond with ONLY a single, valid JSON object.
Do NOT include Markdown formatting (no **, ##, bullet symbols, |tables|), no HTML tags (<br>, <div>), no code fences (\`\`\`json or \`\`\`), and no conversational text outside the JSON.

REQUIRED JSON SCHEMA:
{
  "response_type": "project_insight",
  "title": "Concise Descriptive Title",
  "summary": "1-3 concise plain-text sentences answering the user's question directly.",
  "observation": {
    "key_points": [
      "Key observational finding from the context"
    ],
    "status_overview": "Brief status overview statement",
    "blockers": []
  },
  "risk": {
    "level": "LOW" | "MEDIUM" | "HIGH",
    "reason": [
      "Explicit reason grounded strictly in project context"
    ]
  },
  "priority_tasks": [
    {
      "rank": 1,
      "task_id": "Exact task ID or title from context",
      "title": "Exact task title from context",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "status": "TODO" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE",
      "due_date": "YYYY-MM-DD or context deadline",
      "action": "Clear actionable verb phrase describing what to do",
      "reason": "Why this task is prioritized at this rank"
    }
  ],
  "recommendation": {
    "immediate_action": "Clear immediate action for the user",
    "next_step": "Next logical step following immediate action",
    "reason": "Rationale for this recommendation"
  },
  "next_milestone": {
    "milestone_number": 1,
    "title": "Milestone title from context",
    "due_date": "YYYY-MM-DD",
    "progress": 45,
    "status": "IN_PROGRESS",
    "focus": "Core focus deliverable"
  }
}

STRICT GROUNDING & CONTENT RULES:
1. Ground every statement strictly in the supplied CONTEXT.
2. NEVER invent fake task IDs, fake deadlines, fake progress percentages, priorities, milestones, or risk levels.
3. If tasks are requested ("What should I work on first?", "Which tasks are overdue or pending?"), prioritize real tasks from context and explain the exact rationale in priority_tasks.
4. If risk is queried ("Why is my project showing risk?"), articulate the calculated risk factors in risk.reason.
5. If milestones or tasks do not exist in the context, set "priority_tasks": [] or "next_milestone": null rather than hallucinating.
6. All strings inside JSON must contain pure plain text without any markdown or HTML tags.
7. COMPLETENESS GUARANTEE: Always output 100% complete, fully formed sentences and thoughts. Never cut off or truncate sentences mid-phrase (especially for feasibility assessments, domain evaluations, and recommendations). Keep descriptions clear, concise, and definitively concluded with a period.`;

  const contextPayload = {
    userRole,
    projectContext: projectData ? buildProjectContext(projectData) : context,
    deterministicRiskMetrics: deterministicRisk ? {
      calculatedScore: deterministicRisk.riskScore,
      calculatedLevel: deterministicRisk.riskLevel,
      calculatedFactors: deterministicRisk.riskFactors,
      indicators: deterministicRisk.indicators
    } : null
  };

  const contextMessage = `APPLICATION CONTEXT:\n${JSON.stringify(contextPayload, null, 2)}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextMessage }
  ];

  // Include recent history (ensure previous content sent as JSON or string)
  if (Array.isArray(chatHistory)) {
    const recent = chatHistory.slice(-4);
    for (const h of recent) {
      if (h.role && h.content) {
        const historyText = typeof h.content === 'object' ? JSON.stringify(h.content) : String(h.content);
        messages.push({ role: h.role, content: historyText });
      }
    }
  }

  // Current user prompt
  messages.push({ role: 'user', content: message.trim() });

  // 1. Initial Attempt (generous token limit prevents cutoffs)
  let result = await callGroqChat(messages, { jsonMode: true, temperature: 0.2, max_tokens: 3500 });

  let parsed = null;
  if (result.success && (result.data || result.content)) {
    parsed = parseAndValidateAiJson(result.data || result.content);
  }

  // 2. Retry Attempt if initial parsing / validation failed (Requirement 10)
  if (!parsed) {
    const retryInstruction = "Return ONLY valid JSON according to the required schema. No Markdown, HTML, code fences, or extra text.";
    const retryMessages = [
      ...messages,
      { role: 'assistant', content: result?.content || '' },
      { role: 'user', content: retryInstruction }
    ];

    const retryResult = await callGroqChat(retryMessages, { jsonMode: true, temperature: 0.1, max_tokens: 3500 });

    if (retryResult.success && (retryResult.data || retryResult.content)) {
      parsed = parseAndValidateAiJson(retryResult.data || retryResult.content);
    }
  }

  // 3. Final Verification (Requirement 11)
  if (!parsed) {
    // Return the specified error message if parsing still fails
    return {
      success: false,
      error: "Unable to format the AI response. Please try again."
    };
  }

  return {
    success: true,
    data: parsed,
    content: parsed
  };
}

module.exports = {
  processAssistantChat,
  parseAndValidateAiJson
};
