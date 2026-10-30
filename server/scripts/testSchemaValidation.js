const { parseAndValidateAiJson } = require('../services/ai/assistantService');

console.log('--- Testing Schema Validation & Sanitization ---');

// Test A: Clean JSON matching schema
const validSample = JSON.stringify({
  response_type: "project_insight",
  title: "Project Risk & Prioritization",
  summary: "Your project is progressing steadily with 3 of 5 milestones completed.",
  observation: {
    key_points: ["System design phase is active", "1 high priority task is pending"],
    status_overview: "On track for Milestone 4",
    blockers: ["Database schema decision pending"]
  },
  risk: {
    level: "MEDIUM",
    reason: ["1 high-priority task awaiting completion", "Active blocker in Week 1"]
  },
  priority_tasks: [
    {
      rank: 1,
      task_id: "t3",
      title: "Implement React Student Workspace UI",
      priority: "HIGH",
      status: "TODO",
      due_date: "Sep 25",
      action: "Create component layouts",
      reason: "Critical prerequisite for frontend testing"
    }
  ],
  recommendation: {
    immediate_action: "Complete MongoDB schema definition",
    next_step: "Implement REST API endpoints",
    reason: "Unblocks student workspace integration"
  },
  next_milestone: {
    milestone_number: 4,
    title: "System Design",
    due_date: "Sep 30",
    progress: 60,
    status: "IN_PROGRESS",
    focus: "Complete architecture diagrams and schema"
  }
});

const resultA = parseAndValidateAiJson(validSample);
console.log('Test A (Clean JSON):', resultA ? 'PASSED ✅' : 'FAILED ❌');
if (!resultA) process.exit(1);

// Test B: JSON wrapped in markdown fences and containing markdown artifacts
const messySample = `\`\`\`json
{
  "response_type": "project_insight",
  "title": "**Task Prioritization**",
  "summary": "Here is what you should focus on **first**.<br>All tasks are listed below.",
  "observation": {
    "key_points": ["• **SRS** documentation is underway", "- API setup"],
    "status_overview": "Active development",
    "blockers": []
  },
  "risk": {
    "level": "LOW",
    "reason": ["Milestones on track"]
  },
  "priority_tasks": [
    {
      "rank": 1,
      "task_id": "T1",
      "title": "Build **REST** endpoints",
      "priority": "HIGH",
      "status": "TODO",
      "due_date": "2026-09-30",
      "action": "Implement endpoints",
      "reason": "Foundational API layer"
    }
  ],
  "recommendation": {
    "immediate_action": "Finish Express routes",
    "next_step": "Test with Postman",
    "reason": "Verifies backend connectivity"
  },
  "next_milestone": {
    "milestone_number": 2,
    "title": "Backend Architecture",
    "due_date": "2026-10-15",
    "progress": 40,
    "status": "IN_PROGRESS",
    "focus": "Core services"
  }
}
\`\`\``;

const resultB = parseAndValidateAiJson(messySample);
console.log('Test B (Fenced JSON with Markdown & HTML):', resultB ? 'PASSED ✅' : 'FAILED ❌');
console.log('Cleaned Title:', JSON.stringify(resultB?.title));
console.log('Cleaned Summary:', JSON.stringify(resultB?.summary));
console.log('Cleaned Task Title:', JSON.stringify(resultB?.priority_tasks[0]?.title));

if (resultB?.title.includes('**') || resultB?.summary.includes('<br>') || resultB?.summary.includes('**')) {
  console.error('Sanitization failed to strip markdown/HTML!');
  process.exit(1);
}

// Test C: Invalid JSON (should return null to trigger retry)
const invalidSample = "Sorry, I cannot answer as JSON. Here is the answer: **Task 1**";
const resultC = parseAndValidateAiJson(invalidSample);
console.log('Test C (Invalid JSON returns null for retry):', resultC === null ? 'PASSED ✅' : 'FAILED ❌');
if (resultC !== null) process.exit(1);

console.log('\n=== All Schema Validation Tests Passed! ===');
