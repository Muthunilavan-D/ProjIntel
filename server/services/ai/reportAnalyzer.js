const { callGroqChat } = require('./groqClient');
const { buildWeeklyReportContext } = require('./contextAdapters');

const SYSTEM_PROMPT = `You are the ProjIntel Weekly Progress Report & Blocker Analyst.
Analyze student weekly updates against project milestone expectations.
Rules:
- Base analysis ONLY on the provided report data and milestone context.
- Detect technical bottlenecks, missing specifications, or schedule risks.
- Provide constructive suggestions for clarity and next week's focus.
- Keep output concise, professional, and structured.`;

/**
 * Analyze a weekly progress report.
 */
async function analyzeWeeklyReport(reportData, projectData = null) {
  if (!reportData || !reportData.workCompleted) {
    return {
      success: false,
      error: 'Please fill in the work completed section to analyze the weekly report.'
    };
  }

  const context = buildWeeklyReportContext(reportData, projectData);

  const prompt = `Analyze this weekly progress update:
WEEKLY REPORT CONTEXT:
${JSON.stringify(context, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "summary": "Concise 2-sentence summary of the week's accomplishments",
  "detectedBlockers": [
    "Identified blocker or challenge 1"
  ],
  "potentialRisks": [
    "Potential schedule or technical risk 1"
  ],
  "clarityImprovements": "Suggestions to make the weekly progress entry clearer or more verifiable for faculty grading",
  "nextWeekSuggestions": [
    "Specific actionable recommendation for next week 1",
    "Specific actionable recommendation for next week 2"
  ],
  "suggestedFacultyAttention": "What the faculty guide should specifically check or advise during weekly review"
}`;

  return await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });
}

module.exports = {
  analyzeWeeklyReport
};
