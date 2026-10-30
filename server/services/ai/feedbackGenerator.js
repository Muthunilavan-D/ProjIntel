const { callGroqChat } = require('./groqClient');

const SYSTEM_PROMPT = `You are the ProjIntel Academic Faculty Feedback Assistant.
Your task is to transform quick, informal faculty review notes into constructive, professional, and encouraging academic feedback for undergraduate engineering students.
Rules:
- Preserve the exact evaluation intent, praise, and critiques from the faculty's notes.
- Ensure the tone is encouraging, professional, academic, and actionable.
- Be concise (2 to 4 sentences).
- Do not invent project facts not mentioned in the notes or context.`;

/**
 * Generate refined academic feedback from faculty notes.
 */
async function generateFacultyFeedback(notes, context = {}) {
  if (!notes || !notes.trim()) {
    return {
      success: false,
      error: 'Please enter brief faculty notes or observations to generate feedback.'
    };
  }

  const prompt = `Convert the following faculty observations into polished academic student feedback:
FACULTY NOTES:
"${notes}"

CONTEXT:
${JSON.stringify({
  projectTitle: context.projectTitle || 'Academic Project',
  studentLead: context.studentLead || 'Team Lead',
  weekNumber: context.weekNumber,
  score: context.score
}, null, 2)}

Provide a JSON object with EXACTLY the following structure:
{
  "polishedFeedback": "The polished, constructive feedback paragraph.",
  "strengthsNoted": ["Brief point of strength"],
  "areasForImprovement": ["Brief improvement recommendation"]
}`;

  return await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.3 });
}

module.exports = {
  generateFacultyFeedback
};
