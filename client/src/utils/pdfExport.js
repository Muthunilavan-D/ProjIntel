/**
 * Institutional PDF Export Utility for Academic Project Weekly Progress Reports
 * Generates official, print-ready documents formatted to Anna University / VCET academic guidelines.
 * 
 * 1. exportWeeklyProgressReportPDF: Generates a single project's weekly progress report.
 * 2. exportFacultyCohortWeeklyDossierPDF: Generates the faculty mentor's supervised cohort cumulative dossier.
 */

// Helper to escape HTML characters
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Single Project Weekly Progress Logbook Export
 */
export function exportWeeklyProgressReportPDF({
  project,
  weeklyUpdates = [],
  currentUser = null,
  guideName = '',
  departmentName = '',
  academicYear = '2026-2027'
}) {
  if (!project) {
    alert('Project details not available for export.');
    return;
  }

  // De-duplicate updates by weekNumber: preserve the latest or reviewed submission for each week
  const rawUpdates = weeklyUpdates || project.weeklyUpdates || [];
  const weekMap = new Map();
  rawUpdates.forEach(u => {
    const wNum = Number(u.weekNumber) || 1;
    if (!weekMap.has(wNum)) {
      weekMap.set(wNum, u);
    } else {
      const existing = weekMap.get(wNum);
      const existingHasFb = Boolean(existing.facultyFeedback || existing.feedback || existing.status === 'GRADED');
      const uHasFb = Boolean(u.facultyFeedback || u.feedback || u.status === 'GRADED');
      // If current has feedback and existing didn't, replace with current
      if (uHasFb && !existingHasFb) {
        weekMap.set(wNum, u);
      } else if (new Date(u.createdAt || u.submissionDate || 0) > new Date(existing.createdAt || existing.submissionDate || 0)) {
        if (!existingHasFb || uHasFb) {
          weekMap.set(wNum, u);
        }
      }
    }
  });

  const updates = Array.from(weekMap.values()).sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));

  const projTitle = project.title || 'Academic Project';
  const projCode = project.code || project.id || (project._id ? String(project._id).slice(-8).toUpperCase() : 'PRJ-2026');
  const dept = departmentName || project.department?.name || project.dept || 'Computer Science & Engineering';
  const batch = project.batch || '2023 - 2027';
  const resolvedGuide = guideName || project.guideName || (typeof project.guide === 'object' ? project.guide?.name : project.guide) || 'Faculty Guide';
  const overallProgress = project.status === 'COMPLETED' ? 100 : (project.progress || 0);

  // Determine true Student Lead — never allow faculty guide to be listed as student lead!
  let leadName = project.leadName || '';
  let regNo = project.regNo || '';

  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isLeadGuide = clean(leadName) === clean(resolvedGuide);

  if (!leadName || isLeadGuide) {
    const firstMember = project.rawTeamMembers?.[0] || project.teamMembers?.[0];
    if (firstMember && typeof firstMember === 'object') {
      leadName = firstMember.name || 'Student Lead';
      regNo = firstMember.regNo || '';
    } else if (typeof firstMember === 'string') {
      leadName = firstMember;
    } else if (currentUser && currentUser.role === 'student') {
      leadName = currentUser.name || 'Student Lead';
      regNo = currentUser.regNo || '';
    } else {
      leadName = 'Student Lead';
    }
  }

  // Normalize team members list
  let teamMembersList = [];
  const sourceMembers = (Array.isArray(project.rawTeamMembers) && project.rawTeamMembers.length > 0)
    ? project.rawTeamMembers
    : (Array.isArray(project.teamMembers) && project.teamMembers.length > 0 ? project.teamMembers : []);

  if (sourceMembers.length > 0) {
    teamMembersList = sourceMembers.map(m => {
      if (typeof m === 'object' && m !== null) {
        return m.regNo ? `${m.name || 'Student'} (${m.regNo})` : (m.name || String(m));
      }
      return String(m);
    });
  } else {
    teamMembersList = [`${leadName} ${regNo ? `(${regNo})` : ''}`];
  }

  const printWindow = window.open('', '_blank', 'width=950,height=850,menubar=no,toolbar=no,location=no,status=no');
  if (!printWindow) {
    alert('Please allow popups for this site to export the Weekly Progress PDF summary.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Weekly Progress Report — ${escapeHTML(projTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 14mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10.5pt;
      line-height: 1.45;
    }
    .no-print-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 0.75rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: sans-serif;
    }
    .no-print-bar button {
      padding: 0.5rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-print {
      background: #4f46e5;
      color: #ffffff;
      margin-right: 0.5rem;
    }
    .btn-print:hover {
      background: #4338ca;
    }
    .btn-close {
      background: #334155;
      color: #e2e8f0;
    }
    .btn-close:hover {
      background: #475569;
    }
    .report-container {
      max-width: 820px;
      margin: 0 auto;
      padding: 1.5rem 1.5rem 3rem 1.5rem;
    }
    .institutional-header {
      text-align: center;
      border-bottom: 2.5px solid #1e3a8a;
      padding-bottom: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .institution-name {
      font-size: 15pt;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .institution-sub {
      font-size: 8.5pt;
      color: #4b5563;
      margin: 2px 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .department-name {
      font-size: 11pt;
      font-weight: 700;
      color: #111827;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    .document-title {
      display: inline-block;
      background: #1e3a8a;
      color: #ffffff;
      font-size: 10.5pt;
      font-weight: 700;
      padding: 3px 14px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      margin-top: 6px;
      text-transform: uppercase;
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem 1rem;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0.85rem 1rem;
      margin-bottom: 1.25rem;
      font-size: 9.5pt;
    }
    .metadata-item {
      display: flex;
      flex-direction: column;
    }
    .metadata-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .metadata-value {
      font-size: 9.5pt;
      color: #0f172a;
      font-weight: 600;
      margin-top: 1px;
    }
    .section-heading {
      font-size: 11pt;
      font-weight: 700;
      color: #1e3a8a;
      border-left: 4px solid #1e3a8a;
      padding-left: 0.5rem;
      margin: 1.25rem 0 0.75rem 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    table.logbook-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 1.5rem;
    }
    table.logbook-table th, table.logbook-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    table.logbook-table th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table.logbook-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    table.logbook-table tr {
      page-break-inside: avoid;
    }
    .week-badge {
      font-weight: 800;
      color: #1e3a8a;
      white-space: nowrap;
    }
    .progress-pill {
      display: inline-block;
      font-weight: 700;
      font-size: 8.5pt;
      color: #047857;
      background: #ecfdf5;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #a7f3d0;
      white-space: nowrap;
    }
    .status-badge-reviewed {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      color: #065f46;
      background: #d1fae5;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .status-badge-pending {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      color: #92400e;
      background: #fef3c7;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .feedback-box {
      font-style: italic;
      color: #334155;
      background: #f8fafc;
      padding: 6px 10px;
      border-left: 3px solid #3b82f6;
      border-radius: 3px;
      margin-top: 3px;
      line-height: 1.4;
    }
    .signatures-block {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1.5rem;
      margin-top: 3rem;
      page-break-inside: avoid;
    }
    .signature-slot {
      text-align: center;
      border-top: 1.5px dashed #64748b;
      padding-top: 0.5rem;
      font-size: 8.5pt;
      color: #334155;
    }
    .signature-title {
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      font-size: 8pt;
    }
    .official-watermark {
      font-size: 8pt;
      color: #94a3b8;
      text-align: center;
      margin-top: 2rem;
      border-top: 1px solid #e2e8f0;
      padding-top: 0.5rem;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
      .report-container {
        padding: 0;
        max-width: 100%;
      }
      body {
        font-size: 9.5pt;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong style="font-size: 0.95rem;">Official Academic Progress Report</strong>
      <span style="font-size: 0.8rem; color: #94a3b8; margin-left: 0.75rem;">${escapeHTML(projTitle)}</span>
    </div>
    <div>
      <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
      <button class="btn-close" onclick="window.close()">Close Preview</button>
    </div>
  </div>

  <div class="report-container">
    <div class="institutional-header">
      <h1 class="institution-name">Velammal College of Engineering & Technology</h1>
      <div class="institution-sub">(Autonomous Institution • Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai)</div>
      <div class="department-name">Department of ${escapeHTML(dept)}</div>
      <div class="document-title">Cumulative Weekly Progress Logbook & Review Summary</div>
    </div>

    <div class="metadata-grid">
      <div class="metadata-item" style="grid-column: span 2;">
        <span class="metadata-label">Project Title</span>
        <span class="metadata-value" style="font-size: 11pt; color: #1e3a8a;">${escapeHTML(projTitle)}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Project Code / Reference ID</span>
        <span class="metadata-value">${escapeHTML(projCode)}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Academic Year / Semester</span>
        <span class="metadata-value">${escapeHTML(academicYear)} • Final Year B.E. (Semester VIII)</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Student Team Lead</span>
        <span class="metadata-value">${escapeHTML(leadName)} ${regNo ? `(${escapeHTML(regNo)})` : ''}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Batch & Department</span>
        <span class="metadata-value">${escapeHTML(batch)} • ${escapeHTML(dept)}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Faculty Project Guide</span>
        <span class="metadata-value">${escapeHTML(resolvedGuide)}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Overall Completion Status</span>
        <span class="metadata-value">${overallProgress}% Completed • ${escapeHTML(project.status || 'IN_PROGRESS')}</span>
      </div>
      <div class="metadata-item" style="grid-column: span 2;">
        <span class="metadata-label">Team Members</span>
        <span class="metadata-value">${escapeHTML(teamMembersList.join(' • '))}</span>
      </div>
    </div>

    <div class="section-heading">Detailed Weekly Progress Logbook</div>

    ${updates.length === 0 ? `
      <div style="padding: 2.5rem; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 9pt;">
        No weekly progress updates have been submitted for this project yet.
      </div>
    ` : `
      <table class="logbook-table">
        <thead>
          <tr>
            <th style="width: 12%;">Week / Date</th>
            <th style="width: 10%;">Progress</th>
            <th style="width: 33%;">Work Completed</th>
            <th style="width: 20%;">Challenges & Next Plan</th>
            <th style="width: 25%;">Faculty Guide Feedback</th>
          </tr>
        </thead>
        <tbody>
          ${updates.map(u => {
            const hasFeedback = Boolean(u.facultyFeedback || u.feedback || u.status === 'GRADED');
            const feedbackText = u.facultyFeedback || u.feedback || 'Pending guide review';
            const dateStr = u.date || (u.submissionDate ? new Date(u.submissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent');
            return `
              <tr>
                <td>
                  <div class="week-badge">Week #${u.weekNumber || 1}</div>
                  <div style="font-size: 7.5pt; color: #64748b; margin-top: 2px;">${escapeHTML(dateStr)}</div>
                  <div style="margin-top: 4px;">
                    ${hasFeedback 
                      ? `<span class="status-badge-reviewed">Reviewed</span>` 
                      : `<span class="status-badge-pending">Under Review</span>`}
                  </div>
                </td>
                <td>
                  <span class="progress-pill">${u.progressPct ?? u.progressPercentage ?? 0}%</span>
                </td>
                <td>
                  <div style="font-weight: 600; color: #1e293b;">${escapeHTML(u.workCompleted || 'Progress update recorded.').replace(/\n/g, '<br/>')}</div>
                </td>
                <td>
                  ${u.problemsFaced && u.problemsFaced !== 'None' ? `
                    <div style="margin-bottom: 4px;">
                      <strong style="font-size: 7.5pt; color: #b45309; text-transform: uppercase;">Roadblock:</strong>
                      <div style="font-size: 8pt; color: #4b5563;">${escapeHTML(u.problemsFaced)}</div>
                    </div>
                  ` : ''}
                  ${u.nextWeekPlan ? `
                    <div>
                      <strong style="font-size: 7.5pt; color: #1e3a8a; text-transform: uppercase;">Next Plan:</strong>
                      <div style="font-size: 8pt; color: #4b5563;">${escapeHTML(u.nextWeekPlan)}</div>
                    </div>
                  ` : '<span style="color: #94a3b8; font-size: 8pt;">—</span>'}
                </td>
                <td>
                  ${hasFeedback ? `
                    <div class="feedback-box">"${escapeHTML(feedbackText)}"</div>
                  ` : `
                    <div style="color: #94a3b8; font-style: italic; font-size: 8pt;">Awaiting review from guide</div>
                  `}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `}

    <div class="signatures-block">
      <div class="signature-slot">
        <div class="signature-title">Student Team Lead</div>
        <div style="margin-top: 3px; font-weight: 600;">${escapeHTML(leadName)}</div>
        <div style="font-size: 7.5pt; color: #64748b;">Signature & Date</div>
      </div>
      <div class="signature-slot">
        <div class="signature-title">Faculty Project Guide</div>
        <div style="margin-top: 3px; font-weight: 600;">${escapeHTML(resolvedGuide)}</div>
        <div style="font-size: 7.5pt; color: #64748b;">Signature & Date</div>
      </div>
      <div class="signature-slot">
        <div class="signature-title">Project Coordinator / HOD</div>
        <div style="margin-top: 3px; font-weight: 600;">Department of ${escapeHTML(dept)}</div>
        <div style="font-size: 7.5pt; color: #64748b;">Signature & Date</div>
      </div>
    </div>

    <div class="official-watermark">
      PROJINTEL Academic Project Management System • Velammal College of Engineering and Technology (Autonomous) • Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Faculty Mentor Supervised Cohort Cumulative Progress Dossier Export
 * Correctly formats multi-project supervision without fake student leads or jumbled reports.
 */
export function exportFacultyCohortWeeklyDossierPDF({
  assignedProjects = [],
  currentUser = null,
  currentGuideName = '',
  departmentName = '',
  academicYear = '2026-2027',
  batch = '2023 - 2027'
}) {
  if (!assignedProjects || assignedProjects.length === 0) {
    alert('No supervised projects found to export.');
    return;
  }

  const guide = currentGuideName || currentUser?.name || 'Faculty Project Guide';
  const staffId = currentUser?.facultyId || currentUser?.staffId || '';
  const dept = departmentName || currentUser?.department?.name || 'Computer Science & Engineering';

  const totalProjects = assignedProjects.length;
  const avgProgress = Math.round(
    assignedProjects.reduce((sum, p) => sum + (p.status === 'COMPLETED' ? 100 : (p.progress || 0)), 0) / (totalProjects || 1)
  );

  const printWindow = window.open('', '_blank', 'width=1000,height=900,menubar=no,toolbar=no,location=no,status=no');
  if (!printWindow) {
    alert('Please allow popups for this site to export the Supervised Projects Dossier PDF.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Faculty Mentorship Dossier — ${escapeHTML(guide)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 14mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10pt;
      line-height: 1.45;
    }
    .no-print-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 0.75rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: sans-serif;
    }
    .no-print-bar button {
      padding: 0.5rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-print {
      background: #4f46e5;
      color: #ffffff;
      margin-right: 0.5rem;
    }
    .btn-print:hover {
      background: #4338ca;
    }
    .btn-close {
      background: #334155;
      color: #e2e8f0;
    }
    .btn-close:hover {
      background: #475569;
    }
    .report-container {
      max-width: 860px;
      margin: 0 auto;
      padding: 1.5rem 1.5rem 3rem 1.5rem;
    }
    .institutional-header {
      text-align: center;
      border-bottom: 2.5px solid #1e3a8a;
      padding-bottom: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .institution-name {
      font-size: 15pt;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .institution-sub {
      font-size: 8.5pt;
      color: #4b5563;
      margin: 2px 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .department-name {
      font-size: 11pt;
      font-weight: 700;
      color: #111827;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    .document-title {
      display: inline-block;
      background: #1e3a8a;
      color: #ffffff;
      font-size: 10pt;
      font-weight: 700;
      padding: 3px 14px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      margin-top: 6px;
      text-transform: uppercase;
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem 1rem;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0.85rem 1rem;
      margin-bottom: 1.5rem;
      font-size: 9.5pt;
    }
    .metadata-item {
      display: flex;
      flex-direction: column;
    }
    .metadata-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .metadata-value {
      font-size: 9.5pt;
      color: #0f172a;
      font-weight: 600;
      margin-top: 1px;
    }
    .section-heading {
      font-size: 11pt;
      font-weight: 700;
      color: #1e3a8a;
      border-left: 4px solid #1e3a8a;
      padding-left: 0.5rem;
      margin: 1.5rem 0 0.75rem 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    table.roster-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 1.75rem;
    }
    table.roster-table th, table.roster-table td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
      text-align: left;
      vertical-align: middle;
    }
    table.roster-table th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table.roster-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .project-section-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      page-break-inside: avoid;
    }
    .project-header-box {
      background: #f1f5f9;
      border-radius: 4px;
      padding: 0.6rem 0.85rem;
      margin-bottom: 0.75rem;
      border-left: 4px solid #4f46e5;
    }
    .project-title-text {
      font-size: 10.5pt;
      font-weight: 800;
      color: #1e293b;
      margin: 0 0 2px 0;
    }
    .project-meta-line {
      font-size: 8pt;
      color: #475569;
    }
    table.logbook-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-top: 0.5rem;
    }
    table.logbook-table th, table.logbook-table td {
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    table.logbook-table th {
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
      font-size: 7.5pt;
      text-transform: uppercase;
    }
    .week-badge {
      font-weight: 800;
      color: #1e3a8a;
      white-space: nowrap;
    }
    .progress-pill {
      display: inline-block;
      font-weight: 700;
      font-size: 8pt;
      color: #047857;
      background: #ecfdf5;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid #a7f3d0;
      white-space: nowrap;
    }
    .feedback-box {
      font-style: italic;
      color: #334155;
      background: #f8fafc;
      padding: 4px 8px;
      border-left: 2px solid #3b82f6;
      border-radius: 2px;
      margin-top: 2px;
      line-height: 1.35;
    }
    .signatures-block {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1.5rem;
      margin-top: 3rem;
      page-break-inside: avoid;
    }
    .signature-slot {
      text-align: center;
      border-top: 1.5px dashed #64748b;
      padding-top: 0.5rem;
      font-size: 8.5pt;
      color: #334155;
    }
    .signature-title {
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      font-size: 8pt;
    }
    .official-watermark {
      font-size: 8pt;
      color: #94a3b8;
      text-align: center;
      margin-top: 2rem;
      border-top: 1px solid #e2e8f0;
      padding-top: 0.5rem;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
      .report-container {
        padding: 0;
        max-width: 100%;
      }
      body {
        font-size: 9pt;
      }
      .project-section-card {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong style="font-size: 0.95rem;">Supervised Cohort Progress Dossier</strong>
      <span style="font-size: 0.8rem; color: #94a3b8; margin-left: 0.75rem;">${escapeHTML(guide)} • ${totalProjects} Projects</span>
    </div>
    <div>
      <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
      <button class="btn-close" onclick="window.close()">Close Preview</button>
    </div>
  </div>

  <div class="report-container">
    <div class="institutional-header">
      <h1 class="institution-name">Velammal College of Engineering & Technology</h1>
      <div class="institution-sub">(Autonomous Institution • Approved by AICTE, New Delhi • Affiliated to Anna University, Chennai)</div>
      <div class="department-name">Department of ${escapeHTML(dept)}</div>
      <div class="document-title">Faculty Mentorship & Supervised Cohort Cumulative Progress Dossier</div>
    </div>

    <div class="metadata-grid">
      <div class="metadata-item">
        <span class="metadata-label">Faculty Project Guide / Mentor</span>
        <span class="metadata-value" style="font-size: 10.5pt; color: #1e3a8a;">${escapeHTML(guide)} ${staffId ? `(${escapeHTML(staffId)})` : ''}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Department</span>
        <span class="metadata-value">${escapeHTML(dept)}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Academic Year / Cycle</span>
        <span class="metadata-value">${escapeHTML(academicYear)} • Final Year B.E. (Semester VIII)</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Supervised Cohort Batch</span>
        <span class="metadata-value">${escapeHTML(batch)}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Total Assigned Projects</span>
        <span class="metadata-value">${totalProjects} Teams</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Cohort Average Milestone Progress</span>
        <span class="metadata-value">${avgProgress}% Completed</span>
      </div>
    </div>

    <div class="section-heading">Executive Supervised Projects Roster</div>
    <table class="roster-table">
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 32%;">Project Title</th>
          <th style="width: 22%;">Student Lead</th>
          <th style="width: 25%;">Team Members</th>
          <th style="width: 8%;">Progress</th>
          <th style="width: 8%;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${assignedProjects.map((p, idx) => {
          const lead = p.leadName || p.teamMembers?.[0]?.name || 'Student Lead';
          const reg = p.regNo || p.teamMembers?.[0]?.regNo || '';
          const members = Array.isArray(p.teamMembers) ? p.teamMembers.map(m => typeof m === 'object' ? (m.name || String(m)) : String(m)).join(', ') : lead;
          const prog = p.status === 'COMPLETED' ? 100 : (p.progress || 0);

          return `
            <tr>
              <td style="font-weight: 700; text-align: center;">${idx + 1}</td>
              <td style="font-weight: 600; color: #1e293b;">${escapeHTML(p.title || 'Untitled Project')}</td>
              <td>${escapeHTML(lead)} ${reg ? `<span style="font-size: 7.5pt; color: #64748b;">(${escapeHTML(reg)})</span>` : ''}</td>
              <td style="font-size: 8pt; color: #475569;">${escapeHTML(members)}</td>
              <td><span class="progress-pill">${prog}%</span></td>
              <td style="font-size: 8pt; font-weight: 700; text-transform: uppercase;">${escapeHTML(p.status || 'ACTIVE')}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <div class="section-heading">Detailed Weekly Progress Logbooks (By Project)</div>

    ${assignedProjects.map((p, idx) => {
      const rawUpdates = p.weeklyUpdates || [];
      const weekMap = new Map();
      rawUpdates.forEach(u => {
        const wNum = Number(u.weekNumber) || 1;
        if (!weekMap.has(wNum)) {
          weekMap.set(wNum, u);
        } else {
          const existing = weekMap.get(wNum);
          const existingHasFb = Boolean(existing.facultyFeedback || existing.feedback || existing.status === 'GRADED');
          const uHasFb = Boolean(u.facultyFeedback || u.feedback || u.status === 'GRADED');
          if (uHasFb && !existingHasFb) {
            weekMap.set(wNum, u);
          } else if (new Date(u.createdAt || 0) > new Date(existing.createdAt || 0)) {
            if (!existingHasFb || uHasFb) weekMap.set(wNum, u);
          }
        }
      });
      const projUpdates = Array.from(weekMap.values()).sort((a, b) => (Number(a.weekNumber) || 0) - (Number(b.weekNumber) || 0));
      const lead = p.leadName || p.teamMembers?.[0]?.name || 'Student Lead';
      const reg = p.regNo || p.teamMembers?.[0]?.regNo || '';
      const members = Array.isArray(p.teamMembers) ? p.teamMembers.map(m => typeof m === 'object' ? (m.name || String(m)) : String(m)).join(', ') : lead;

      return `
        <div class="project-section-card">
          <div class="project-header-box">
            <div class="project-title-text">${idx + 1}. ${escapeHTML(p.title || 'Untitled Project')}</div>
            <div class="project-meta-line">
              <strong>Student Lead:</strong> ${escapeHTML(lead)} ${reg ? `(${escapeHTML(reg)})` : ''} &nbsp;|&nbsp;
              <strong>Members:</strong> ${escapeHTML(members)} &nbsp;|&nbsp;
              <strong>Progress:</strong> ${p.status === 'COMPLETED' ? 100 : (p.progress || 0)}% &nbsp;|&nbsp;
              <strong>Status:</strong> ${escapeHTML(p.status || 'ACTIVE')}
            </div>
          </div>

          ${projUpdates.length === 0 ? `
            <div style="font-size: 8pt; color: #94a3b8; font-style: italic; padding: 0.5rem 0;">
              No weekly progress updates submitted yet for this project.
            </div>
          ` : `
            <table class="logbook-table">
              <thead>
                <tr>
                  <th style="width: 12%;">Week / Date</th>
                  <th style="width: 10%;">Progress</th>
                  <th style="width: 32%;">Work Completed</th>
                  <th style="width: 20%;">Challenges & Next Plan</th>
                  <th style="width: 26%;">Faculty Feedback</th>
                </tr>
              </thead>
              <tbody>
                ${projUpdates.map(u => {
                  const hasFb = Boolean(u.facultyFeedback || u.feedback || u.status === 'GRADED');
                  const fbText = u.facultyFeedback || u.feedback || 'Pending guide review';
                  const dStr = u.date || (u.submissionDate ? new Date(u.submissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent');
                  return `
                    <tr>
                      <td>
                        <div class="week-badge">Week #${u.weekNumber || 1}</div>
                        <div style="font-size: 7.5pt; color: #64748b;">${escapeHTML(dStr)}</div>
                      </td>
                      <td>
                        <span class="progress-pill">${u.progressPct ?? u.progressPercentage ?? 0}%</span>
                      </td>
                      <td>
                        <div style="font-weight: 600; color: #1e293b;">${escapeHTML(u.workCompleted || 'Progress update recorded.').replace(/\n/g, '<br/>')}</div>
                      </td>
                      <td>
                        ${u.problemsFaced && u.problemsFaced !== 'None' ? `
                          <div style="font-size: 7.5pt; color: #b45309; font-weight: 700;">ROADBLOCK:</div>
                          <div style="font-size: 7.5pt; color: #475569; margin-bottom: 2px;">${escapeHTML(u.problemsFaced)}</div>
                        ` : ''}
                        ${u.nextWeekPlan ? `
                          <div style="font-size: 7.5pt; color: #1e3a8a; font-weight: 700;">NEXT PLAN:</div>
                          <div style="font-size: 7.5pt; color: #475569;">${escapeHTML(u.nextWeekPlan)}</div>
                        ` : ''}
                      </td>
                      <td>
                        ${hasFb ? `
                          <div class="feedback-box">"${escapeHTML(fbText)}"</div>
                        ` : `
                          <div style="color: #94a3b8; font-style: italic; font-size: 7.5pt;">Awaiting review from guide</div>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;
    }).join('')}

    <div class="signatures-block">
      <div class="signature-slot">
        <div class="signature-title">Faculty Project Guide</div>
        <div style="margin-top: 3px; font-weight: 600;">${escapeHTML(guide)}</div>
        <div style="font-size: 7.5pt; color: #64748b;">Signature & Date</div>
      </div>
      <div class="signature-slot">
        <div class="signature-title">Project Coordinator</div>
        <div style="margin-top: 3px; font-weight: 600;">Department of ${escapeHTML(dept)}</div>
        <div style="font-size: 7.5pt; color: #64748b;">Signature & Date</div>
      </div>
      <div class="signature-slot">
        <div class="signature-title">Head of the Department</div>
        <div style="margin-top: 3px; font-weight: 600;">Department of ${escapeHTML(dept)}</div>
        <div style="font-size: 7.5pt; color: #64748b;">Signature & Date</div>
      </div>
    </div>

    <div class="official-watermark">
      PROJINTEL Academic Project Management System • Velammal College of Engineering and Technology (Autonomous) • Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
