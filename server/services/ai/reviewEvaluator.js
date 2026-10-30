const { callGroqChat } = require('./groqClient');

const SYSTEM_PROMPT = `You are the ProjIntel Academic Review Evaluator & Project Review Assessor.
Your role is to assist faculty guides in objectively evaluating student project reviews and viva submissions.

CRITICAL RULES:
- This is an "AI Suggested Evaluation" advisory tool. Faculty guides have final authority to modify or override all marks.
- Assess deliverables strictly against the stated project domain, problem statement, objectives, and review criteria.
- Provide fair, calibrated marks based on technical depth, requirements alignment, and milestone readiness.
- Return structured rubric scores, clear strengths, constructive weaknesses, actionable feedback, and recommended viva questions.
- Always output valid, parseable JSON matching the requested schema.`;

/**
 * Generate an AI-assisted evaluation for a project review submission.
 */
async function evaluateReviewWithAI(reviewData, submissionData, projectData) {
  if (!reviewData || !submissionData) {
    return {
      success: false,
      error: 'Review and submission data are required for evaluation.'
    };
  }

  const maxMarks = reviewData.maxMarks || 50;
  const rubricCriteria = reviewData.rubricCriteria && reviewData.rubricCriteria.length > 0
    ? reviewData.rubricCriteria
    : [
        { name: 'Problem Definition & Requirement Rigor', maxScore: Math.round(maxMarks * 0.25) },
        { name: 'Architecture & System Design Depth', maxScore: Math.round(maxMarks * 0.30) },
        { name: 'Implementation & Prototype Progress', maxScore: Math.round(maxMarks * 0.25) },
        { name: 'Presentation, Documentation & Q&A Readiness', maxScore: maxMarks - (Math.round(maxMarks * 0.25) + Math.round(maxMarks * 0.30) + Math.round(maxMarks * 0.25)) }
      ];

  const evaluationContext = {
    review: {
      title: reviewData.title,
      reviewType: reviewData.reviewType,
      instructions: reviewData.instructions,
      maxMarks: maxMarks,
      scheduledDate: reviewData.scheduledDate,
      deadline: reviewData.deadline,
      rubricCriteria
    },
    submission: {
      fileName: submissionData.fileName,
      documentType: submissionData.documentType,
      fileSize: submissionData.fileSize,
      notes: submissionData.notes,
      submissionTime: submissionData.submissionTime,
      isLate: submissionData.status === 'LATE'
    },
    project: projectData ? {
      title: projectData.title,
      domain: projectData.domain,
      problemStatement: projectData.problemStatement,
      objectives: projectData.objectives,
      technologies: projectData.technologies,
      status: projectData.status,
      milestonesCount: projectData.milestones ? projectData.milestones.length : 6,
      completedMilestones: projectData.milestones ? projectData.milestones.filter(m => m.status === 'COMPLETED').length : 0
    } : null
  };

  const prompt = `Evaluate the following student project review submission:

EVALUATION CONTEXT:
${JSON.stringify(evaluationContext, null, 2)}

Provide an evaluation JSON object with EXACTLY the following structure:
{
  "suggestedMarks": 45,
  "maxMarks": ${maxMarks},
  "suggestedGrade": "A+",
  "rubricBreakdown": [
    ${rubricCriteria.map(rc => `{
      "criterion": "${rc.name}",
      "score": ${Math.round(rc.maxScore * 0.85)},
      "maxScore": ${rc.maxScore},
      "remarks": "Evaluation notes for this specific criterion"
    }`).join(',\n    ')}
  ],
  "strengths": [
    "Technical strength 1",
    "Technical strength 2",
    "Technical strength 3"
  ],
  "weaknesses": [
    "Constructive area for improvement 1",
    "Constructive area for improvement 2"
  ],
  "feedbackSummary": "A concise 3-sentence official evaluation feedback summary for the guide to share with the team.",
  "vivaQuestions": [
    "Suggested technical review question 1 for the guide to ask the team",
    "Suggested technical review question 2 for the guide to ask the team",
    "Suggested technical review question 3 for the guide to ask the team"
  ]
}`;

  return await callGroqChat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ], { jsonMode: true, temperature: 0.2 });
}

module.exports = {
  evaluateReviewWithAI
};
