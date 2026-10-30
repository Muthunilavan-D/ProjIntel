const { callGroqChat } = require('./groqClient');

const SYSTEM_PROMPT = `You are the ProjIntel Academic Project Proposal & Feasibility Evaluator.
Analyze only the provided project proposal information.
Rules:
- Use ONLY the supplied proposal context.
- Do not invent facts, team members, or technological requirements.
- Distinguish observations from recommendations.
- Keep the output structured, objective, and advisory.
- Do not make final approval or rejection decisions.
- If insufficient information is available, explicitly state "I don't have enough information to provide a reliable analysis."`;

/**
 * Perform comprehensive proposal review.
 */
async function analyzeProposal(proposalContext) {
  if (!proposalContext || !proposalContext.title) {
    return {
      success: false,
      error: 'Insufficient proposal information provided for analysis.'
    };
  }

  const prompt = `Analyze this academic project proposal:
PROPOSAL CONTEXT:
${JSON.stringify(proposalContext, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "summary": "Brief 2-3 sentence overview of the project concept and intent",
  "problemDefinition": "Assessment of how clearly defined and relevant the stated problem is (e.g. Clearly defined / Needs clarification)",
  "scopeAnalysis": "Assessment of project scope (e.g. Well-bounded / Broad / Ambitious)",
  "technicalComplexity": "Technical complexity level (e.g. Low / Moderate / High)",
  "technologyCompatibility": "Evaluation of the chosen tech stack compatibility",
  "potentialConcerns": [
    "Specific technical or architectural concern 1",
    "Specific milestone or dependency concern 2"
  ],
  "recommendations": [
    "Actionable advisory recommendation for the faculty and student team 1",
    "Actionable advisory recommendation 2"
  ]
}`;

  return await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });
}

/**
 * Perform technical and timeline feasibility analysis.
 */
async function analyzeFeasibility(proposalContext) {
  if (!proposalContext || !proposalContext.title) {
    return {
      success: false,
      error: 'Insufficient proposal information provided for feasibility analysis.'
    };
  }

  const prompt = `Perform a rigorous academic feasibility evaluation for this project proposal:
PROPOSAL CONTEXT:
${JSON.stringify(proposalContext, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "technicalFeasibility": "High / Medium / Low with brief justification",
  "timelineFeasibility": "High / Medium / Low with brief justification based on a standard academic semester",
  "scopeComplexity": "Manageable / Moderate / High",
  "technologyCompatibility": "Compatible / Potential Integration Challenges / Flagged",
  "potentialRisks": [
    "Identified risk factor 1",
    "Identified risk factor 2"
  ],
  "recommendations": [
    "Advisory feasibility recommendation 1",
    "Advisory feasibility recommendation 2"
  ]
}`;

  return await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });
}

module.exports = {
  analyzeProposal,
  analyzeFeasibility
};
