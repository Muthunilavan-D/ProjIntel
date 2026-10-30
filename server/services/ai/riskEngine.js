/**
 * Deterministic Risk Engine for ProjIntel Academic Projects
 * Calculates numerical risk score, risk level, and measurable risk factors.
 * LLM is NOT used for deterministic calculations.
 */

function calculateProjectRisk(project) {
  if (!project) {
    return {
      riskScore: 0,
      riskLevel: 'LOW',
      riskFactors: ['No project data provided.'],
      indicators: {}
    };
  }

  let score = 20; // Base baseline score
  const factors = [];

  const milestones = project.milestones || [];
  const tasks = project.tasks || [];
  const weeklyUpdates = project.weeklyUpdates || [];

  // 1. Status Impact
  if (project.status === 'REVISION_REQUIRED') {
    score += 25;
    factors.push('Proposal revision currently requested by faculty');
  } else if (project.status === 'SUBMITTED' || project.status === 'UNDER_REVIEW') {
    score += 10;
    factors.push('Project proposal pending faculty review and assignment');
  }

  // 2. Milestone Analysis
  const completedMilestones = milestones.filter(m => m.status === 'COMPLETED' || (m.progress ?? m.completionPercentage ?? 0) === 100).length;
  const inProgressMilestones = milestones.filter(m => m.status === 'IN_PROGRESS' || ((m.progress ?? m.completionPercentage ?? 0) > 0 && (m.progress ?? m.completionPercentage ?? 0) < 100)).length;
  const totalMilestones = milestones.length || 6;
  const milestoneProgressAvg = milestones.reduce((acc, m) => acc + (m.progress ?? m.completionPercentage ?? 0), 0) / (milestones.length || 1);

  if (totalMilestones > 0 && completedMilestones === 0 && inProgressMilestones === 0) {
    score += 20;
    factors.push('No milestones have been started or completed yet');
  } else if (milestoneProgressAvg < 40 && milestones.length > 0) {
    score += 15;
    factors.push(`Average milestone progress is low (${Math.round(milestoneProgressAvg)}%)`);
  }

  // 3. Task Analysis
  const highPriorityTasks = tasks.filter(t => (String(t.priority).toUpperCase() === 'HIGH') && String(t.status).toUpperCase() !== 'COMPLETED');
  const todoTasks = tasks.filter(t => ['TODO', 'PENDING'].includes(String(t.status).toUpperCase()));
  const inProgressTasks = tasks.filter(t => ['IN_PROGRESS', 'IN PROGRESS'].includes(String(t.status).toUpperCase()));
  const completedTasks = tasks.filter(t => String(t.status).toUpperCase() === 'COMPLETED');

  if (highPriorityTasks.length > 0) {
    score += Math.min(25, highPriorityTasks.length * 10);
    factors.push(`${highPriorityTasks.length} high-priority task(s) awaiting completion`);
  }

  if (tasks.length > 0 && completedTasks.length === 0) {
    score += 10;
    factors.push('Zero tasks marked completed in active milestones');
  }

  // 4. Weekly Updates Analysis
  if (weeklyUpdates.length === 0 && project.status === 'APPROVED') {
    score += 15;
    factors.push('No weekly progress reports submitted yet');
  } else if (weeklyUpdates.length > 0) {
    const latestUpdate = weeklyUpdates[0];
    if (latestUpdate.problemsFaced && latestUpdate.problemsFaced.toLowerCase() !== 'none' && latestUpdate.problemsFaced.trim().length > 5) {
      score += 10;
      factors.push(`Active blocker reported in Week ${latestUpdate.weekNumber}: "${latestUpdate.problemsFaced.substring(0, 45)}..."`);
    }

    const scores = weeklyUpdates.filter(w => w.facultyScore !== null && w.facultyScore !== undefined).map(w => w.facultyScore);
    if (scores.length > 0) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avgScore < 70) {
        score += 20;
        factors.push(`Average faculty evaluation score is below threshold (${Math.round(avgScore)}/100)`);
      }
    }
  }

  // Bound score 0 to 100
  score = Math.min(100, Math.max(5, score));

  // Determine Level
  let riskLevel = 'LOW';
  if (score >= 65) {
    riskLevel = 'HIGH';
  } else if (score >= 35) {
    riskLevel = 'MEDIUM';
  }

  if (factors.length === 0) {
    factors.push('Milestones and tasks are progressing on schedule');
    factors.push('Weekly progress reports submitted consistently');
  }

  return {
    riskScore: score,
    riskLevel,
    riskFactors: factors,
    indicators: {
      completedMilestones,
      totalMilestones,
      milestoneProgressAvg: Math.round(milestoneProgressAvg),
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      pendingHighPriorityTasks: highPriorityTasks.length,
      weeklyUpdatesCount: weeklyUpdates.length,
    }
  };
}

module.exports = {
  calculateProjectRisk,
};
