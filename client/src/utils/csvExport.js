/**
 * Institutional CSV Export Utility for Administrative Reports
 * Formats:
 * 1. Team & Mentor Allocation Report (4 cols: S.No, Project Name, Team Members [row per member], Guide Name)
 * 2. Final Report (3 cols: S.No, Project Name, Final Marks & Grade [if not completed then 'Nil'])
 * 3. Master Institutional Roster Report (Complete project details)
 */

// Helper to escape CSV cell content properly
function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Trigger browser download of CSV string with UTF-8 BOM for Excel compatibility
export function downloadCSVFile(csvContent, filename = 'academic_report.csv') {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return csvContent;
  }
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return csvContent;
}

/**
 * Filter projects by academic batch and department
 */
export function filterProjectsForExport(projects = [], { batchFilter = 'ALL', deptFilter = 'ALL' }) {
  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return (projects || []).filter(p => {
    // Batch filter
    if (batchFilter && batchFilter !== 'ALL' && batchFilter !== 'NONE') {
      const pBatch = clean(p.batch || '');
      const targetBatch = clean(batchFilter);
      if (pBatch !== targetBatch && !pBatch.includes(targetBatch) && !targetBatch.includes(pBatch)) return false;
    }

    // Department filter
    if (deptFilter && deptFilter !== 'ALL' && deptFilter !== 'NONE') {
      const pDept = String(p.department?.name || p.dept || (typeof p.department === 'string' ? p.department : '') || '').trim().toLowerCase();
      const pDeptCode = String(p.department?.code || '').trim().toLowerCase();
      const pDeptId = String(p.department?._id || p.department?.id || '').trim().toLowerCase();
      const targetDept = String(deptFilter).trim().toLowerCase();
      if (
        pDept !== targetDept && 
        pDeptCode !== targetDept && 
        pDeptId !== targetDept && 
        !pDept.includes(targetDept) && 
        !targetDept.includes(pDept)
      ) return false;
    }

    return true;
  });
}

/**
 * 1. Team & Mentor Report
 * 4 Columns:
 * - S.No (1 row per team)
 * - Project Name (1 row per team)
 * - Team Members (row based on team size)
 * - Guide Name (1 row per team)
 */
export function exportTeamAndMentorReportCSV({
  projects = [],
  batchFilter = 'ALL',
  deptFilter = 'ALL'
}) {
  const filtered = filterProjectsForExport(projects, { batchFilter, deptFilter });

  if (filtered.length === 0) {
    if (typeof alert !== 'undefined') alert('No projects match the selected Year / Batch and Department filter.');
    return false;
  }

  const headers = ['S.No', 'Project Name', 'Team Members', 'Guide Name'];
  const rows = [];

  filtered.forEach((p, index) => {
    const sNo = index + 1;
    const projectTitle = p.title || 'Untitled Project';
    const guideName = p.guideName || (typeof p.guide === 'object' ? p.guide?.name : p.guide) || 'Pending Assignment';

    // Extract all team members
    const members = [];
    const srcMembers = (Array.isArray(p.rawTeamMembers) && p.rawTeamMembers.length > 0)
      ? p.rawTeamMembers
      : (Array.isArray(p.teamMembers) && p.teamMembers.length > 0 ? p.teamMembers : []);
    if (srcMembers.length > 0) {
      srcMembers.forEach(m => {
        if (!m) return;
        if (typeof m === 'object') {
          const reg = m.regNo ? ` (${m.regNo})` : '';
          members.push(`${m.name || 'Student'}${reg}`);
        } else {
          members.push(String(m));
        }
      });
    } else {
      const lead = p.leadName || 'Student';
      const reg = p.regNo ? ` (${p.regNo})` : '';
      members.push(`${lead}${reg}`);
    }

    // Ensure at least one member row
    if (members.length === 0) {
      members.push('Pending Registration');
    }

    // First member row contains S.No, Project Name, Member 1, Guide Name
    rows.push([
      escapeCSV(sNo),
      escapeCSV(projectTitle),
      escapeCSV(members[0]),
      escapeCSV(guideName)
    ].join(','));

    // Remaining member rows: S.No, Project Name, and Guide Name are blank (row based on team size)
    for (let i = 1; i < members.length; i++) {
      rows.push([
        '""', // S.No blank
        '""', // Project Name blank
        escapeCSV(members[i]),
        '""'  // Guide Name blank
      ].join(','));
    }
  });

  const csvString = [headers.join(','), ...rows].join('\r\n');
  const safeDept = deptFilter === 'ALL' ? 'All_Depts' : deptFilter.replace(/[^a-zA-Z0-9]/g, '_');
  const safeBatch = batchFilter === 'ALL' ? 'All_Batches' : batchFilter.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Team_and_Mentor_Report_${safeDept}_${safeBatch}.csv`;
  downloadCSVFile(csvString, filename);
  return { success: true, csvString, filename };
}

/**
 * 2. Final Report
 * 3 Columns:
 * - S.No (1 row)
 * - Project Name (1 row)
 * - Final Marks and Grade (1 row) (if not completed then 'Nil')
 */
export function exportFinalReportCSV({
  projects = [],
  batchFilter = 'ALL',
  deptFilter = 'ALL'
}) {
  const filtered = filterProjectsForExport(projects, { batchFilter, deptFilter });

  if (filtered.length === 0) {
    if (typeof alert !== 'undefined') alert('No projects match the selected Year / Batch and Department filter.');
    return false;
  }

  const headers = ['S.No', 'Project Name', 'Final Marks and Grade'];
  const rows = [];

  filtered.forEach((p, index) => {
    const sNo = index + 1;
    const projectTitle = p.title || 'Untitled Project';
    const isCompleted = p.status === 'COMPLETED' || p.finalSignedByGuide === true;

    let marksAndGrade = 'Nil';
    if (isCompleted || p.finalScore !== null && p.finalScore !== undefined) {
      const score = p.finalScore !== null && p.finalScore !== undefined ? p.finalScore : null;
      const grade = p.finalGrade || null;

      if (score !== null && grade) {
        marksAndGrade = `${score} / 100 (Grade: ${grade})`;
      } else if (score !== null) {
        marksAndGrade = `${score} / 100`;
      } else if (grade) {
        marksAndGrade = `Grade: ${grade}`;
      } else {
        marksAndGrade = 'Completed (Pending Marks)';
      }
    }

    rows.push([
      escapeCSV(sNo),
      escapeCSV(projectTitle),
      escapeCSV(marksAndGrade)
    ].join(','));
  });

  const csvString = [headers.join(','), ...rows].join('\r\n');
  const safeDept = deptFilter === 'ALL' ? 'All_Depts' : deptFilter.replace(/[^a-zA-Z0-9]/g, '_');
  const safeBatch = batchFilter === 'ALL' ? 'All_Batches' : batchFilter.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Final_Marks_and_Grade_Report_${safeDept}_${safeBatch}.csv`;
  downloadCSVFile(csvString, filename);
  return { success: true, csvString, filename };
}

/**
 * 3. Master Institutional Roster Report (Complete Details)
 */
export function exportMasterProjectsReportCSV({
  projects = [],
  batchFilter = 'ALL',
  deptFilter = 'ALL'
}) {
  const filtered = filterProjectsForExport(projects, { batchFilter, deptFilter });

  if (filtered.length === 0) {
    if (typeof alert !== 'undefined') alert('No projects match the selected Year / Batch and Department filter.');
    return false;
  }

  const headers = [
    'S.No',
    'Project Code',
    'Project Name',
    'Domain',
    'Academic Batch',
    'Department',
    'Student Lead',
    'Lead Reg No',
    'Team Members',
    'Faculty Guide',
    'Milestone Progress (%)',
    'Project Status',
    'Final Marks',
    'Final Grade'
  ];

  const rows = filtered.map((p, index) => {
    const sNo = index + 1;
    const code = p.code || p.id || (p._id ? String(p._id).slice(-8).toUpperCase() : `PRJ-${sNo}`);
    const title = p.title || 'Untitled Project';
    const domain = p.domain || 'General Engineering';
    const batch = p.batch || '2023-2027';
    const dept = p.department?.name || p.dept || 'Computer Science & Engineering';
    const lead = p.leadName || 'Student';
    const regNo = p.regNo || '—';
    const members = Array.isArray(p.teamMembers) ? p.teamMembers.join('; ') : lead;
    const guide = p.guideName || (typeof p.guide === 'object' ? p.guide?.name : p.guide) || 'Pending Guide';
    const progress = p.status === 'COMPLETED' ? '100%' : `${p.progress || 0}%`;
    const status = p.status || 'IN_PROGRESS';
    const score = p.finalScore !== null && p.finalScore !== undefined ? p.finalScore : 'Nil';
    const grade = p.finalGrade || 'Nil';

    return [
      escapeCSV(sNo),
      escapeCSV(code),
      escapeCSV(title),
      escapeCSV(domain),
      escapeCSV(batch),
      escapeCSV(dept),
      escapeCSV(lead),
      escapeCSV(regNo),
      escapeCSV(members),
      escapeCSV(guide),
      escapeCSV(progress),
      escapeCSV(status),
      escapeCSV(score),
      escapeCSV(grade)
    ].join(',');
  });

  const csvString = [headers.join(','), ...rows].join('\r\n');
  const safeDept = deptFilter === 'ALL' ? 'All_Depts' : deptFilter.replace(/[^a-zA-Z0-9]/g, '_');
  const safeBatch = batchFilter === 'ALL' ? 'All_Batches' : batchFilter.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Institutional_Projects_Master_Roster_${safeDept}_${safeBatch}.csv`;
  downloadCSVFile(csvString, filename);
  return { success: true, csvString, filename };
}

/**
 * 4. IEEE Report
 * 7 Columns:
 * - S.No (1 row per team)
 * - Team member names (row as per team size)
 * - IEEE paper title (1 row per team)
 * - Name of IEEE conference (1 row per team)
 * - Submission status Y/N (1 row per team)
 * - Acceptance status Y/N (1 row per team)
 * - Publishment status Y/N (1 row per team)
 */
export function exportIEEEReportCSV({
  projects = [],
  batchFilter = 'ALL',
  deptFilter = 'ALL'
}) {
  const filtered = filterProjectsForExport(projects, { batchFilter, deptFilter });

  if (filtered.length === 0) {
    if (typeof alert !== 'undefined') alert('No projects match the selected Year / Batch and Department filter.');
    return false;
  }

  const headers = [
    'S.No',
    'Team member names',
    'IEEE paper title',
    'Name of IEEE conference',
    'Submission status (Y/N)',
    'Acceptance status (Y/N)',
    'Publishment status (Y/N)'
  ];
  const rows = [];

  filtered.forEach((p, index) => {
    const sNo = index + 1;
    const ieee = p.ieeeDetails || {};
    const paperTitle = ieee.paperTitle || 'Not Provided';
    const confName = ieee.conferenceName || 'Not Specified';
    const subStatus = ieee.isSubmitted ? 'Y' : 'N';
    const accStatus = ieee.isAccepted ? 'Y' : 'N';
    const pubStatus = ieee.isPublished ? 'Y' : 'N';

    // Extract all team members
    const members = [];
    const srcMembers = (Array.isArray(p.rawTeamMembers) && p.rawTeamMembers.length > 0)
      ? p.rawTeamMembers
      : (Array.isArray(p.teamMembers) && p.teamMembers.length > 0 ? p.teamMembers : []);
    if (srcMembers.length > 0) {
      srcMembers.forEach(m => {
        if (!m) return;
        if (typeof m === 'object') {
          const reg = m.regNo ? ` (${m.regNo})` : '';
          members.push(`${m.name || 'Student'}${reg}`);
        } else {
          members.push(String(m));
        }
      });
    } else {
      const lead = p.leadName || 'Student';
      const reg = p.regNo ? ` (${p.regNo})` : '';
      members.push(`${lead}${reg}`);
    }

    if (members.length === 0) {
      members.push('Pending Registration');
    }

    // Row 1: S.No, Member 1, Paper Title, Conference Name, Sub (Y/N), Acc (Y/N), Pub (Y/N)
    rows.push([
      escapeCSV(sNo),
      escapeCSV(members[0]),
      escapeCSV(paperTitle),
      escapeCSV(confName),
      escapeCSV(subStatus),
      escapeCSV(accStatus),
      escapeCSV(pubStatus)
    ].join(','));

    // Remaining members: only Team member names column is populated; other 6 columns blank
    for (let i = 1; i < members.length; i++) {
      rows.push([
        '""',
        escapeCSV(members[i]),
        '""',
        '""',
        '""',
        '""',
        '""'
      ].join(','));
    }
  });

  const csvString = [headers.join(','), ...rows].join('\r\n');
  const safeDept = deptFilter === 'ALL' ? 'All_Depts' : deptFilter.replace(/[^a-zA-Z0-9]/g, '_');
  const safeBatch = batchFilter === 'ALL' ? 'All_Batches' : batchFilter.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `IEEE_Publication_Status_Report_${safeDept}_${safeBatch}.csv`;
  downloadCSVFile(csvString, filename);
  return { success: true, csvString, filename };
}

