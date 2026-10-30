const { callGroqChat } = require('./groqClient');
const { calculateProjectRisk } = require('./riskEngine');
const { buildProjectContext } = require('./contextAdapters');

const SYSTEM_PROMPT = `You are the ProjIntel Academic Risk Intelligence Assistant.
Your job is to explain the calculated deterministic risk score and factors for an academic engineering project.
Rules:
- Do NOT generate or change the numerical risk score or risk level.
- Explain clearly WHY the deterministic factors led to this risk level.
- Highlight specific items the students and faculty should review.
- Provide constructive, actionable recommendations.
- Keep the response concise, professional, and directly linked to the project data.
- If data is sparse, state "I don't have enough information to provide a reliable analysis."`;

/**
 * Explain project risk by combining deterministic risk metrics with LLM reasoning.
 */
async function explainProjectRisk(project) {
  if (!project) {
    return {
      success: false,
      error: 'No project data supplied for risk explanation.'
    };
  }

  // 1. Calculate deterministic numerical metrics
  const deterministicRisk = calculateProjectRisk(project);
  const projectContext = buildProjectContext(project);

  const prompt = `Explain the following project risk status:
DETERMINISTIC RISK METRICS:
- Risk Score: ${deterministicRisk.riskScore}/100
- Risk Level: ${deterministicRisk.riskLevel}
- Measurable Factors:
${deterministicRisk.riskFactors.map(f => `  • ${f}`).join('\n')}

PROJECT CONTEXT:
${JSON.stringify(projectContext, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "explanation": "2-3 sentences explaining why this risk level was assigned based strictly on the project status, milestones, tasks, and reports.",
  "recommendedAttention": "What the faculty guide and team should immediately review during their next sync.",
  "actionableSteps": [
    "Concrete student action step 1",
    "Concrete student action step 2"
  ]
}`;

  const aiResult = await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });

  return {
    success: true,
    riskScore: deterministicRisk.riskScore,
    riskLevel: deterministicRisk.riskLevel,
    riskFactors: deterministicRisk.riskFactors,
    indicators: deterministicRisk.indicators,
    aiExplanation: aiResult.success && aiResult.data ? aiResult.data.explanation : 'Project risk evaluated based on active milestones, task deadlines, and progress consistency.',
    recommendedAttention: aiResult.success && aiResult.data ? aiResult.data.recommendedAttention : 'Review current milestone blockers and overdue items with faculty guide.',
    actionableSteps: aiResult.success && aiResult.data ? aiResult.data.actionableSteps : ['Review pending high-priority tasks', 'Submit regular weekly progress updates']
  };
}

module.exports = {
  explainProjectRisk
};
