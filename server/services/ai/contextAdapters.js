/**
 * Context Adapters for ProjIntel AI Services
 * Converts application state / mock data into clean, structured JSON context for Groq.
 * Avoids sending raw objects, unneeded fields, or sensitive system details.
 */

function buildProjectContext(project) {
  if (!project) return null;

  return {
    id: project.id || project._id,
    title: project.title,
    domain: project.domain,
    department: project.dept || project.department?.name || project.department,
    leadName: project.leadName || project.teamMembers?.[0]?.name || project.teamMembers?.[0] || 'Student Lead',
    teamMembers: project.teamMembers || project.members || [project.leadName],
    abstract: project.abstract,
    problemStatement: project.problemStatement,
    objectives: project.objectives,
    technologies: project.technologies,
    status: project.status,
    guideName: project.guideName || project.guide?.name || 'Unassigned',
    milestones: (project.milestones || []).map(m => ({
      number: m.number,
      title: m.title,
      status: m.status,
      progress: m.progress ?? m.completionPercentage ?? 0,
      dueDate: m.dueDate
    })),
    tasks: (project.tasks || []).map(t => ({
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      milestoneId: t.milestoneId || t.milestone
    })),
    documents: (project.documents || []).map(d => ({
      fileName: d.fileName || d.title || d.originalName,
      docType: d.docType || d.documentType,
      version: d.version || '1.0',
      uploadDate: d.uploadDate || d.createdAt
    })),
    recentWeeklyUpdates: (project.weeklyUpdates || []).slice(0, 3).map(w => ({
      weekNumber: w.weekNumber,
      workCompleted: w.workCompleted,
      problemsFaced: w.problemsFaced,
      nextWeekPlan: w.nextWeekPlan,
      facultyFeedback: w.facultyFeedback,
      facultyScore: w.facultyScore
    }))
  };
}

function buildProposalContext(project) {
  if (!project) return null;
  return {
    title: project.title,
    domain: project.domain,
    department: project.dept || project.department?.name || project.department,
    abstract: project.abstract,
    problemStatement: project.problemStatement,
    objectives: project.objectives,
    technologies: project.technologies,
    teamMembersCount: (project.teamMembers || project.members || [project.leadName]).length
  };
}

function buildWeeklyReportContext(report, project) {
  return {
    projectTitle: project?.title || 'Academic Project',
    weekNumber: report?.weekNumber || 1,
    workCompleted: report?.workCompleted || '',
    problemsFaced: report?.problemsFaced || 'None',
    nextWeekPlan: report?.nextWeekPlan || '',
    progressPct: report?.progressPct || report?.progressPercentage || 0,
    currentMilestones: (project?.milestones || []).filter(m => m.status === 'IN_PROGRESS' || (m.progress ?? m.completionPercentage ?? 0) > 0).map(m => m.title)
  };
}

function buildStudentContext(project) {
  return {
    userRole: 'STUDENT',
    project: buildProjectContext(project)
  };
}

function buildFacultyContext(projectsList = [], guideName = '', guideId = '') {
  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetName = clean(guideName);

  const assigned = projectsList.filter(p => {
    if (!guideName && !guideId) return true;
    const pGuideId = String(p.guideId || p.guide?._id || p.guide?.facultyId || p.guide || '').trim();
    if (guideId && pGuideId && pGuideId === String(guideId).trim()) return true;
    const pName = clean(p.guideName || p.guide?.name || '');
    if (targetName && pName && (targetName === pName || pName.includes(targetName) || targetName.includes(pName))) return true;
    return false;
  });

  return {
    userRole: 'FACULTY',
    guideName: guideName,
    assignedProjectsCount: assigned.length,
    projects: assigned.map(p => ({
      id: p.id || p._id,
      title: p.title,
      status: p.status,
      domain: p.domain,
      milestonesProgressAvg: p.milestones ? Math.round(p.milestones.reduce((a, m) => a + (m.progress ?? m.completionPercentage ?? 0), 0) / (p.milestones.length || 1)) : 0,
      tasksSummary: {
        total: p.tasks?.length || 0,
        completed: p.tasks?.filter(t => t.status === 'COMPLETED' || t.status === 'Completed').length || 0,
        pendingHighPriority: p.tasks?.filter(t => t.priority === 'HIGH' && t.status !== 'COMPLETED').length || 0
      },
      latestReport: p.weeklyUpdates?.[0] ? {
        weekNumber: p.weeklyUpdates[0].weekNumber,
        problemsFaced: p.weeklyUpdates[0].problemsFaced,
        score: p.weeklyUpdates[0].facultyScore
      } : null
    }))
  };
}

function buildAdminContext(projectsList = [], facultyList = []) {
  return {
    userRole: 'ADMIN',
    totalProjects: projectsList.length,
    statusBreakdown: {
      underReview: projectsList.filter(p => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW').length,
      approved: projectsList.filter(p => p.status === 'APPROVED' || p.status === 'IN_PROGRESS').length,
      revisionRequired: projectsList.filter(p => p.status === 'REVISION_REQUIRED').length,
      completed: projectsList.filter(p => p.status === 'COMPLETED').length
    },
    projects: projectsList.map(p => ({
      id: p.id,
      title: p.title,
      domain: p.domain,
      dept: p.dept,
      status: p.status,
      guideName: p.guideName || 'Unassigned',
      technologies: p.technologies
    })),
    facultyGuides: facultyList.map(f => ({
      id: f.id,
      name: f.name,
      dept: f.dept,
      activeProjects: f.activeProjects,
      maxProjects: f.maxProjects
    }))
  };
}

module.exports = {
  buildProjectContext,
  buildProposalContext,
  buildWeeklyReportContext,
  buildStudentContext,
  buildFacultyContext,
  buildAdminContext
};
