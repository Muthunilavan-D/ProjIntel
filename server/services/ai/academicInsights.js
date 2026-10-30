const { callGroqChat } = require('./groqClient');
const { calculateProjectRisk } = require('./riskEngine');

const SYSTEM_PROMPT = `You are the ProjIntel Institutional Project Intelligence Engine.
Generate high-level academic executive summaries for the Department Head and Academic Dean.
Rules:
- Use ONLY the provided project counts, risk metrics, and department data.
- Never invent metrics or project titles.
- Highlight common patterns, milestone roadblocks, and workload trends.
- Keep the narrative clear, concise, and academically authoritative.`;

/**
 * Generate department-level academic intelligence summary.
 */
async function generateAcademicInsights(projectsList = [], facultyList = []) {
  // 1. Deterministic risk breakdown across all projects
  const riskEvaluations = projectsList.map(p => ({
    id: p.id,
    title: p.title,
    dept: p.dept,
    status: p.status,
    guideName: p.guideName,
    risk: calculateProjectRisk(p)
  }));

  const totalProjects = projectsList.length;
  const lowRiskCount = riskEvaluations.filter(r => r.risk.riskLevel === 'LOW').length;
  const mediumRiskCount = riskEvaluations.filter(r => r.risk.riskLevel === 'MEDIUM').length;
  const highRiskCount = riskEvaluations.filter(r => r.risk.riskLevel === 'HIGH').length;
  const unassignedCount = projectsList.filter(p => !p.guideName || p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW').length;
  const revisionCount = projectsList.filter(p => p.status === 'REVISION_REQUIRED').length;

  const statsContext = {
    totalProjects,
    riskBreakdown: {
      low: lowRiskCount,
      medium: mediumRiskCount,
      high: highRiskCount
    },
    unassignedProjects: unassignedCount,
    revisionRequiredProjects: revisionCount,
    departments: [...new Set(projectsList.map(p => p.dept))],
    projectSummaries: riskEvaluations.map(r => ({
      id: r.id,
      title: r.title,
      dept: r.dept,
      status: r.status,
      riskLevel: r.risk.riskLevel,
      topFactors: r.risk.riskFactors.slice(0, 2)
    }))
  };

  const prompt = `Generate an executive academic insights report based on the following real project statistics:
INSTITUTIONAL STATISTICS:
${JSON.stringify(statsContext, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "executiveSummary": "A crisp, 3-4 sentence academic overview of institutional project progression, risk distribution, and review readiness.",
  "keyObservations": [
    "Observation regarding schedule compliance and risk distribution",
    "Observation regarding proposal review or revision queue",
    "Observation regarding milestone tracking"
  ],
  "actionableRecommendations": [
    "Recommended administrative priority 1",
    "Recommended administrative priority 2"
  ]
}`;

  const aiResult = await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });

  return {
    success: true,
    stats: {
      totalProjects,
      lowRisk: lowRiskCount,
      mediumRisk: mediumRiskCount,
      highRisk: highRiskCount,
      unassignedCount,
      revisionCount
    },
    aiInsights: aiResult.success && aiResult.data ? aiResult.data : {
      executiveSummary: `${totalProjects} projects tracked across departments with ${lowRiskCount} low risk, ${mediumRiskCount} medium risk, and ${highRiskCount} high risk projects.`,
      keyObservations: ['Milestone progression active across approved projects', 'Proposal review queue active'],
      actionableRecommendations: ['Ensure timely faculty assignment for submitted proposals', 'Review projects flagged with medium/high schedule risk']
    }
  };
}

module.exports = {
  generateAcademicInsights
};
