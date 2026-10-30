import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ProjIntelSpinner from './ProjIntelSpinner';
import { 
  Shield, 
  Users, 
  UserCheck, 
  CheckCircle2, 
  Clock, 
  Building, 
  RefreshCw, 
  Calendar, 
  Award, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Filter, 
  AlertTriangle, 
  X, 
  GraduationCap, 
  Layers, 
  FileText,
  UserPlus,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Download,
  ChevronDown,
  FileSpreadsheet
} from 'lucide-react';
import { 
  exportTeamAndMentorReportCSV, 
  exportFinalReportCSV, 
  exportMasterProjectsReportCSV,
  exportIEEEReportCSV,
  filterProjectsForExport
} from '../utils/csvExport';
import { 
  getStudents, 
  getFaculty, 
  getDepartments,
  createStudent,
  updateStudent,
  deleteStudent,
  createFaculty,
  updateFaculty,
  deleteFaculty
} from '../services/userService';

export const FACULTY_DESIGNATIONS = [
  'Professor & Head',
  'Professor',
  'Associate Professor',
  'Assistant Professor I',
  'Assistant Professor II',
  'Assistant Professor III'
];

const AdminDashboard = ({ 
  projectsList = [], 
  reviewsList = [],
  departmentsList = [],
  systemSettings = null,
  onUpdateSystemSettings,
  onAssignGuide,
  onScheduleReview,
  onUpdateReview,
  onDeleteReview,
  onCreateStudent,
  onUpdateStudent,
  onDeleteStudent,
  onCreateFaculty,
  onUpdateFaculty,
  onDeleteFaculty,
  onRefreshAllData
}) => {
  // Navigation tabs: strictly essential institutional management tabs
  const [activeTab, setActiveTab] = useState('allocation'); // 'allocation' | 'projects' | 'students' | 'faculty' | 'reviews'

  // Global & Local State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  // System Settings & Academic Year
  const currentAcademicYear = systemSettings?.currentAcademicYear || '2026-2027';

  // Departments List (dynamic with fallback)
  const [departments, setDepartments] = useState(departmentsList);

  // Live Students & Faculty Lists
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);

  // Helper to dynamically calculate Year of Study from student batch and current academic year
  const calculateYearOfStudy = (batchStr, acadYearStr = currentAcademicYear) => {
    if (!batchStr || !batchStr.includes('-')) return 4;
    const batchStart = parseInt(batchStr.split('-')[0], 10);
    const acadStart = parseInt((acadYearStr || '2026-2027').split('-')[0], 10);
    if (isNaN(batchStart) || isNaN(acadStart)) return 4;
    const calc = (acadStart - batchStart) + 1;
    if (calc > 4) return 4; // Undergraduate curriculum caps at Year 4; graduated cohorts are handled separately
    return Math.max(1, calc);
  };

  const isStudentGraduated = (student, acadYearStr = currentAcademicYear) => {
    if (student.isPassedOut === true || student.academicStatus === 'PASSED_OUT') return true;
    if (student.yearOfStudy && student.yearOfStudy > 4) return true;
    const batchStr = student.batch || '2023-2027';
    const parts = batchStr.split('-');
    const batchEnd = parseInt(parts[1], 10);
    const acadStart = parseInt((acadYearStr || '2026-2027').split('-')[0], 10);
    if (!isNaN(batchEnd) && !isNaN(acadStart) && acadStart >= batchEnd) return true;
    return false;
  };

  // Dynamic active undergraduate cohorts for the current academic year (Strictly 4 current batches: Year 4 down to Year 1)
  const activeBatchesList = useMemo(() => {
    const aStart = parseInt((currentAcademicYear || '2026-2027').split('-')[0], 10);
    if (!isNaN(aStart)) {
      return [
        `${aStart - 3}-${aStart + 1}`, // Year 4 (Senior)
        `${aStart - 2}-${aStart + 2}`, // Year 3 (Junior)
        `${aStart - 1}-${aStart + 3}`, // Year 2 (Sophomore)
        `${aStart}-${aStart + 4}`       // Year 1 (Freshman)
      ];
    }
    return ['2023-2027', '2024-2028', '2025-2029', '2026-2030'];
  }, [currentAcademicYear]);

  // Dynamic graduated batches discovered from students, projects, and reviews (omitted from active cohorts)
  const graduatedBatchesList = useMemo(() => {
    const discovered = new Set();
    (students || []).forEach(s => {
      if (s?.batch && !activeBatchesList.includes(s.batch)) discovered.add(s.batch);
    });
    (projectsList || []).forEach(p => {
      if (p?.batch && !activeBatchesList.includes(p.batch)) discovered.add(p.batch);
    });
    (reviewsList || []).forEach(r => {
      if (r?.batch && !activeBatchesList.includes(r.batch)) discovered.add(r.batch);
    });
    // Ensure the immediately graduated batch is recognized
    const aStart = parseInt((currentAcademicYear || '2026-2027').split('-')[0], 10);
    if (!isNaN(aStart)) {
      discovered.add(`${aStart - 4}-${aStart}`);
    }
    return Array.from(discovered).sort((a, b) => {
      const aYr = parseInt(a.split('-')[0], 10) || 0;
      const bYr = parseInt(b.split('-')[0], 10) || 0;
      return bYr - aYr;
    });
  }, [students, projectsList, reviewsList, activeBatchesList, currentAcademicYear]);

  // Stepper calculations: bound strictly by current calendar year (e.g. In 2026: 2025-2026 and 2026-2027)
  const calYear = new Date().getFullYear();
  const minAllowedAcademicYear = `${calYear - 1}-${calYear}`;
  const maxAllowedAcademicYear = `${calYear}-${calYear + 1}`;
  const currentStartYear = parseInt((currentAcademicYear || '2026-2027').split('-')[0], 10) || calYear;

  const canDecrementYear = currentAcademicYear !== minAllowedAcademicYear;
  const decrementedAcademicYear = `${currentStartYear - 1}-${currentStartYear}`;

  const canIncrementYear = currentAcademicYear !== maxAllowedAcademicYear;
  const incrementedAcademicYear = `${currentStartYear + 1}-${currentStartYear + 2}`;

  // Transition Confirmation Modal State
  const [yearTransitionModal, setYearTransitionModal] = useState({
    isOpen: false,
    targetYear: '',
    transitionType: 'INCREMENT' // 'INCREMENT' | 'DECREMENT'
  });
  const [isTransitioningYear, setIsTransitioningYear] = useState(false);

  const handleOpenYearTransition = (targetYear, transitionType) => {
    setYearTransitionModal({
      isOpen: true,
      targetYear,
      transitionType
    });
  };

  const handleConfirmYearTransition = async () => {
    if (!yearTransitionModal.targetYear) return;
    setIsTransitioningYear(true);
    try {
      const newYear = yearTransitionModal.targetYear;
      const aStart = parseInt(newYear.split('-')[0], 10);
      const newBatches = !isNaN(aStart) ? [
        `${aStart - 3}-${aStart + 1}`,
        `${aStart - 2}-${aStart + 2}`,
        `${aStart - 1}-${aStart + 3}`,
        `${aStart}-${aStart + 4}`
      ] : ['2023-2027', '2024-2028', '2025-2029', '2026-2030'];

      if (onUpdateSystemSettings) {
        await onUpdateSystemSettings({ currentAcademicYear: newYear, availableBatches: newBatches });
      }
      setProjectAcademicYearFilter(newYear);
      await handleSyncEverything();
      setYearTransitionModal({ isOpen: false, targetYear: '', transitionType: 'INCREMENT' });
    } catch (err) {
      console.error('Failed to transition academic year:', err);
      alert(`Error updating academic year: ${err.message}`);
    } finally {
      setIsTransitioningYear(false);
    }
  };

  // Reusable batch filter options helper for all 4 admin sections (supports initial NONE value)
  const renderBatchFilterOptions = (includeNone = true) => (
    <>
      {includeNone && <option value="NONE">— None (Select Batch) —</option>}
      <option value="ALL">All Batches</option>
      <optgroup label={`Active Batches (${currentAcademicYear})`}>
        {activeBatchesList.map(b => (
          <option key={b} value={b}>
            Batch {b.replace('-', ' - ')} (Year {calculateYearOfStudy(b)})
          </option>
        ))}
      </optgroup>
      {graduatedBatchesList.length > 0 && (
        <optgroup label="Graduated Batches">
          <option value="GRADUATED">🎓 All Graduated Batches</option>
          {graduatedBatchesList.map(b => (
            <option key={b} value={b}>
              🎓 Batch {b.replace('-', ' - ')} (Graduated)
            </option>
          ))}
        </optgroup>
      )}
    </>
  );

  // Filters & Searches across all sections (initialized to 'NONE' per institutional workflow)
  const [allocationBatchFilter, setAllocationBatchFilter] = useState('NONE');
  const [allocationDeptFilter, setAllocationDeptFilter] = useState('NONE');
  const [allocationSearchQuery, setAllocationSearchQuery] = useState('');

  const [projectBatchFilter, setProjectBatchFilter] = useState('NONE');
  const [projectStatusFilter, setProjectStatusFilter] = useState('NONE');
  const [projectDeptFilter, setProjectDeptFilter] = useState('NONE');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectAcademicYearFilter, setProjectAcademicYearFilter] = useState(currentAcademicYear || '2026-2027');

  useEffect(() => {
    if (currentAcademicYear) {
      setProjectAcademicYearFilter(currentAcademicYear);
    }
  }, [currentAcademicYear]);

  const [studentBatchFilter, setStudentBatchFilter] = useState('NONE');
  const [studentDeptFilter, setStudentDeptFilter] = useState('NONE');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  const [facultyDeptFilter, setFacultyDeptFilter] = useState('NONE');
  const [facultyAvailabilityFilter, setFacultyAvailabilityFilter] = useState('NONE');
  const [facultySearchQuery, setFacultySearchQuery] = useState('');

  const [reviewBatchFilter, setReviewBatchFilter] = useState('NONE');
  const [reviewDeptFilter, setReviewDeptFilter] = useState('NONE');

  // Persistent memory for last added student batch & department to accelerate bulk enrollment
  const [lastAddedStudentBatch, setLastAddedStudentBatch] = useState(() => {
    try {
      return localStorage.getItem('admin_last_student_batch') || '';
    } catch {
      return '';
    }
  });
  const [lastAddedStudentDept, setLastAddedStudentDept] = useState(() => {
    try {
      return localStorage.getItem('admin_last_student_dept') || '';
    } catch {
      return '';
    }
  });

  // Modals State
  const [assignGuideModalProject, setAssignGuideModalProject] = useState(null);
  const [selectedGuideForAssign, setSelectedGuideForAssign] = useState(null);
  const [isAssigningGuide, setIsAssigningGuide] = useState(false);
  const [dossierProject, setDossierProject] = useState(null);

  // CSV Export State for Institutional Reports
  const [isCsvDropdownOpen, setIsCsvDropdownOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [selectedCsvReportType, setSelectedCsvReportType] = useState('TEAM_MENTOR'); // 'TEAM_MENTOR' | 'FINAL_REPORT' | 'MASTER_ROSTER'
  const [csvBatchFilter, setCsvBatchFilter] = useState('ALL');
  const [csvDeptFilter, setCsvDeptFilter] = useState('ALL');

  const handleOpenCsvModal = (reportType) => {
    setSelectedCsvReportType(reportType);
    setIsCsvDropdownOpen(false);
    setCsvBatchFilter(projectBatchFilter !== 'NONE' ? projectBatchFilter : 'ALL');
    setCsvDeptFilter(projectDeptFilter !== 'NONE' ? projectDeptFilter : 'ALL');
    setIsCsvModalOpen(true);
  };

  const handleExecuteCsvExport = () => {
    const options = {
      projects: projectsList,
      batchFilter: csvBatchFilter,
      deptFilter: csvDeptFilter
    };

    let success = false;
    if (selectedCsvReportType === 'TEAM_MENTOR') {
      success = exportTeamAndMentorReportCSV(options);
    } else if (selectedCsvReportType === 'FINAL_REPORT') {
      success = exportFinalReportCSV(options);
    } else if (selectedCsvReportType === 'MASTER_ROSTER') {
      success = exportMasterProjectsReportCSV(options);
    } else if (selectedCsvReportType === 'IEEE_REPORT') {
      success = exportIEEEReportCSV(options);
    }

    if (success) {
      setIsCsvModalOpen(false);
    }
  };

  const csvMatchingProjectsCount = useMemo(() => {
    return filterProjectsForExport(projectsList, { batchFilter: csvBatchFilter, deptFilter: csvDeptFilter }).length;
  }, [projectsList, csvBatchFilter, csvDeptFilter]);

  // Student Modals
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [editStudentData, setEditStudentData] = useState(null);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    regNo: '',
    email: '',
    password: '',
    department: '',
    batch: '',
    yearOfStudy: 4
  });

  // Faculty Modals
  const [isAddFacultyOpen, setIsAddFacultyOpen] = useState(false);
  const [editFacultyData, setEditFacultyData] = useState(null);
  const [showFacultyPassword, setShowFacultyPassword] = useState(false);
  const [facultyFormData, setFacultyFormData] = useState({
    name: '',
    facultyId: '',
    email: '',
    password: 'Password@123',
    department: '',
    designation: 'Assistant Professor I',
    maxProjects: 2
  });

  // Review Modals
  const [isScheduleReviewOpen, setIsScheduleReviewOpen] = useState(false);
  const [rescheduleReviewData, setRescheduleReviewData] = useState(null);
  const [reviewFormData, setReviewFormData] = useState({
    title: '',
    reviewType: 'REVIEW_1',
    department: '',
    yearOfStudy: '',
    batch: '',
    scheduledDate: '',
    deadline: '',
    venue: '',
    maxMarks: '',
    instructions: ''
  });

  // Generic Delete Confirmation Modal
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { type: 'student'|'faculty'|'review', id, title, prompt }

  // Fetch departments if not passed
  const loadDepartments = async () => {
    try {
      const res = await getDepartments();
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setDepartments(res.data);
      }
    } catch (err) {
      console.warn('Departments fetch fallback:', err);
    }
  };

  // Fetch Students
  const loadStudents = async () => {
    setIsLoadingStudents(true);
    try {
      const res = await getStudents();
      if (res && res.success && Array.isArray(res.data)) {
        setStudents(res.data);
      }
    } catch (err) {
      console.warn('Failed to load students:', err);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // Fetch Faculty
  const loadFaculty = async () => {
    setIsLoadingFaculty(true);
    try {
      const res = await getFaculty();
      if (res && res.success && Array.isArray(res.data)) {
        setFaculty(res.data);
      }
    } catch (err) {
      console.warn('Failed to load faculty:', err);
    } finally {
      setIsLoadingFaculty(false);
    }
  };

  // Initial Data Load
  useEffect(() => {
    loadDepartments();
    loadStudents();
    loadFaculty();
  }, []);

  // Update departments if prop changes
  useEffect(() => {
    if (departmentsList && departmentsList.length > 0) {
      setDepartments(departmentsList);
    }
  }, [departmentsList]);

  // Synchronize all data
  const handleSyncEverything = async () => {
    setIsSyncing(true);
    try {
      if (onRefreshAllData) await onRefreshAllData();
      await Promise.all([loadDepartments(), loadStudents(), loadFaculty()]);
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate faculty active supervision count dynamically for current academic year
  const getFacultyActiveCount = useCallback((f) => {
    if (!f) return 0;
    const fId = String(f._id || f.id || f.facultyId || '').trim();
    const fName = (f.name || '').toLowerCase().trim();

    return projectsList.filter(p => {
      const pYear = p.academicYear || currentAcademicYear;
      if (pYear !== currentAcademicYear) return false;
      if (p.status === 'REJECTED') return false;

      const hasMembers = (Array.isArray(p.rawTeamMembers) && p.rawTeamMembers.length > 0) ||
                         (Array.isArray(p.teamMembers) && p.teamMembers.length > 0);
      if (!hasMembers) return false;

      const pGuideId = String(p.guideId || p.guide?._id || p.guide?.facultyId || '').trim();
      const pGuideName = (p.guideName || p.guide?.name || '').toLowerCase().trim();
      return (fId && (pGuideId === fId || String(p.guide) === fId)) || (fName && pGuideName === fName);
    }).length;
  }, [projectsList, currentAcademicYear]);

  // Resilient multi-attribute helper to determine whether a student belongs to a project (as lead or confirmed team member)
  const isStudentInProject = useCallback((student, p) => {
    if (!student || !p) return false;
    const sId = String(student._id || student.id || '').trim();
    const sReg = String(student.regNo || '').trim().toLowerCase();
    const sEmail = String(student.email || '').trim().toLowerCase();
    const sName = String(student.name || '').trim().toLowerCase();
    const sProjId = String(student.project?._id || student.project?.id || (typeof student.project === 'string' ? student.project : '') || student.projectId || '').trim();

    // 1. Direct Project ID linkage
    if (sProjId && (String(p._id || p.id) === sProjId)) return true;

    // 2. Project Lead identification match
    if (sId && p.leadStudentId && String(p.leadStudentId).trim() === sId) return true;
    if (sReg && p.leadRegNo && String(p.leadRegNo).trim().toLowerCase() === sReg) return true;
    if (sReg && p.regNo && String(p.regNo).trim().toLowerCase() === sReg) return true;
    if (sEmail && p.leadEmail && String(p.leadEmail).trim().toLowerCase() === sEmail) return true;
    if (sName && p.leadName && String(p.leadName).trim().toLowerCase() === sName) return true;

    // 3. Member matching helper handling both Object and String representations
    const matchesMember = (m) => {
      if (!m) return false;
      if (typeof m === 'string') {
        const mStr = m.trim().toLowerCase();
        return (sId && m === sId) ||
               (sReg && mStr === sReg) ||
               (sEmail && mStr === sEmail) ||
               (sName && mStr === sName);
      }
      const mId = String(m._id || m.id || m.student?._id || m.student?.id || '').trim();
      const mReg = String(m.regNo || m.student?.regNo || '').trim().toLowerCase();
      const mEmail = String(m.email || m.student?.email || '').trim().toLowerCase();
      const mName = String(m.name || m.student?.name || '').trim().toLowerCase();

      return (sId && mId && mId === sId) ||
             (sReg && mReg && mReg === sReg) ||
             (sEmail && mEmail && mEmail === sEmail) ||
             (sName && mName && mName === sName);
    };

    if (Array.isArray(p.rawTeamMembers) && p.rawTeamMembers.some(matchesMember)) return true;
    if (Array.isArray(p.teamMembers) && p.teamMembers.some(matchesMember)) return true;
    if (Array.isArray(p.members) && p.members.some(matchesMember)) return true;

    return false;
  }, []);

  // Helper to match student project (current academic year first, fallback to completed for graduated students)
  const getStudentProject = useCallback((student) => {
    if (!student) return null;

    // 1. Current academic year active project in projectsList
    const currentProj = projectsList.find(p => {
      const pYear = p.academicYear || currentAcademicYear;
      if (pYear !== currentAcademicYear) return false;
      return isStudentInProject(student, p);
    });
    if (currentProj) return currentProj;

    // 2. Direct project match in projectsList (by ID or membership, including graduated cohorts)
    const matchedProj = projectsList.find(p => isStudentInProject(student, p));
    if (matchedProj) return matchedProj;

    // 3. Resilient fallback if student.project is populated directly on student from backend
    if (student.project && typeof student.project === 'object' && student.project.title) {
      return {
        ...student.project,
        _id: student.project._id || student.project.id,
        id: student.project._id || student.project.id,
        title: student.project.title,
        status: student.project.status || 'APPROVED',
        domain: student.project.domain || 'Computer Science & Engineering',
        batch: student.project.batch || student.batch,
        academicYear: student.project.academicYear || currentAcademicYear
      };
    }

    return null;
  }, [projectsList, currentAcademicYear, isStudentInProject]);

  // Helper to format year of study in Roman numerals (e.g. IV, III, II, I)
  const getRomanYear = (yr) => {
    const num = Number(yr);
    if (num === 1) return 'I';
    if (num === 2) return 'II';
    if (num === 3) return 'III';
    return 'IV';
  };

  // Institutional status badge renderer ensuring complete sync across student, faculty, and admin
  const renderProjectStatusBadge = (proj, isCompact = false) => {
    if (!proj) return null;
    const status = proj.status || 'SUBMITTED';
    const isApproved = ['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(status);
    const isInProgress = status === 'IN_PROGRESS';
    const isCompleted = status === 'COMPLETED';
    const isRevision = status === 'REVISION_REQUIRED';
    const isRejected = status === 'REJECTED';
    const isDraft = status === 'DRAFT';

    if (isCompleted) {
      return (
        <span className="project-status-badge status-completed" style={{ fontSize: isCompact ? '0.65rem' : '0.725rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
          <CheckCircle2 size={isCompact ? 11 : 13} style={{ color: 'var(--success)' }} />
          <span>Completed</span>
        </span>
      );
    }

    if (isInProgress) {
      return (
        <div>
          <span className="project-status-badge status-completed" style={{ fontSize: isCompact ? '0.65rem' : '0.725rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }} title="Proposal officially approved by faculty mentor">
            <CheckCircle2 size={isCompact ? 11 : 13} style={{ color: 'var(--success)' }} />
            <span>Approved</span>
          </span>
          <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '0.2rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            In Progress ({proj.progress || 0}%)
          </div>
        </div>
      );
    }

    if (isApproved) {
      return (
        <span className="project-status-badge status-completed" style={{ fontSize: isCompact ? '0.65rem' : '0.725rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
          <CheckCircle2 size={isCompact ? 11 : 13} style={{ color: 'var(--success)' }} />
          <span>Approved</span>
        </span>
      );
    }

    if (isRevision) {
      return (
        <span className="project-status-badge status-revision" style={{ fontSize: isCompact ? '0.65rem' : '0.725rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <AlertTriangle size={isCompact ? 11 : 13} style={{ color: '#EF4444' }} />
          <span>Revision Required</span>
        </span>
      );
    }

    if (isRejected) {
      return (
        <span className="project-status-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: isCompact ? '0.65rem' : '0.725rem' }}>
          Rejected
        </span>
      );
    }

    if (isDraft) {
      return (
        <span className="project-status-badge" style={{ background: 'rgba(156, 163, 175, 0.15)', color: '#9CA3AF', border: '1px solid rgba(156, 163, 175, 0.3)', fontSize: isCompact ? '0.65rem' : '0.725rem' }}>
          Draft
        </span>
      );
    }

    return (
      <span className="project-status-badge status-under-review" style={{ fontSize: isCompact ? '0.65rem' : '0.725rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <Clock size={isCompact ? 11 : 13} className="status-text-loading" />
        <span>Pending Approval</span>
      </span>
    );
  };

  // ==========================================
  // GUIDE ASSIGNMENT LOGIC
  // ==========================================
  const handleOpenAssignGuide = (project) => {
    setAssignGuideModalProject(project);
    // Find if already assigned
    const currentGuide = faculty.find(f => {
      const gId = String(project.guide?._id || project.guide?.id || project.guide || project.guideId || '');
      return gId && (String(f._id) === gId || String(f.facultyId) === gId);
    });
    setSelectedGuideForAssign(currentGuide || null);
  };

  const handleConfirmGuideAssignment = async () => {
    if (!assignGuideModalProject || !selectedGuideForAssign) return;
    setIsAssigningGuide(true);
    try {
      const pId = assignGuideModalProject._id || assignGuideModalProject.id;
      if (onAssignGuide) {
        await onAssignGuide(pId, selectedGuideForAssign.name, selectedGuideForAssign._id || selectedGuideForAssign.facultyId);
      }
      setAssignGuideModalProject(null);
      setSelectedGuideForAssign(null);
      await handleSyncEverything();
    } catch (err) {
      alert(err.message || 'Failed to assign faculty guide.');
    } finally {
      setIsAssigningGuide(false);
    }
  };

  // ==========================================
  // STUDENT CRUD LOGIC
  // ==========================================
  const handleOpenAddStudent = () => {
    // If lastAddedStudentBatch is valid in current active cohorts, reuse it; otherwise activeBatchesList[0]
    const defaultBatch = (lastAddedStudentBatch && activeBatchesList.includes(lastAddedStudentBatch))
      ? lastAddedStudentBatch
      : (activeBatchesList[0] || '2023-2027');

    // If lastAddedStudentDept is valid in departments list, reuse it; otherwise first department
    const defaultDept = (lastAddedStudentDept && departments.some(d => (d._id === lastAddedStudentDept || d.name === lastAddedStudentDept)))
      ? lastAddedStudentDept
      : (departments[0]?._id || departments[0]?.name || '');

    setStudentFormData({
      name: '',
      regNo: '',
      email: '',
      password: '',
      department: defaultDept,
      batch: defaultBatch,
      yearOfStudy: calculateYearOfStudy(defaultBatch)
    });
    setEditStudentData(null);
    setShowStudentPassword(false);
    setIsAddStudentOpen(true);
  };

  const handleOpenEditStudent = (student) => {
    setEditStudentData(student);
    const sBatch = student.batch || activeBatchesList[0] || '2023-2027';
    setStudentFormData({
      name: student.name || '',
      regNo: student.regNo || '',
      email: student.email || '',
      password: '',
      department: student.department?._id || student.department?.name || student.department || '',
      batch: sBatch,
      yearOfStudy: student.yearOfStudy || calculateYearOfStudy(sBatch)
    });
    setShowStudentPassword(false);
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    const cleanReg = studentFormData.regNo ? studentFormData.regNo.trim() : '';
    const cleanEmail = studentFormData.email ? studentFormData.email.trim().toLowerCase() : '';
    if (!studentFormData.name.trim() || !cleanReg || !cleanEmail) {
      alert('Name, register number, and email are mandatory.');
      return;
    }

    const activeFallback = activeBatchesList[0] || '2023-2027';
    const chosenBatch = studentFormData.batch || activeFallback;
    const calculatedYear = calculateYearOfStudy(chosenBatch);

    try {
      const payload = {
        ...studentFormData,
        name: studentFormData.name.trim(),
        regNo: cleanReg,
        email: cleanEmail,
        batch: chosenBatch,
        yearOfStudy: calculatedYear,
        password: studentFormData.password.trim() || (editStudentData ? undefined : cleanReg)
      };

      if (editStudentData) {
        if (onUpdateStudent) {
          await onUpdateStudent(editStudentData._id || editStudentData.id, payload);
        } else {
          await updateStudent(editStudentData._id || editStudentData.id, payload);
        }
        setEditStudentData(null);
      } else {
        if (onCreateStudent) {
          await onCreateStudent(payload);
        } else {
          await createStudent(payload);
        }
        // Save valid batch & department to state and localStorage for rapid bulk entry
        setLastAddedStudentBatch(chosenBatch);
        setLastAddedStudentDept(studentFormData.department);
        try {
          localStorage.setItem('admin_last_student_batch', chosenBatch);
          localStorage.setItem('admin_last_student_dept', studentFormData.department);
        } catch {}
        setIsAddStudentOpen(false);
      }
      await loadStudents();
    } catch (err) {
      alert(err.message || 'Operation failed.');
    }
  };

  // ==========================================
  // FACULTY CRUD LOGIC
  // ==========================================
  const handleOpenAddFaculty = () => {
    const defaultDept = departments[0]?._id || departments[0]?.name || '';
    setFacultyFormData({
      name: '',
      facultyId: '',
      email: '',
      password: 'Password@123',
      department: defaultDept,
      designation: 'Assistant Professor I',
      maxProjects: 2
    });
    setShowFacultyPassword(false);
    setIsAddFacultyOpen(true);
  };

  const handleOpenEditFaculty = (fac) => {
    setEditFacultyData(fac);
    setFacultyFormData({
      name: fac.name || '',
      facultyId: fac.facultyId || fac.staffId || '',
      email: fac.email || '',
      password: '',
      department: fac.department?._id || fac.department?.name || fac.department || '',
      designation: fac.designation || 'Assistant Professor I',
      maxProjects: fac.maxProjects || 2
    });
    setShowFacultyPassword(false);
  };

  const handleSaveFaculty = async (e) => {
    e.preventDefault();
    const cleanId = (facultyFormData.facultyId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const cleanEmail = (facultyFormData.email || '').toLowerCase().trim();
    if (!facultyFormData.name.trim() || !cleanId || !cleanEmail) {
      alert('Name, uppercase alphanumeric faculty ID (up to 8 characters), and email are mandatory.');
      return;
    }

    try {
      const payload = {
        ...facultyFormData,
        name: facultyFormData.name.trim(),
        facultyId: cleanId,
        email: cleanEmail,
        maxProjects: Number(facultyFormData.maxProjects) || 2,
        password: facultyFormData.password.trim() || (editFacultyData ? undefined : 'Password@123')
      };

      if (editFacultyData) {
        if (onUpdateFaculty) {
          await onUpdateFaculty(editFacultyData._id || editFacultyData.id, payload);
        } else {
          await updateFaculty(editFacultyData._id || editFacultyData.id, payload);
        }
        setEditFacultyData(null);
      } else {
        if (onCreateFaculty) {
          await onCreateFaculty(payload);
        } else {
          await createFaculty(payload);
        }
        setIsAddFacultyOpen(false);
      }
      await loadFaculty();
    } catch (err) {
      alert(err.message || 'Operation failed.');
    }
  };

  // ==========================================
  // REVIEW SCHEDULING & RESCHEDULING LOGIC
  // ==========================================
  const formatDateToLocalInput = (dateObj) => {
    if (!dateObj) return '';
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getOneDayPrior = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return '';
    const [year, month, day] = parts.map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  };

  const getMinScheduledDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Earliest review is tomorrow so submission deadline (1 day prior) is at least today
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  };

  const handleScheduledDateChange = (val) => {
    const deadlineVal = getOneDayPrior(val);
    setReviewFormData(prev => ({
      ...prev,
      scheduledDate: val,
      deadline: deadlineVal
    }));
  };

  const handleOpenScheduleReview = () => {
    setRescheduleReviewData(null);
    setReviewFormData({
      title: '',
      reviewType: 'REVIEW_1',
      department: '',
      batch: '',
      academicYear: currentAcademicYear,
      yearOfStudy: '',
      scheduledDate: '',
      deadline: '',
      venue: '',
      maxMarks: '',
      instructions: ''
    });
    setIsScheduleReviewOpen(true);
  };

  const handleOpenRescheduleReview = (rev) => {
    setRescheduleReviewData(rev);
    const sDate = formatDateToLocalInput(rev.scheduledDate);
    const dDate = getOneDayPrior(sDate) || formatDateToLocalInput(rev.deadline);
    const rBatch = rev.batch || activeBatchesList[0] || '2024-2028';

    setReviewFormData({
      title: rev.title || '',
      reviewType: rev.reviewType || 'REVIEW_1',
      department: rev.department?._id || rev.department || '',
      batch: rBatch,
      academicYear: rev.academicYear || currentAcademicYear,
      yearOfStudy: rev.yearOfStudy || calculateYearOfStudy(rBatch),
      scheduledDate: sDate,
      deadline: dDate,
      venue: rev.venue || '',
      maxMarks: rev.maxMarks || '',
      instructions: rev.instructions || ''
    });
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!reviewFormData.title?.trim() || !reviewFormData.scheduledDate || !reviewFormData.department || !reviewFormData.batch) {
      alert('Review title, department, target batch, and scheduled date are mandatory.');
      return;
    }

    const minDate = getMinScheduledDate();
    if (!rescheduleReviewData && reviewFormData.scheduledDate < minDate) {
      alert(`Invalid scheduled date. The scheduled review date must be at least tomorrow (${minDate}) so the submission deadline (1 day prior) is valid.`);
      return;
    }

    const calculatedDeadline = getOneDayPrior(reviewFormData.scheduledDate);
    const targetBatch = reviewFormData.batch;
    const computedYear = calculateYearOfStudy(targetBatch);

    try {
      const payload = {
        ...reviewFormData,
        title: reviewFormData.title.trim(),
        batch: targetBatch,
        academicYear: currentAcademicYear,
        yearOfStudy: computedYear,
        deadline: calculatedDeadline,
        venue: reviewFormData.venue || 'Seminar Hall / Online',
        instructions: reviewFormData.instructions || 'Upload presentation slides (PPT/PDF) and technical milestone report covering deliverables.',
        maxMarks: Math.min(100, Math.max(1, Number(reviewFormData.maxMarks) || 50))
      };

      if (rescheduleReviewData) {
        if (onUpdateReview) {
          await onUpdateReview(rescheduleReviewData._id || rescheduleReviewData.id, payload);
        }
        setRescheduleReviewData(null);
      } else {
        if (onScheduleReview) {
          await onScheduleReview(payload);
        }
        setIsScheduleReviewOpen(false);
      }
      if (onRefreshAllData) await onRefreshAllData();
    } catch (err) {
      alert(err.message || 'Operation failed.');
    }
  };

  // ==========================================
  // CONFIRM DELETE EXECUTION
  // ==========================================
  const executeDelete = async () => {
    if (!deleteConfirmation) return;
    const { type, id } = deleteConfirmation;

    try {
      if (type === 'student') {
        if (onDeleteStudent) await onDeleteStudent(id);
        else await deleteStudent(id);
        await loadStudents();
        if (onRefreshAllData) await onRefreshAllData();
      } else if (type === 'faculty') {
        if (onDeleteFaculty) await onDeleteFaculty(id);
        else await deleteFaculty(id);
        await loadFaculty();
        if (onRefreshAllData) await onRefreshAllData();
      } else if (type === 'review') {
        if (onDeleteReview) await onDeleteReview(id);
        if (onRefreshAllData) await onRefreshAllData();
      }
      setDeleteConfirmation(null);
    } catch (err) {
      alert(err.message || 'Failed to delete record.');
    }
  };

  // Filter Activation Checks (Tables require explicit filter selection or search before records are listed)
  const isAllocationActive = allocationBatchFilter !== 'NONE' || allocationDeptFilter !== 'NONE' || Boolean(allocationSearchQuery);
  const isProjectActive = projectBatchFilter !== 'NONE' || projectStatusFilter !== 'NONE' || projectDeptFilter !== 'NONE' || Boolean(projectSearchQuery);
  const isStudentActive = studentBatchFilter !== 'NONE' || studentDeptFilter !== 'NONE' || Boolean(studentSearchQuery);
  const isFacultyActive = facultyDeptFilter !== 'NONE' || facultyAvailabilityFilter !== 'NONE' || Boolean(facultySearchQuery);
  const isReviewActive = reviewBatchFilter !== 'NONE' || reviewDeptFilter !== 'NONE';

  // Filtered Projects for Tab 1 (Guide Allocation - current academic cycle)
  const filteredProjects = useMemo(() => {
    if (!isAllocationActive) return [];
    return projectsList.filter(p => {
      const hasMembers = (Array.isArray(p.rawTeamMembers) && p.rawTeamMembers.length > 0) ||
                         (Array.isArray(p.teamMembers) && p.teamMembers.length > 0);
      if (!hasMembers) return false;

      const pYear = p.academicYear || currentAcademicYear;
      if (pYear !== currentAcademicYear) return false;

      const deptName = p.department?.name || p.department || '';
      const matchesDept = allocationDeptFilter === 'ALL' || allocationDeptFilter === 'NONE' || deptName.toLowerCase().includes(allocationDeptFilter.toLowerCase());
      const pBatch = p.batch || activeBatchesList[0];
      const matchesBatch = allocationBatchFilter === 'ALL' || allocationBatchFilter === 'NONE' ||
        (allocationBatchFilter === 'GRADUATED'
          ? !activeBatchesList.includes(pBatch)
          : pBatch === allocationBatchFilter);
      const matchesSearch = !allocationSearchQuery || 
        (p.title && p.title.toLowerCase().includes(allocationSearchQuery.toLowerCase())) ||
        (p.leadName && p.leadName.toLowerCase().includes(allocationSearchQuery.toLowerCase())) ||
        (p.leadRegNo && String(p.leadRegNo).toLowerCase().includes(allocationSearchQuery.toLowerCase()));
      return matchesDept && matchesBatch && matchesSearch;
    });
  }, [projectsList, allocationDeptFilter, allocationBatchFilter, allocationSearchQuery, activeBatchesList, isAllocationActive, currentAcademicYear]);

  // Filtered Projects for Tab 2 (Teams & Projects Directory)
  const filteredTeamsProjects = useMemo(() => {
    if (!isProjectActive) return [];
    return projectsList.filter(p => {
      const hasMembers = (Array.isArray(p.rawTeamMembers) && p.rawTeamMembers.length > 0) ||
                         (Array.isArray(p.teamMembers) && p.teamMembers.length > 0);
      if (!hasMembers) return false;

      const pYear = p.academicYear || currentAcademicYear;
      const matchesAcadYear = projectAcademicYearFilter === 'ALL' || pYear === projectAcademicYearFilter;
      if (!matchesAcadYear) return false;

      const deptName = p.department?.name || p.department || p.dept || '';
      const matchesDept = projectDeptFilter === 'ALL' || projectDeptFilter === 'NONE' || deptName.toLowerCase().includes(projectDeptFilter.toLowerCase());
      const pBatch = p.batch || activeBatchesList[0];
      const matchesBatch = projectBatchFilter === 'ALL' || projectBatchFilter === 'NONE' ||
        (projectBatchFilter === 'GRADUATED'
          ? !activeBatchesList.includes(pBatch)
          : pBatch === projectBatchFilter);
      const isCompleted = p.status === 'COMPLETED';
      const isActive = p.status === 'IN_PROGRESS' || p.status === 'APPROVED';
      const isSubmitted = p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW';

      let matchesStatus = true;
      if (projectStatusFilter === 'ACTIVE') matchesStatus = isActive;
      else if (projectStatusFilter === 'COMPLETED') matchesStatus = isCompleted;
      else if (projectStatusFilter === 'SUBMITTED') matchesStatus = isSubmitted;
      // 'ALL' matches all statuses

      const guideName = p.guideName || (typeof p.guide === 'object' ? p.guide?.name : p.guide) || '';
      const matchesSearch = !projectSearchQuery ||
        (p.title && p.title.toLowerCase().includes(projectSearchQuery.toLowerCase())) ||
        (p.leadName && p.leadName.toLowerCase().includes(projectSearchQuery.toLowerCase())) ||
        (p.leadRegNo && String(p.leadRegNo).toLowerCase().includes(projectSearchQuery.toLowerCase())) ||
        (guideName && guideName.toLowerCase().includes(projectSearchQuery.toLowerCase()));

      return matchesDept && matchesBatch && matchesStatus && matchesSearch;
    });
  }, [projectsList, projectDeptFilter, projectBatchFilter, projectStatusFilter, projectSearchQuery, activeBatchesList, isProjectActive, projectAcademicYearFilter, currentAcademicYear]);

  // Filtered Students for Tab 3 (Student Directory)
  const filteredStudents = useMemo(() => {
    if (!isStudentActive) return [];
    return students.filter(s => {
      const deptName = s.department?.name || s.department?.code || '';
      const matchesDept = studentDeptFilter === 'ALL' || studentDeptFilter === 'NONE' || deptName.toLowerCase().includes(studentDeptFilter.toLowerCase());
      const sBatch = s.batch || activeBatchesList[0];
      const matchesBatch = studentBatchFilter === 'ALL' || studentBatchFilter === 'NONE' ||
        (studentBatchFilter === 'GRADUATED'
          ? isStudentGraduated(s) || !activeBatchesList.includes(sBatch)
          : sBatch === studentBatchFilter);
      const matchesSearch = !studentSearchQuery || 
        (s.name && s.name.toLowerCase().includes(studentSearchQuery.toLowerCase())) ||
        (s.regNo && String(s.regNo).toLowerCase().includes(studentSearchQuery.toLowerCase())) ||
        (s.email && s.email.toLowerCase().includes(studentSearchQuery.toLowerCase()));
      return matchesDept && matchesBatch && matchesSearch;
    });
  }, [students, studentDeptFilter, studentBatchFilter, studentSearchQuery, activeBatchesList, isStudentActive]);

  // Filtered Faculty for Tab 4 (Faculty Directory)
  const filteredFaculty = useMemo(() => {
    if (!isFacultyActive) return [];
    return faculty.filter(f => {
      const deptName = f.department?.name || f.department?.code || (typeof f.department === 'string' ? f.department : '') || '';
      const matchesDept = facultyDeptFilter === 'ALL' || facultyDeptFilter === 'NONE' || deptName.toLowerCase().includes(facultyDeptFilter.toLowerCase());
      
      const activeCount = getFacultyActiveCount(f);
      const maxCap = f.maxProjects || 6;
      const isAvailable = activeCount < maxCap;
      let matchesAvailability = true;
      if (facultyAvailabilityFilter === 'AVAILABLE') {
        matchesAvailability = isAvailable;
      } else if (facultyAvailabilityFilter === 'UNAVAILABLE') {
        matchesAvailability = !isAvailable;
      }

      const matchesSearch = !facultySearchQuery || 
        (f.name && f.name.toLowerCase().includes(facultySearchQuery.toLowerCase())) ||
        (f.facultyId && String(f.facultyId).toLowerCase().includes(facultySearchQuery.toLowerCase())) ||
        (f.email && f.email.toLowerCase().includes(facultySearchQuery.toLowerCase()));
      return matchesDept && matchesAvailability && matchesSearch;
    });
  }, [faculty, facultyDeptFilter, facultyAvailabilityFilter, facultySearchQuery, isFacultyActive, getFacultyActiveCount]);

  // Filtered Reviews for Tab 5 (Review Management - current academic cycle)
  const filteredReviews = useMemo(() => {
    if (!isReviewActive) return [];
    return reviewsList.filter(r => {
      const rYear = r.academicYear || currentAcademicYear;
      if (rYear !== currentAcademicYear) return false;

      const deptName = r.department?.name || r.department?.code || '';
      const matchesDept = reviewDeptFilter === 'ALL' || reviewDeptFilter === 'NONE' || deptName.toLowerCase().includes(reviewDeptFilter.toLowerCase());
      const rBatch = r.batch || activeBatchesList[0];
      const matchesBatch = reviewBatchFilter === 'ALL' || reviewBatchFilter === 'NONE' ||
        (reviewBatchFilter === 'GRADUATED'
          ? !activeBatchesList.includes(rBatch)
          : rBatch === reviewBatchFilter);
      return matchesDept && matchesBatch;
    });
  }, [reviewsList, reviewDeptFilter, reviewBatchFilter, activeBatchesList, isReviewActive, currentAcademicYear]);

  // ==========================================
  // ACTIONABLE TAB COUNTERS & METRICS
  // ==========================================
  // Tab 1: Count of projects that are unassigned and need a guide allocated for active cycle
  const unassignedProjectsCount = useMemo(() => {
    return (projectsList || []).filter(p => (p.academicYear || currentAcademicYear) === currentAcademicYear && !p.guide && !p.guideName && !p.guideId && !p.facultyGuide).length;
  }, [projectsList, currentAcademicYear]);

  // Tab 2: Count of new/pending proposals awaiting review in active cycle
  const pendingProjectsCount = useMemo(() => {
    return (projectsList || []).filter(p => (p.academicYear || currentAcademicYear) === currentAcademicYear && (p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW')).length;
  }, [projectsList, currentAcademicYear]);

  // Tab 5: Count of active/scheduled reviews needing attention in active cycle
  const activeReviewsCount = useMemo(() => {
    return (reviewsList || []).filter(r => (r.academicYear || currentAcademicYear) === currentAcademicYear && (!r.status || r.status === 'SCHEDULED' || r.status === 'IN_PROGRESS')).length;
  }, [reviewsList, currentAcademicYear]);

  // Student Directory Metrics: Current 4 Years Breakdown (Year 4 down to Year 1 based on activeBatchesList)
  const current4YearsStudentCounts = useMemo(() => {
    return activeBatchesList.map((batch, index) => {
      const yearNumber = 4 - index;
      const count = (students || []).filter(s => {
        const sBatch = s.batch || activeBatchesList[0];
        return sBatch === batch;
      }).length;

      return {
        year: `Year ${yearNumber}`,
        batch,
        count
      };
    });
  }, [activeBatchesList, students]);

  // Student Directory Metrics: Department-Specific Breakdown
  const departmentStudentCounts = useMemo(() => {
    const list = departments.map(d => ({
      id: d._id || d.name,
      name: d.name,
      code: d.code || (d.name.includes('&') ? d.name.split('&').map(w => w.trim()[0]).join('') : d.name.substring(0, 4).toUpperCase())
    }));

    (students || []).forEach(s => {
      const sDeptName = s.department?.name || (typeof s.department === 'string' ? s.department : '');
      if (sDeptName && !list.some(d => d.name.toLowerCase() === sDeptName.toLowerCase() || d.code.toLowerCase() === sDeptName.toLowerCase())) {
        list.push({
          id: sDeptName,
          name: sDeptName,
          code: s.department?.code || sDeptName.substring(0, 4).toUpperCase()
        });
      }
    });

    return list.map(dept => {
      const dName = dept.name.toLowerCase();
      const dCode = dept.code.toLowerCase();
      const dId = dept.id ? String(dept.id) : '';

      const count = (students || []).filter(s => {
        if (!s.department) return false;
        if (typeof s.department === 'object') {
          if (dId && String(s.department._id) === dId) return true;
          if (s.department.name && s.department.name.toLowerCase() === dName) return true;
          if (s.department.code && s.department.code.toLowerCase() === dCode) return true;
        }
        if (typeof s.department === 'string') {
          const str = s.department.toLowerCase();
          if (dId && str === dId.toLowerCase()) return true;
          if (str === dName || str === dCode) return true;
          if (str.includes(dName) || dName.includes(str)) return true;
        }
        return false;
      }).length;

      return {
        ...dept,
        count
      };
    });
  }, [departments, students]);

  // Faculty Directory Metrics: Department-Specific Breakdown
  const departmentFacultyCounts = useMemo(() => {
    const list = departments.map(d => ({
      id: d._id || d.name,
      name: d.name,
      code: d.code || (d.name.includes('&') ? d.name.split('&').map(w => w.trim()[0]).join('') : d.name.substring(0, 4).toUpperCase())
    }));

    (faculty || []).forEach(f => {
      const fDeptName = f.department?.name || (typeof f.department === 'string' ? f.department : '');
      if (fDeptName && !list.some(d => d.name.toLowerCase() === fDeptName.toLowerCase() || d.code.toLowerCase() === fDeptName.toLowerCase())) {
        list.push({
          id: fDeptName,
          name: fDeptName,
          code: f.department?.code || fDeptName.substring(0, 4).toUpperCase()
        });
      }
    });

    return list.map(dept => {
      const dName = dept.name.toLowerCase();
      const dCode = dept.code.toLowerCase();
      const dId = dept.id ? String(dept.id) : '';

      const count = (faculty || []).filter(f => {
        if (!f.department) return false;
        if (typeof f.department === 'object') {
          if (dId && String(f.department._id) === dId) return true;
          if (f.department.name && f.department.name.toLowerCase() === dName) return true;
          if (f.department.code && f.department.code.toLowerCase() === dCode) return true;
        }
        if (typeof f.department === 'string') {
          const str = f.department.toLowerCase();
          if (dId && str === dId.toLowerCase()) return true;
          if (str === dName || str === dCode) return true;
          if (str.includes(dName) || dName.includes(str)) return true;
        }
        return false;
      }).length;

      return {
        ...dept,
        count
      };
    });
  }, [departments, faculty]);

  // Teams & Projects Metrics: Department-Specific Project Breakdown
  const departmentProjectCounts = useMemo(() => {
    const list = departments.map(d => ({
      id: d._id || d.name,
      name: d.name,
      code: d.code || (d.name.includes('&') ? d.name.split('&').map(w => w.trim()[0]).join('') : d.name.substring(0, 4).toUpperCase())
    }));

    (projectsList || []).forEach(p => {
      const pDeptName = p.department?.name || p.dept || (typeof p.department === 'string' ? p.department : '');
      if (pDeptName && !list.some(d => d.name.toLowerCase() === pDeptName.toLowerCase() || d.code.toLowerCase() === pDeptName.toLowerCase())) {
        list.push({
          id: pDeptName,
          name: pDeptName,
          code: p.department?.code || pDeptName.substring(0, 4).toUpperCase()
        });
      }
    });

    return list.map(dept => {
      const dName = dept.name.toLowerCase();
      const dCode = dept.code.toLowerCase();
      const dId = dept.id ? String(dept.id) : '';

      const count = (projectsList || []).filter(p => {
        if (!p.department && !p.dept) return false;
        if (typeof p.department === 'object' && p.department !== null) {
          if (dId && String(p.department._id) === dId) return true;
          if (p.department.name && p.department.name.toLowerCase() === dName) return true;
          if (p.department.code && p.department.code.toLowerCase() === dCode) return true;
        }
        const str = (p.department?.name || p.dept || (typeof p.department === 'string' ? p.department : '')).toLowerCase();
        if (dId && str === dId.toLowerCase()) return true;
        if (str === dName || str === dCode) return true;
        if (str.includes(dName) || dName.includes(str)) return true;
        return false;
      }).length;

      return {
        ...dept,
        count
      };
    });
  }, [departments, projectsList]);

  return (
    <div className="page-container">
      {/* Top Header Banner */}
      <div className="page-header-banner" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="hero-pill-badge" style={{ margin: 0, padding: '0.2rem 0.65rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
              <Shield size={14} /> Central Academic Admin Cell
            </span>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Institutional Project Authority</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>
              • Synced: {lastSyncedTime}
            </span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Institutional Administration & Central Management
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Centralized guide allocation, manual student & faculty accounts provisioning, and review schedule control.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Institutional Academic Year Increment/Decrement Stepper */}
          <div className="acad-year-selector-pill">
            <Calendar size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Acad. Year:</span>

            {/* Decrement Button */}
            <button
              type="button"
              onClick={() => handleOpenYearTransition(decrementedAcademicYear, 'DECREMENT')}
              disabled={!canDecrementYear || isTransitioningYear}
              title={canDecrementYear ? `Revert to previous academic cycle (${decrementedAcademicYear})` : `Cannot revert past institutional calendar limit (${minAllowedAcademicYear})`}
              className={`acad-year-nav-btn ${canDecrementYear ? 'active' : 'disabled'}`}
            >
              <ChevronLeft size={14} />
            </button>

            {/* Current Active Year Badge */}
            <div className="acad-year-display-badge">
              <span>{currentAcademicYear}</span>
              <span className="acad-year-active-pill">
                Active
              </span>
            </div>

            {/* Increment Button */}
            <button
              type="button"
              onClick={() => handleOpenYearTransition(incrementedAcademicYear, 'INCREMENT')}
              disabled={!canIncrementYear || isTransitioningYear}
              title={canIncrementYear ? `Advance to next academic cycle (${incrementedAcademicYear})` : `Cannot advance to ${incrementedAcademicYear} until calendar year progresses to ${calYear + 1}`}
              className={`acad-year-nav-btn ${canIncrementYear ? 'active' : 'disabled'}`}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <button 
            className="btn-aesthetic btn-glass-secondary btn-sm"
            onClick={handleSyncEverything}
            disabled={isSyncing}
            style={{ gap: '0.4rem' }}
          >
            {isSyncing ? <ProjIntelSpinner size="xs" inline /> : <RefreshCw size={14} />}
            <span>{isSyncing ? 'Syncing...' : 'Sync Live Records'}</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('allocation')}
          className={`nav-item-link ${activeTab === 'allocation' ? 'active' : ''}`}
          style={{ height: '40px', padding: '0 1.15rem', fontWeight: 700 }}
        >
          <UserCheck size={16} />
          <span>1. Guide Allocation</span>
          {unassignedProjectsCount > 0 && (
            <span className="tab-counter-badge badge-alert" title={`${unassignedProjectsCount} project(s) need faculty guide allocation`}>
              {unassignedProjectsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`nav-item-link ${activeTab === 'projects' ? 'active' : ''}`}
          style={{ height: '40px', padding: '0 1.15rem', fontWeight: 700 }}
        >
          <Layers size={16} />
          <span>2. Teams & Projects</span>
          {pendingProjectsCount > 0 && (
            <span className="tab-counter-badge badge-alert" title={`${pendingProjectsCount} proposal(s) awaiting review`}>
              {pendingProjectsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`nav-item-link ${activeTab === 'students' ? 'active' : ''}`}
          style={{ height: '40px', padding: '0 1.15rem', fontWeight: 700 }}
        >
          <Users size={16} />
          <span>3. Student Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('faculty')}
          className={`nav-item-link ${activeTab === 'faculty' ? 'active' : ''}`}
          style={{ height: '40px', padding: '0 1.15rem', fontWeight: 700 }}
        >
          <Briefcase size={16} />
          <span>4. Faculty Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`nav-item-link ${activeTab === 'reviews' ? 'active' : ''}`}
          style={{ height: '40px', padding: '0 1.15rem', fontWeight: 700 }}
        >
          <Award size={16} />
          <span>5. Review Management</span>
          {activeReviewsCount > 0 && (
            <span className="tab-counter-badge" title={`${activeReviewsCount} active/scheduled review(s)`}>
              {activeReviewsCount}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: FACULTY GUIDE ALLOCATION TABLE
          ========================================================================= */}
      {activeTab === 'allocation' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={18} style={{ color: 'var(--primary)' }} />
                Student Team Faculty Guide Allocation Roster
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                Assign or change faculty guides for student teams before or after faculty proposal approval.
              </p>
            </div>

            {/* Filters Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search project or lead..."
                  value={allocationSearchQuery}
                  onChange={(e) => setAllocationSearchQuery(e.target.value)}
                  className="aesthetic-input"
                  style={{ paddingLeft: '1.9rem', width: '210px', height: '34px', fontSize: '0.8rem' }}
                />
              </div>

              {/* Batch Filter */}
              <select
                value={allocationBatchFilter}
                onChange={(e) => setAllocationBatchFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                {renderBatchFilterOptions(true)}
              </select>

              {/* Department Filter */}
              <select
                value={allocationDeptFilter}
                onChange={(e) => setAllocationDeptFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                <option value="NONE">— None (Select Department) —</option>
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d._id || d.name} value={d.name}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Allocation Table */}
          {filteredProjects.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Project ID & Title</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Student Team / Lead</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Department</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Proposal Status</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Assigned Guide</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Allocation Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((proj) => {
                    const hasGuide = Boolean(proj.guide || proj.guideName || proj.guideId);
                    const guideName = proj.guide?.name || proj.guideName || (hasGuide ? 'Assigned' : 'Unassigned');

                    return (
                      <tr key={proj._id || proj.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s ease' }}>
                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{proj.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Domain: <span style={{ color: 'var(--primary)' }}>{proj.domain || 'Academic Project'}</span>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {proj.leadName || 'Student Team'}
                          </div>
                          {(proj.leadRegNo || proj.regNo) && (
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Reg: {proj.leadRegNo || proj.regNo}
                            </span>
                          )}
                          {(() => {
                            const pMembers = (Array.isArray(proj.rawTeamMembers) && proj.rawTeamMembers.length > 0)
                              ? proj.rawTeamMembers
                              : (Array.isArray(proj.teamMembers) ? proj.teamMembers : []);
                            const lName = proj.leadName || '';
                            let lReg = proj.leadRegNo || proj.regNo || '';
                            if (!lReg && lName) {
                              const s = students.find(st => st.name && st.name.toLowerCase().trim() === String(lName).toLowerCase().trim());
                              if (s && s.regNo) lReg = s.regNo;
                            }
                            const peers = pMembers.filter((m, idx) => {
                              const mName = typeof m === 'object' ? (m.name || m.student?.name) : String(m);
                              const mReg = typeof m === 'object' ? (m.regNo || m.student?.regNo) : '';
                              const mId = typeof m === 'object' ? String(m._id || m.id || '') : '';

                              if (proj.leadStudentId && mId && mId === String(proj.leadStudentId)) return false;
                              if (lReg && mReg && mReg.toLowerCase().trim() === lReg.toLowerCase().trim()) return false;
                              if (lName && mName && mName.toLowerCase().trim() === lName.toLowerCase().trim()) return false;
                              return idx > 0;
                            });
                            if (peers.length === 0) return null;
                            return (
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                                +{peers.length} team member{peers.length > 1 ? 's' : ''}
                              </div>
                            );
                          })()}
                        </td>

                        <td style={{ padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                          {proj.department?.name || proj.department?.code || proj.department || 'CSE'}
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          {renderProjectStatusBadge(proj)}
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          {hasGuide ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                                  {guideName}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {proj.guide?.designation || 'Faculty Mentor'}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Clock size={13} /> Awaiting Guide Allocation
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '0.85rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenAssignGuide(proj)}
                            className="btn-aesthetic btn-sm"
                            style={{ 
                              background: hasGuide ? 'var(--bg-glass)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                              color: '#fff',
                              border: hasGuide ? '1px solid var(--border-color)' : 'none',
                              fontSize: '0.775rem',
                              padding: '0.35rem 0.8rem'
                            }}
                          >
                            <UserCheck size={14} />
                            <span>{hasGuide ? 'Change Guide' : 'Assign Guide'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
              {!isAllocationActive ? (
                <>
                  <Filter size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--primary)', opacity: 0.8 }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>Select a Filter to View Allocations</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '420px', margin: '0 auto' }}>
                    Choose a Batch ("All Batches") or Department from the dropdown filters above to inspect and assign project guides.
                  </p>
                </>
              ) : (
                <>
                  <Building size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)', opacity: 0.7 }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>No Projects Found Matching Filter</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                    Try adjusting the department filter or search query.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: TEAMS & PROJECTS MASTER DIRECTORY
          ========================================================================= */}
      {activeTab === 'projects' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} />
                Institutional Teams & Projects Master Roster
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                Comprehensive tracking of all student project teams, academic batches, assigned guides, and milestone progress & completion.
              </p>
            </div>

            {/* Filters Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search project, lead, regNo, guide..."
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                  className="aesthetic-input"
                  style={{ paddingLeft: '1.9rem', width: '230px', height: '34px', fontSize: '0.8rem' }}
                />
              </div>

              {/* Academic Cycle Filter */}
              <select
                value={projectAcademicYearFilter}
                onChange={(e) => setProjectAcademicYearFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
                title="Filter projects by Academic Cycle"
              >
                <option value={currentAcademicYear}>Acad. Year {currentAcademicYear} (Active Cycle)</option>
                {decrementedAcademicYear !== currentAcademicYear && (
                  <option value={decrementedAcademicYear}>Acad. Year {decrementedAcademicYear} (Past Cycle)</option>
                )}
                <option value="ALL">All Academic Cycles (Archive)</option>
              </select>

              {/* Batch Filter */}
              <select
                value={projectBatchFilter}
                onChange={(e) => setProjectBatchFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                {renderBatchFilterOptions(true)}
              </select>

              {/* Status Filter */}
              <select
                value={projectStatusFilter}
                onChange={(e) => setProjectStatusFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                <option value="NONE">— None (Select Status) —</option>
                <option value="ALL">All Projects</option>
                <option value="ACTIVE">Active & In Progress</option>
                <option value="COMPLETED">Completed & Certified ✓</option>
                <option value="SUBMITTED">Pending Guide Approval</option>
              </select>

              {/* Department Filter */}
              <select
                value={projectDeptFilter}
                onChange={(e) => setProjectDeptFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                <option value="NONE">— None (Select Department) —</option>
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d._id || d.name} value={d.name}>{d.code || d.name}</option>
                ))}
              </select>

              {/* Export CSV Button with Dropdown (Top Right Corner) */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setIsCsvDropdownOpen(prev => !prev)}
                  className="btn-aesthetic btn-primary-glow btn-sm"
                  style={{
                    height: '36px',
                    fontSize: '0.825rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0 0.95rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.15)'
                  }}
                  title="Export institutional CSV reports"
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                  <ChevronDown size={13} style={{ transform: isCsvDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {/* Dropdown Menu */}
                {isCsvDropdownOpen && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
                      onClick={() => setIsCsvDropdownOpen(false)} 
                    />
                    <div className="csv-dropdown-menu">
                      <div style={{ padding: '0.4rem 0.65rem 0.3rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.5px' }}>
                          Institutional CSV Reports
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                          Select report type, then filter by Year &amp; Department
                        </div>
                      </div>

                      {/* Option 1: Team & Mentor Report */}
                      <button
                        type="button"
                        onClick={() => handleOpenCsvModal('TEAM_MENTOR')}
                        className="csv-dropdown-option-btn"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem', color: '#818cf8' }}>
                          <Users size={14} />
                          <span>1. Team &amp; Mentor Report</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.2rem', lineHeight: '1.3' }}>
                          4 Cols: S.No, Project Name, Team Members (row per member), Guide Name
                        </div>
                      </button>

                      {/* Option 2: Final Report */}
                      <button
                        type="button"
                        onClick={() => handleOpenCsvModal('FINAL_REPORT')}
                        className="csv-dropdown-option-btn"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem', color: '#34d399' }}>
                          <Award size={14} />
                          <span>2. Final Report (Marks &amp; Grade)</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.2rem', lineHeight: '1.3' }}>
                          3 Cols: S.No, Project Name, Final Marks and Grade (Nil if incomplete)
                        </div>
                      </button>

                      {/* Option 3: Master Projects Directory */}
                      <button
                        type="button"
                        onClick={() => handleOpenCsvModal('MASTER_ROSTER')}
                        className="csv-dropdown-option-btn"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem', color: '#fbbf24' }}>
                          <Layers size={14} />
                          <span>3. Master Institutional Roster</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.2rem', lineHeight: '1.3' }}>
                          Comprehensive 14-column directory of all project data &amp; milestones
                        </div>
                      </button>

                      {/* Option 4: IEEE Report */}
                      <button
                        type="button"
                        onClick={() => handleOpenCsvModal('IEEE_REPORT')}
                        className="csv-dropdown-option-btn"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem', color: '#22d3ee' }}>
                          <FileText size={14} />
                          <span>4. IEEE Publication Report</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.2rem', lineHeight: '1.3' }}>
                          7 Cols: S.No, Team Members, Paper Title, Conference, Submission, Acceptance, Publication
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar: Total Projects, Department Distribution (Inside 1 card), and Active Filter Matches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {/* Card 1: Total Projects */}
            <div style={{ 
              background: 'var(--bg-glass)', 
              padding: '0.85rem 1.15rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '88px'
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers size={13} style={{ color: 'var(--primary)' }} /> Total Teams & Projects
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                {projectsList.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#818CF8' }}>{projectsList.filter(p => p.status === 'IN_PROGRESS' || p.status === 'APPROVED').length} Active</span>
                <span>•</span>
                <span style={{ color: '#10B981' }}>{projectsList.filter(p => p.status === 'COMPLETED').length} Completed</span>
                <span>•</span>
                <span style={{ color: '#F59E0B' }}>{projectsList.filter(p => !p.guide && !p.guideName).length} Unassigned</span>
              </div>
            </div>

            {/* Card 2: Department-Wise Project Distribution inside one single card/box UI */}
            <div style={{ 
              background: 'var(--bg-glass)', 
              padding: '0.85rem 1.15rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '88px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Layers size={13} style={{ color: 'var(--primary)' }} /> Department Distribution
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                  {departmentProjectCounts.length} Depts
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                {departmentProjectCounts.map(d => (
                  <span
                    key={d.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      background: d.count > 0 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${d.count > 0 ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-color)'}`,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: d.count > 0 ? 'var(--text-main)' : 'var(--text-muted)'
                    }}
                    title={d.name}
                  >
                    <span>{d.code || d.name}</span>
                    <span style={{
                      padding: '0 5px',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: d.count > 0 ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                      color: d.count > 0 ? '#ffffff' : 'var(--text-dim)'
                    }}>
                      {d.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Card 3: Current Active Filter Result */}
            <div style={{ 
              background: 'var(--bg-glass)', 
              padding: '0.85rem 1.15rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '88px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Filter size={13} style={{ color: '#38BDF8' }} /> Active Filter Matches
                </div>
                <span style={{ 
                  fontSize: '0.68rem', 
                  color: isProjectActive ? '#34D399' : 'var(--text-dim)', 
                  background: isProjectActive ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                  padding: '1px 6px', 
                  borderRadius: '4px', 
                  fontWeight: 600 
                }}>
                  {isProjectActive ? 'Filter Applied' : 'Filters: None'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: isProjectActive ? '#38BDF8' : 'var(--text-dim)' }}>
                  {isProjectActive ? filteredTeamsProjects.length : 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                  {isProjectActive ? (
                    <div>
                      <div>
                        {projectBatchFilter !== 'NONE' && (
                          <strong style={{ color: 'var(--text-main)' }}>
                            {projectBatchFilter === 'ALL' ? 'All Batches' : projectBatchFilter === 'GRADUATED' ? 'Graduated Batches' : `Batch ${projectBatchFilter}`}
                          </strong>
                        )}
                        {projectBatchFilter !== 'NONE' && (projectDeptFilter !== 'NONE' || projectStatusFilter !== 'NONE') && ' • '}
                        {projectDeptFilter !== 'NONE' && (
                          <strong style={{ color: 'var(--text-main)' }}>
                            {projectDeptFilter === 'ALL' ? 'All Depts' : projectDeptFilter}
                          </strong>
                        )}
                        {projectDeptFilter !== 'NONE' && projectStatusFilter !== 'NONE' && ' • '}
                        {projectStatusFilter !== 'NONE' && (
                          <strong style={{ color: 'var(--text-main)' }}>
                            {projectStatusFilter === 'ALL' ? 'All Statuses' : projectStatusFilter === 'ACTIVE' ? 'Active Projects' : projectStatusFilter === 'COMPLETED' ? 'Completed' : 'Pending Approval'}
                          </strong>
                        )}
                        {projectSearchQuery && ` • "${projectSearchQuery}"`}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                        {filteredTeamsProjects.length} project team{filteredTeamsProjects.length !== 1 ? 's' : ''} listed
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div>No filter applied yet</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                        Select batch, status, or department to filter roster
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Teams & Projects Table */}
          {filteredTeamsProjects.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Project Title & Domain</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Team Lead & Members</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Batch & Dept</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Assigned Faculty Guide</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Milestone Progress</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeamsProjects.map((p) => {
                    const isCompleted = p.status === 'COMPLETED';
                    const prog = isCompleted ? 100 : (p.progress || 0);
                    const guideName = p.guideName || (typeof p.guide === 'object' ? p.guide?.name : p.guide) || 'Not Assigned';
                    const allMembers = (Array.isArray(p.rawTeamMembers) && p.rawTeamMembers.length > 0)
                      ? p.rawTeamMembers
                      : (Array.isArray(p.teamMembers) ? p.teamMembers : (p.members || []));
                    const pLeadName = p.leadName || (typeof allMembers[0] === 'object' ? allMembers[0]?.name : allMembers[0]) || 'Student Lead';
                    let pLeadRegNo = p.leadRegNo || p.regNo || (typeof allMembers[0] === 'object' ? allMembers[0]?.regNo : '') || '';
                    if (!pLeadRegNo) {
                      const leadStud = students.find(s => 
                        (p.leadStudentId && (String(s._id) === String(p.leadStudentId) || String(s.id) === String(p.leadStudentId))) ||
                        (pLeadName && s.name && s.name.toLowerCase().trim() === String(pLeadName).toLowerCase().trim())
                      );
                      if (leadStud && leadStud.regNo) pLeadRegNo = leadStud.regNo;
                    }

                    const peerMembers = allMembers.filter((m, idx) => {
                      const mName = typeof m === 'object' ? (m.name || m.student?.name) : String(m);
                      const mReg = typeof m === 'object' ? (m.regNo || m.student?.regNo) : '';
                      const mId = typeof m === 'object' ? String(m._id || m.id || '') : '';

                      if (p.leadStudentId && mId && mId === String(p.leadStudentId)) return false;
                      if (pLeadRegNo && mReg && mReg.toLowerCase().trim() === pLeadRegNo.toLowerCase().trim()) return false;
                      if (pLeadName && mName && mName.toLowerCase().trim() === pLeadName.toLowerCase().trim()) return false;
                      return idx > 0;
                    });
                    const otherMembersCount = peerMembers.length;
                    const pBatch = p.batch || '2023-2027';
                    const pDept = p.department?.name || p.department || 'CSE';

                    return (
                      <tr key={p._id || p.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s ease' }}>
                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {p.domain || 'Domain / Academic Specialization'}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.825rem' }}>
                            {pLeadName}
                          </div>
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {pLeadRegNo ? `${pLeadRegNo} ` : ''}
                            {otherMembersCount > 0 
                              ? `• +${otherMembersCount} ${otherMembersCount === 1 ? 'Member' : 'Members'}` 
                              : '• Solo'}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <span className="hero-pill-badge" style={{ margin: 0, padding: '0.15rem 0.5rem', fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.12)', color: '#818CF8' }}>
                            Batch {pBatch}
                          </span>
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {pDept}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          {guideName !== 'Not Assigned' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.825rem' }}>
                              <GraduationCap size={14} style={{ color: 'var(--primary)' }} />
                              <span>{guideName}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#F59E0B', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Clock size={12} /> Pending Allocation
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '0.85rem', minWidth: '130px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 700, color: isCompleted ? '#10B981' : 'var(--text-main)' }}>
                              {prog}%
                            </span>
                            {isCompleted && (
                              <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Finalized</span>
                            )}
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'var(--bg-glass)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${prog}%`, 
                                height: '100%', 
                                background: isCompleted ? 'linear-gradient(90deg, #10B981, #059669)' : 'var(--gradient-primary)',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                              }} 
                            />
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          {isCompleted ? (
                            <span className="project-status-badge" style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10B981',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}>
                              <CheckCircle2 size={12} /> Completed & Signed Off ✓
                            </span>
                          ) : (
                            renderProjectStatusBadge(p, true)
                          )}
                        </td>

                        <td style={{ padding: '0.85rem', textAlign: 'right' }}>
                          <button
                            onClick={() => setDossierProject(p)}
                            className="btn-aesthetic btn-glass-secondary btn-sm"
                            style={{ padding: '0.3rem 0.65rem', height: '28px', fontSize: '0.75rem', gap: '0.35rem' }}
                            title="View complete project dossier"
                          >
                            <FileText size={13} />
                            <span>View Dossier</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
              {!isProjectActive ? (
                <>
                  <Filter size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--primary)', opacity: 0.8 }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>Select a Filter to View Projects</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '420px', margin: '0 auto' }}>
                    Choose a Batch, Project Status ("All Projects"), or Department from the dropdown filters above to view projects.
                  </p>
                </>
              ) : (
                <>
                  <Layers size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)', opacity: 0.7 }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>No Project Teams Found</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                    Try adjusting the batch, department, or status filter.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: INSTITUTIONAL STUDENT DIRECTORY
          ========================================================================= */}
      {activeTab === 'students' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} style={{ color: 'var(--primary)' }} />
                Institutional Student Accounts & Enrollment Roster
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                Manually register and govern student accounts with register numbers, department, and academic batch.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search name, regNo, email..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="aesthetic-input"
                  style={{ paddingLeft: '1.9rem', width: '220px', height: '34px', fontSize: '0.8rem' }}
                />
              </div>

              {/* Department Filter */}
              <select
                value={studentDeptFilter}
                onChange={(e) => setStudentDeptFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                <option value="NONE">— None (Select Department) —</option>
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d._id || d.name} value={d.name}>{d.code || d.name}</option>
                ))}
              </select>

              {/* Batch Filter */}
              <select
                value={studentBatchFilter}
                onChange={(e) => setStudentBatchFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                {renderBatchFilterOptions(true)}
              </select>

              <button
                className="btn-aesthetic btn-primary-glow btn-sm"
                onClick={handleOpenAddStudent}
                style={{ gap: '0.4rem', height: '34px', padding: '0 0.9rem' }}
              >
                <UserPlus size={15} />
                <span>Add Student</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar: Total Registered + 4 Current Undergraduate Cohorts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'var(--bg-glass)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Users size={13} style={{ color: 'var(--primary)' }} /> Total Registered
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                {students.length}
              </div>
            </div>

            {current4YearsStudentCounts.map((yc, idx) => {
              const colors = [
                { text: '#818CF8', border: 'rgba(99, 102, 241, 0.25)', bg: 'rgba(99, 102, 241, 0.08)' },
                { text: '#38BDF8', border: 'rgba(56, 189, 248, 0.25)', bg: 'rgba(56, 189, 248, 0.08)' },
                { text: '#34D399', border: 'rgba(52, 211, 153, 0.25)', bg: 'rgba(52, 211, 153, 0.08)' },
                { text: '#FBBF24', border: 'rgba(251, 191, 36, 0.25)', bg: 'rgba(251, 191, 36, 0.08)' }
              ];
              const theme = colors[idx] || colors[0];
              return (
                <div 
                  key={yc.batch} 
                  style={{ 
                    background: theme.bg, 
                    padding: '0.75rem 1rem', 
                    borderRadius: 'var(--radius-md)', 
                    border: `1px solid ${theme.border}` 
                  }}
                >
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: theme.text, textTransform: 'uppercase' }}>
                    {yc.year} • {yc.batch}
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800, color: theme.text, marginTop: '0.15rem' }}>
                    {yc.count}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Parallel Metric Boxes: Department-Wise Breakdown & Active Filter Matches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {/* Card 1: Department-Wise Enrollment inside one single card/box UI */}
            <div style={{ 
              background: 'var(--bg-glass)', 
              padding: '0.85rem 1.15rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '88px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Layers size={13} style={{ color: 'var(--primary)' }} /> Department-Wise Enrollment
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                  {departmentStudentCounts.length} Depts
                </span>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                {departmentStudentCounts.map(d => (
                  <span
                    key={d.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      background: d.count > 0 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${d.count > 0 ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-color)'}`,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: d.count > 0 ? 'var(--text-main)' : 'var(--text-muted)'
                    }}
                    title={d.name}
                  >
                    <span>{d.code || d.name}</span>
                    <span style={{
                      padding: '0 5px',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: d.count > 0 ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                      color: d.count > 0 ? '#ffffff' : 'var(--text-dim)'
                    }}>
                      {d.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Card 2: Current Active Filter Result (Parallel to Card 1) */}
            <div style={{ 
              background: 'var(--bg-glass)', 
              padding: '0.85rem 1.15rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '88px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Filter size={13} style={{ color: '#38BDF8' }} /> Active Filter Matches
                </div>
                <span style={{ 
                  fontSize: '0.68rem', 
                  color: isStudentActive ? '#34D399' : 'var(--text-dim)', 
                  background: isStudentActive ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                  padding: '1px 6px', 
                  borderRadius: '4px', 
                  fontWeight: 600 
                }}>
                  {isStudentActive ? 'Filter Applied' : 'Filters: None'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: isStudentActive ? '#38BDF8' : 'var(--text-dim)' }}>
                  {isStudentActive ? filteredStudents.length : 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                  {isStudentActive ? (
                    <div>
                      <div>
                        {studentBatchFilter !== 'NONE' && (
                          <strong style={{ color: 'var(--text-main)' }}>
                            {studentBatchFilter === 'ALL' ? 'All Batches' : studentBatchFilter === 'GRADUATED' ? 'Graduated Batches' : `Batch ${studentBatchFilter}`}
                          </strong>
                        )}
                        {studentBatchFilter !== 'NONE' && studentDeptFilter !== 'NONE' && ' • '}
                        {studentDeptFilter !== 'NONE' && (
                          <strong style={{ color: 'var(--text-main)' }}>
                            {studentDeptFilter === 'ALL' ? 'All Depts' : studentDeptFilter}
                          </strong>
                        )}
                        {studentSearchQuery && ` • "${studentSearchQuery}"`}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                        {filteredStudents.length} student record{filteredStudents.length !== 1 ? 's' : ''} listed
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div>No filter applied yet</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                        Select department or batch to filter roster
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Students Table */}
          {isLoadingStudents ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <ProjIntelSpinner size="lg" label="Loading student directory from MongoDB..." />
            </div>
          ) : filteredStudents.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Student Name</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Register Number</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Email / Login</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Department</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Batch & Year</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Project Proposal</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const projMatch = getStudentProject(student);
                    const isPassedOut = isStudentGraduated(student);
                    const sYear = student.yearOfStudy || calculateYearOfStudy(student.batch || '2023-2027');

                    return (
                      <tr key={student._id || student.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s ease' }}>
                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                              {(student.name || 'S').charAt(0)}
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{student.name}</div>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, background: 'var(--bg-glass)', padding: '0.2rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                            {student.regNo || 'N/A'}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                          {student.email}
                        </td>

                        <td style={{ padding: '0.85rem', color: 'var(--text-muted)' }}>
                          {student.department?.name || student.department?.code || student.department || 'CSE'}
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.18rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#A5B4FC',
                              border: '1px solid rgba(99, 102, 241, 0.28)'
                            }}>
                              <Calendar size={11} style={{ opacity: 0.8 }} />
                              {student.batch || '2023-2027'}
                            </span>
                            {isPassedOut ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.12rem 0.45rem',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#34D399',
                                border: '1px solid rgba(16, 185, 129, 0.25)'
                              }}>
                                <GraduationCap size={11} /> Graduated
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.12rem 0.45rem',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                background: 'rgba(255, 255, 255, 0.04)',
                                color: 'var(--text-muted)',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                              }}>
                                Year {getRomanYear(sYear)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          {projMatch ? (
                            <div>
                              <div
                                onClick={() => setDossierProject(projMatch)}
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--text-main)',
                                  fontSize: '0.825rem',
                                  maxWidth: '180px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer'
                                }}
                                title={`Click to view complete dossier for "${projMatch.title}"`}
                              >
                                {projMatch.title}
                              </div>
                              <div style={{ marginTop: '0.2rem' }}>
                                {renderProjectStatusBadge(projMatch, true)}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                              No Project Registered
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '0.85rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => handleOpenEditStudent(student)}
                              className="btn-aesthetic btn-glass-secondary btn-sm"
                              style={{ padding: '0.3rem 0.5rem', height: '28px' }}
                              title="Edit student details"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmation({
                                type: 'student',
                                id: student._id || student.id,
                                title: student.name,
                                prompt: `Are you sure you want to delete student account "${student.name}" (${student.regNo})? This action cannot be undone.`
                              })}
                              className="btn-aesthetic btn-sm"
                              style={{ padding: '0.3rem 0.5rem', height: '28px', background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                              title="Delete student account"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
              {!isStudentActive ? (
                <>
                  <Filter size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--primary)', opacity: 0.8 }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>Select a Filter to View Students</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '420px', margin: '0 auto' }}>
                    Choose a Batch ("All Batches") or Department from the dropdown filters above to list student records.
                  </p>
                </>
              ) : (
                <>
                  <Users size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)', opacity: 0.7 }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>No Students Found</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem', marginBottom: '1rem' }}>
                    No student records matched the selected criteria.
                  </p>
                  <button 
                    className="btn-aesthetic btn-primary-glow btn-sm"
                    onClick={handleOpenAddStudent}
                  >
                    <UserPlus size={14} />
                    <span>Add Student Account</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: INSTITUTIONAL FACULTY DIRECTORY & QUOTA
          ========================================================================= */}
      {activeTab === 'faculty' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={18} style={{ color: 'var(--primary)' }} />
                Institutional Faculty Guide Directory & Supervision Quota
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                Manually register faculty guides, assign designations, and govern project supervision capacities.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search faculty name, ID..."
                  value={facultySearchQuery}
                  onChange={(e) => setFacultySearchQuery(e.target.value)}
                  className="aesthetic-input"
                  style={{ paddingLeft: '1.9rem', width: '220px', height: '34px', fontSize: '0.8rem' }}
                />
              </div>

              <select
                value={facultyDeptFilter}
                onChange={(e) => setFacultyDeptFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                <option value="NONE">— None (Select Department) —</option>
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d._id || d.name} value={d.name}>{d.code || d.name}</option>
                ))}
              </select>

              <select
                value={facultyAvailabilityFilter}
                onChange={(e) => setFacultyAvailabilityFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                <option value="NONE">— None (Select Availability) —</option>
                <option value="ALL">All Mentors</option>
                <option value="AVAILABLE">Available Mentors (Has Capacity)</option>
                <option value="UNAVAILABLE">Unavailable / Full Mentors</option>
              </select>

              <button
                className="btn-aesthetic btn-primary-glow btn-sm"
                onClick={handleOpenAddFaculty}
                style={{ gap: '0.4rem', height: '34px', padding: '0 0.9rem' }}
              >
                <UserPlus size={15} />
                <span>Add Faculty</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar: Total Faculty, Department Distribution (Inside 1 card), and Active Filter Matches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {/* Card 1: Total Faculty */}
            <div style={{ 
              background: 'var(--bg-glass)', 
              padding: '0.85rem 1.15rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '88px'
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Briefcase size={13} style={{ color: 'var(--primary)' }} /> Total Faculty
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                {faculty.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                Registered Faculty Guides & Mentors
              </div>
            </div>

            {/* Card 2: Department-Wise Distribution inside one single card/box UI */}
            <div style={{ 
              background: 'var(--bg-glass)', 
              padding: '0.85rem 1.15rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '88px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Layers size={13} style={{ color: 'var(--primary)' }} /> Department Distribution
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                  {departmentFacultyCounts.length} Depts
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                {departmentFacultyCounts.map(d => (
                  <span
                    key={d.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      background: d.count > 0 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${d.count > 0 ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-color)'}`,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: d.count > 0 ? 'var(--text-main)' : 'var(--text-muted)'
                    }}
                    title={d.name}
                  >
                    <span>{d.code || d.name}</span>
                    <span style={{
                      padding: '0 5px',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: d.count > 0 ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                      color: d.count > 0 ? '#ffffff' : 'var(--text-dim)'
                    }}>
                      {d.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Card 3: Current Active Filter Result */}
            <div style={{ 
              background: 'var(--bg-glass)', 
              padding: '0.85rem 1.15rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '88px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Filter size={13} style={{ color: '#38BDF8' }} /> Active Filter Matches
                </div>
                <span style={{ 
                  fontSize: '0.68rem', 
                  color: isFacultyActive ? '#34D399' : 'var(--text-dim)', 
                  background: isFacultyActive ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                  padding: '1px 6px', 
                  borderRadius: '4px', 
                  fontWeight: 600 
                }}>
                  {isFacultyActive ? 'Filter Applied' : 'Filters: None'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: isFacultyActive ? '#38BDF8' : 'var(--text-dim)' }}>
                  {isFacultyActive ? filteredFaculty.length : 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                  {isFacultyActive ? (
                    <div>
                      <div>
                        {facultyDeptFilter !== 'NONE' && (
                          <strong style={{ color: 'var(--text-main)' }}>
                            {facultyDeptFilter === 'ALL' ? 'All Depts' : facultyDeptFilter}
                          </strong>
                        )}
                        {facultyDeptFilter !== 'NONE' && facultyAvailabilityFilter !== 'NONE' && ' • '}
                        {facultyAvailabilityFilter !== 'NONE' && (
                          <strong style={{ color: 'var(--text-main)' }}>
                            {facultyAvailabilityFilter === 'AVAILABLE' ? 'Available Mentors' : facultyAvailabilityFilter === 'UNAVAILABLE' ? 'Unavailable / Full' : 'All Mentors'}
                          </strong>
                        )}
                        {facultySearchQuery && ` • "${facultySearchQuery}"`}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                        {filteredFaculty.length} faculty guide{filteredFaculty.length !== 1 ? 's' : ''} listed
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div>No filter applied yet</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                        Select department or availability to filter roster
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Faculty Table */}
          {isLoadingFaculty ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <ProjIntelSpinner size="lg" label="Loading faculty directory from MongoDB..." />
            </div>
          ) : filteredFaculty.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Faculty ID</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Faculty Name</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Email / Login</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Department</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Designation</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Active Supervision Load</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaculty.map((fac) => {
                    const activeCount = getFacultyActiveCount(fac);
                    const maxQuota = fac.maxProjects || 2;
                    const pct = Math.min(100, Math.round((activeCount / maxQuota) * 100));

                    return (
                      <tr key={fac._id || fac.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s ease' }}>
                        <td style={{ padding: '0.85rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, background: 'var(--bg-glass)', padding: '0.2rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                            {fac.facultyId || fac.staffId || 'N/A'}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{fac.name}</div>
                        </td>

                        <td style={{ padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                          {fac.email}
                        </td>

                        <td style={{ padding: '0.85rem', color: 'var(--text-muted)' }}>
                          {fac.department?.name || fac.department?.code || fac.department || 'CSE'}
                        </td>

                        <td style={{ padding: '0.85rem', color: 'var(--text-main)', fontSize: '0.825rem', fontWeight: 500 }}>
                          {fac.designation || 'Assistant Professor'}
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ width: '130px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.2rem' }}>
                              <span style={{ fontWeight: 700, color: activeCount >= maxQuota ? '#EF4444' : 'var(--text-main)' }}>
                                {activeCount} / {maxQuota} Projects
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${pct}%`, 
                                height: '100%', 
                                background: activeCount >= maxQuota ? '#EF4444' : pct > 60 ? '#F59E0B' : 'var(--primary)',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => handleOpenEditFaculty(fac)}
                              className="btn-aesthetic btn-glass-secondary btn-sm"
                              style={{ padding: '0.3rem 0.5rem', height: '28px' }}
                              title="Edit faculty details"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmation({
                                type: 'faculty',
                                id: fac._id || fac.id,
                                title: fac.name,
                                prompt: `Are you sure you want to delete faculty account "${fac.name}" (${fac.facultyId})? All supervised projects will be safely unbound.`
                              })}
                              className="btn-aesthetic btn-sm"
                              style={{ padding: '0.3rem 0.5rem', height: '28px', background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                              title="Delete faculty account"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
              {!isFacultyActive ? (
                <>
                  <Filter size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--primary)', opacity: 0.8 }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>Select a Filter to View Faculty</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '420px', margin: '0 auto' }}>
                    Choose a Department or Mentor Availability from the dropdown filters above to list faculty guides and supervision quotas.
                  </p>
                </>
              ) : (
                <>
                  <Briefcase size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)', opacity: 0.7 }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>No Faculty Members Found</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem', marginBottom: '1rem' }}>
                    No faculty records matched the selected criteria.
                  </p>
                  <button 
                    className="btn-aesthetic btn-primary-glow btn-sm"
                    onClick={handleOpenAddFaculty}
                  >
                    <UserPlus size={14} />
                    <span>Add Faculty Guide</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: DEPARTMENT & YEAR REVIEW MANAGEMENT
          ========================================================================= */}
      {activeTab === 'reviews' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} style={{ color: 'var(--primary)' }} />
                Department Review Schedules
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                Create, reschedule, and manage project reviews by department and year of study.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Department Filter */}
              <select
                value={reviewDeptFilter}
                onChange={(e) => setReviewDeptFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                <option value="NONE">— None (Select Department) —</option>
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d._id || d.name} value={d.name}>{d.code || d.name}</option>
                ))}
              </select>

              {/* Batch Filter */}
              <select
                value={reviewBatchFilter}
                onChange={(e) => setReviewBatchFilter(e.target.value)}
                className="aesthetic-input"
                style={{ height: '36px', fontSize: '0.825rem', width: 'auto', padding: '0 2.2rem 0 0.85rem' }}
              >
                {renderBatchFilterOptions(true)}
              </select>

              <button
                className="btn-aesthetic btn-primary-glow btn-sm"
                onClick={handleOpenScheduleReview}
                style={{ gap: '0.4rem', height: '34px', padding: '0 0.9rem' }}
              >
                <Plus size={15} />
                <span>Schedule Review</span>
              </button>
            </div>
          </div>

          {/* Reviews List */}
          {filteredReviews.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Review Title</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Department & Batch</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Scheduled Date</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Submission Deadline</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Max Marks</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map((rev) => {
                    const deptName = rev.department?.name || rev.department?.code || 'Department Batch';
                    const yr = rev.yearOfStudy || 4;

                    return (
                      <tr key={rev._id || rev.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s ease' }}>
                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{rev.title}</div>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.825rem' }}>
                            {deptName}
                          </div>
                          <span className="hero-pill-badge" style={{ margin: '0.2rem 0 0 0', padding: '0.1rem 0.45rem', fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.12)', color: '#818CF8' }}>
                            Batch {rev.batch || '2023-2027'} • Year {yr}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Calendar size={13} style={{ color: 'var(--primary)' }} />
                            <span>{new Date(rev.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Clock size={13} style={{ color: '#F59E0B' }} />
                            <span>{new Date(rev.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {rev.maxMarks || 50} pts
                        </td>

                        <td style={{ padding: '0.85rem' }}>
                          <span className={`project-status-badge ${
                            rev.status === 'COMPLETED' 
                              ? 'status-completed' 
                              : (rev.status === 'ONGOING' || rev.status === 'IN_PROGRESS')
                                ? 'status-active'
                                : rev.status === 'POSTPONED'
                                  ? 'status-revision'
                                  : 'status-in-progress'
                          }`} style={{
                            fontSize: '0.68rem',
                            ...(rev.status === 'ONGOING' || rev.status === 'IN_PROGRESS' ? {
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10B981',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            } : {})
                          }}>
                            {rev.status || 'SCHEDULED'}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => handleOpenRescheduleReview(rev)}
                              className="btn-aesthetic btn-glass-secondary btn-sm"
                              style={{ padding: '0.3rem 0.55rem', height: '28px', fontSize: '0.75rem', gap: '0.3rem' }}
                              title="Reschedule (postpone or prepone date/time)"
                            >
                              <Clock size={13} />
                              <span>Reschedule</span>
                            </button>
                            <button
                              onClick={() => setDeleteConfirmation({
                                type: 'review',
                                id: rev._id || rev.id,
                                title: rev.title,
                                prompt: `Are you sure you want to delete review "${rev.title}"? All deliverables and evaluation records for this review will be removed.`
                              })}
                              className="btn-aesthetic btn-sm"
                              style={{ padding: '0.3rem 0.5rem', height: '28px', background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                              title="Delete review"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
              {!isReviewActive ? (
                <>
                  <Filter size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--primary)', opacity: 0.8 }} />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>Select a Filter to View Reviews</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto' }}>
                    Choose a Batch ("All Batches") or Department from the dropdown filters above to inspect scheduled academic reviews.
                  </p>
                </>
              ) : (
                <>
                  <Award size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--primary)', opacity: 0.8 }} />
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>No Reviews Scheduled For This Filter</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem', marginBottom: '1.25rem' }}>
                    Schedule Review 0, Review 1, or Final Viva reviews for this Department and Year of Study.
                  </p>
                  <button 
                    className="btn-aesthetic btn-primary-glow btn-sm"
                    onClick={handleOpenScheduleReview}
                  >
                    <Plus size={15} />
                    <span>Schedule Review</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: ASSIGN / CHANGE GUIDE MODAL (PROMPT & PRE-APPROVAL CAPABLE)
          ========================================================================= */}
      {assignGuideModalProject && (
        <div className="ai-modal-overlay" onClick={() => setAssignGuideModalProject(null)}>
          <div className="ai-modal-box" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserCheck size={18} style={{ color: 'var(--primary)' }} />
                  Assign Faculty Guide to Project Team
                </h3>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(assignGuideModalProject.status)
                    ? 'Update assigned faculty guide (transfers project supervision)'
                    : 'Pre-assign guide before faculty proposal review'}
                </p>
              </div>
              <button 
                className="btn-ghost-icon" 
                onClick={() => setAssignGuideModalProject(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* Target Project Card */}
              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Target Project Team</div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {assignGuideModalProject.title}
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.775rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span>Lead: <strong style={{ color: 'var(--text-main)' }}>{assignGuideModalProject.leadName || 'Student'}</strong></span>
                  <span>Dept: <strong style={{ color: 'var(--text-main)' }}>{assignGuideModalProject.department?.name || assignGuideModalProject.department || 'CSE'}</strong></span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    Proposal Status: {renderProjectStatusBadge(assignGuideModalProject, true)}
                  </span>
                </div>
              </div>

              {/* Faculty Selector List */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.5rem' }}>
                  Select Institutional Faculty Guide ({faculty.length} Available)
                </label>
                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
                  {faculty.map((f) => {
                    const isSelected = selectedGuideForAssign && String(selectedGuideForAssign._id) === String(f._id);
                    const activeCount = getFacultyActiveCount(f);
                    const maxQuota = f.maxProjects || 2;
                    const currentGuideId = assignGuideModalProject?.guide?._id || assignGuideModalProject?.guide;
                    const isCurrentGuide = String(currentGuideId) === String(f._id);
                    const isFull = !isCurrentGuide && activeCount >= maxQuota;

                    return (
                      <div
                        key={f._id || f.id}
                        onClick={() => {
                          if (!isFull) {
                            setSelectedGuideForAssign(f);
                          }
                        }}
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : isFull ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: isFull ? 'not-allowed' : 'pointer',
                          opacity: isFull ? 0.55 : 1,
                          marginBottom: '0.35rem',
                          transition: 'all 0.15s ease'
                        }}
                        title={isFull ? `Faculty has reached maximum supervision quota (${maxQuota} projects). Cannot allocate.` : `Select ${f.name}`}
                      >
                        <div style={{ flex: 1, minWidth: 0, marginRight: '0.75rem' }}>
                          <div style={{ fontWeight: 700, color: isFull ? 'var(--text-muted)' : 'var(--text-main)', fontSize: '0.85rem' }}>
                            {f.name} {isCurrentGuide && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>(Current Guide)</span>}
                          </div>
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                            {f.facultyId} • {f.designation || 'Assistant Professor'} • {f.department?.name || f.department?.code || 'Dept'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {isFull ? (
                            <span style={{ 
                              fontSize: '0.72rem', 
                              fontWeight: 700, 
                              color: '#EF4444',
                              background: 'rgba(239, 68, 68, 0.12)',
                              padding: '0.22rem 0.55rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              whiteSpace: 'nowrap'
                            }}>
                              Quota Full ({activeCount}/{maxQuota})
                            </span>
                          ) : (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 700, 
                              color: 'var(--text-muted)',
                              background: 'var(--bg-glass)',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              {activeCount} / {maxQuota} Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pre-Approval Status Reminder */}
              <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                {['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(assignGuideModalProject.status) ? (
                  <>
                    💡 <strong>Supervisor Update Note:</strong> This project proposal is <span style={{ color: 'var(--success)', fontWeight: 700 }}>Approved</span>. Assigning a new guide will seamlessly transfer active supervision and review oversight to the selected faculty member.
                  </>
                ) : (
                  <>
                    💡 <strong>Pre-Approval Workflow Note:</strong> Assigning a guide keeps the proposal in <span style={{ color: '#F59E0B', fontWeight: 700 }}>Pending Approval</span> status. The assigned faculty member can review the proposal with AI and click "Approve Proposal" in their faculty portal.
                  </>
                )}
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button 
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={() => setAssignGuideModalProject(null)}
              >
                Cancel
              </button>
              <button
                className="btn-aesthetic btn-primary-glow btn-sm"
                onClick={handleConfirmGuideAssignment}
                disabled={
                  !selectedGuideForAssign ||
                  isAssigningGuide ||
                  (String(assignGuideModalProject?.guide?._id || assignGuideModalProject?.guide) !== String(selectedGuideForAssign._id) &&
                    getFacultyActiveCount(selectedGuideForAssign) >= (selectedGuideForAssign.maxProjects || 2))
                }
              >
                {isAssigningGuide ? <ProjIntelSpinner size="xs" inline label="Assigning Guide..." /> : `Confirm Assign Guide (${selectedGuideForAssign?.name || 'Select One'})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ADD / EDIT STUDENT MODAL
          ========================================================================= */}
      {(isAddStudentOpen || editStudentData) && (
        <div className="ai-modal-overlay" onClick={() => { setIsAddStudentOpen(false); setEditStudentData(null); }}>
          <div className="ai-modal-box" style={{ maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={18} style={{ color: 'var(--primary)' }} />
                  {editStudentData ? 'Edit Student Account' : 'Provision New Student Account'}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Institutional student database record entry
                </p>
              </div>
              <button 
                className="btn-ghost-icon" 
                onClick={() => { setIsAddStudentOpen(false); setEditStudentData(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="ai-modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1.25rem 1.5rem 1rem 1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kumar K"
                  value={studentFormData.name}
                  onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                  className="aesthetic-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Register Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 913123104144"
                    value={studentFormData.regNo}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (!editStudentData && (!studentFormData.password || studentFormData.password === studentFormData.regNo)) {
                        setStudentFormData({ ...studentFormData, regNo: e.target.value, password: val });
                      } else {
                        setStudentFormData({ ...studentFormData, regNo: e.target.value });
                      }
                    }}
                    className="aesthetic-input"
                    style={{ width: '100%', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Student Batch *</label>
                  <select
                    value={studentFormData.batch || activeBatchesList[0]}
                    onChange={(e) => {
                      const b = e.target.value;
                      const y = calculateYearOfStudy(b);
                      setStudentFormData({ ...studentFormData, batch: b, yearOfStudy: y });
                    }}
                    className="aesthetic-input"
                    style={{ width: '100%', height: '38px', padding: '0 2.2rem 0 0.85rem' }}
                  >
                    {(editStudentData && editStudentData.batch && !activeBatchesList.includes(editStudentData.batch)
                      ? [editStudentData.batch, ...activeBatchesList]
                      : activeBatchesList
                    ).map(b => (
                      <option key={b} value={b}>
                        Batch {b.replace('-', ' - ')} (Year {calculateYearOfStudy(b)})
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.7rem', color: '#10B981', display: 'block', marginTop: '0.2rem' }}>
                    Auto-set: Year {calculateYearOfStudy(studentFormData.batch || activeBatchesList[0])} ({currentAcademicYear})
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Institutional Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. student@vcet.ac.in"
                  value={studentFormData.email}
                  onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value })}
                  className="aesthetic-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Department *</label>
                <select
                  value={studentFormData.department}
                  onChange={(e) => setStudentFormData({ ...studentFormData, department: e.target.value })}
                  className="aesthetic-input"
                  style={{ width: '100%', height: '38px', padding: '0 2.2rem 0 0.85rem' }}
                >
                  {departments.map(d => (
                    <option key={d._id || d.name} value={d._id || d.name}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {editStudentData ? 'Change / Reset Password' : 'Login Password *'}
                  </label>
                  {editStudentData && (
                    <button
                      type="button"
                      onClick={() => setStudentFormData({ ...studentFormData, password: studentFormData.regNo || '' })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        textDecoration: 'underline'
                      }}
                    >
                      Reset to Reg. No.
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    placeholder={editStudentData ? 'Leave blank to keep unchanged, or enter new password' : (studentFormData.regNo || 'Default: student register number')}
                    value={studentFormData.password}
                    onChange={(e) => setStudentFormData({ ...studentFormData, password: e.target.value })}
                    className="aesthetic-input"
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword(!showStudentPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={showStudentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showStudentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {editStudentData 
                    ? 'Admins can update or reset student passwords at any time upon physical in-person request.'
                    : 'Default password is the student\'s Register Number. Students log in using Register Number and can change it later.'}
                </p>
              </div>
            </div>

            <div className="ai-modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: 'var(--bg-card)', flexShrink: 0 }}>
              <button 
                type="button"
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={() => { setIsAddStudentOpen(false); setEditStudentData(null); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-aesthetic btn-primary-glow btn-sm"
              >
                {editStudentData ? 'Save Changes' : 'Create Student Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* =========================================================================
          MODAL 3: ADD / EDIT FACULTY MODAL
          ========================================================================= */}
      {(isAddFacultyOpen || editFacultyData) && (
        <div className="ai-modal-overlay" onClick={() => { setIsAddFacultyOpen(false); setEditFacultyData(null); }}>
          <div className="ai-modal-box" style={{ maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Briefcase size={18} style={{ color: 'var(--primary)' }} />
                  {editFacultyData ? 'Edit Faculty Account' : 'Provision New Faculty Guide Account'}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Institutional faculty mentor directory record entry
                </p>
              </div>
              <button 
                className="btn-ghost-icon" 
                onClick={() => { setIsAddFacultyOpen(false); setEditFacultyData(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFaculty} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="ai-modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1.25rem 1.5rem 1rem 1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Faculty Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. S. Kavitha"
                  value={facultyFormData.name}
                  onChange={(e) => setFacultyFormData({ ...facultyFormData, name: e.target.value })}
                  className="aesthetic-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Faculty / Staff ID *</label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="e.g. FACCSE01"
                    value={facultyFormData.facultyId}
                    onChange={(e) => {
                      const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                      setFacultyFormData({ ...facultyFormData, facultyId: cleaned });
                    }}
                    className="aesthetic-input"
                    style={{ width: '100%', fontFamily: 'monospace', textTransform: 'uppercase' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Uppercase alphanumeric, max 8 chars</span>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Max Projects Quota *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="1 - 6"
                    value={facultyFormData.maxProjects}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      if (cleaned === '') {
                        setFacultyFormData({ ...facultyFormData, maxProjects: '' });
                      } else {
                        const num = parseInt(cleaned, 10);
                        if (num <= 6) {
                          setFacultyFormData({ ...facultyFormData, maxProjects: num });
                        }
                      }
                    }}
                    className="aesthetic-input"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Strictly numeric (Max 6 projects)</span>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Institutional Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. faculty@vcet.edu.in"
                  value={facultyFormData.email}
                  onChange={(e) => setFacultyFormData({ ...facultyFormData, email: e.target.value })}
                  className="aesthetic-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Department *</label>
                  <select
                    value={facultyFormData.department}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, department: e.target.value })}
                    className="aesthetic-input"
                    style={{ width: '100%', height: '38px', padding: '0 2.2rem 0 0.85rem' }}
                  >
                    {departments.map(d => (
                      <option key={d._id || d.name} value={d._id || d.name}>
                        {d.code || d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Designation *</label>
                  <select
                    value={facultyFormData.designation}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, designation: e.target.value })}
                    className="aesthetic-input"
                    style={{ width: '100%', height: '38px', padding: '0 2.2rem 0 0.85rem' }}
                  >
                    {FACULTY_DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {editFacultyData ? 'Change / Reset Password' : 'Initial Password *'}
                  </label>
                  {editFacultyData && (
                    <button
                      type="button"
                      onClick={() => setFacultyFormData({ ...facultyFormData, password: 'Password@123' })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        textDecoration: 'underline'
                      }}
                    >
                      Reset to Password@123
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showFacultyPassword ? 'text' : 'password'}
                    placeholder={editFacultyData ? 'Leave blank to keep unchanged, or enter new password' : 'Password@123'}
                    value={facultyFormData.password}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, password: e.target.value })}
                    className="aesthetic-input"
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFacultyPassword(!showFacultyPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={showFacultyPassword ? 'Hide password' : 'Show password'}
                  >
                    {showFacultyPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {editFacultyData 
                    ? 'Admins can update or reset faculty passwords at any time upon physical in-person request.'
                    : 'Default password is Password@123. Faculty can change it after logging in.'}
                </p>
              </div>
            </div>

            <div className="ai-modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: 'var(--bg-card)', flexShrink: 0 }}>
              <button 
                type="button"
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={() => { setIsAddFacultyOpen(false); setEditFacultyData(null); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-aesthetic btn-primary-glow btn-sm"
              >
                {editFacultyData ? 'Save Changes' : 'Create Faculty Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* =========================================================================
          MODAL 4: SCHEDULE / RESCHEDULE COHORT REVIEW MODAL (POSTPONE/PREPONE)
          ========================================================================= */}
      {(isScheduleReviewOpen || rescheduleReviewData) && (
        <div className="ai-modal-overlay" onClick={() => { setIsScheduleReviewOpen(false); setRescheduleReviewData(null); }}>
          <div className="ai-modal-box" style={{ maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={18} style={{ color: 'var(--primary)' }} />
                  {rescheduleReviewData ? 'Reschedule Department Review' : 'Schedule Department Review'}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {rescheduleReviewData ? 'Postpone or prepone review date and instructions' : 'Set review schedule for department and year of study'}
                </p>
              </div>
              <button 
                className="btn-ghost-icon" 
                onClick={() => { setIsScheduleReviewOpen(false); setRescheduleReviewData(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveReview} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Review Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Review 1 - SRS & System Architecture Review"
                    value={reviewFormData.title || ''}
                    onChange={(e) => setReviewFormData({ ...reviewFormData, title: e.target.value })}
                    className="aesthetic-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Department *</label>
                    <select
                      required
                      value={reviewFormData.department || ''}
                      onChange={(e) => setReviewFormData({ ...reviewFormData, department: e.target.value })}
                      className="aesthetic-input"
                      style={{ width: '100%', height: '38px', padding: '0 2.2rem 0 0.85rem' }}
                    >
                      <option value="" disabled>-- Select Department --</option>
                      {departments.map(d => (
                        <option key={d._id || d.name} value={d._id || d.name}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Target Student Batch *</label>
                    <select
                      required
                      value={reviewFormData.batch || ''}
                      onChange={(e) => {
                        const b = e.target.value;
                        const y = b ? calculateYearOfStudy(b) : '';
                        setReviewFormData({ ...reviewFormData, batch: b, yearOfStudy: y });
                      }}
                      className="aesthetic-input"
                      style={{ width: '100%', height: '38px', padding: '0 2.2rem 0 0.85rem' }}
                    >
                      <option value="" disabled>-- Select Batch --</option>
                      {activeBatchesList.map(b => (
                        <option key={b} value={b}>
                          Batch {b.replace('-', ' - ')} (Year {calculateYearOfStudy(b)})
                        </option>
                      ))}
                    </select>
                    {reviewFormData.batch ? (
                      <span style={{ fontSize: '0.7rem', color: '#10B981', display: 'block', marginTop: '0.2rem' }}>
                        Auto-set: Year {calculateYearOfStudy(reviewFormData.batch)} ({currentAcademicYear})
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', marginTop: '0.2rem' }}>
                        Select batch to auto-set year of study
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Scheduled Review Date *</label>
                    <input
                      type="date"
                      required
                      min={getMinScheduledDate()}
                      value={reviewFormData.scheduledDate || ''}
                      onChange={(e) => handleScheduledDateChange(e.target.value)}
                      className="aesthetic-input"
                      style={{ width: '100%' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Assumed for the entire day</span>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Submission Deadline *</label>
                    <input
                      type="date"
                      disabled
                      readOnly
                      value={reviewFormData.deadline || ''}
                      className="aesthetic-input"
                      style={{ width: '100%', opacity: 0.85, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.05)' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: reviewFormData.deadline ? '#10B981' : 'var(--text-muted)' }}>
                      {reviewFormData.deadline ? 'Auto-set to 1 day prior to review' : 'Auto-calculated when review date is set'}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Max Marks *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="e.g. 50"
                    value={reviewFormData.maxMarks ?? ''}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      if (cleaned === '') {
                        setReviewFormData({ ...reviewFormData, maxMarks: '' });
                      } else {
                        const num = parseInt(cleaned, 10);
                        if (num <= 100) {
                          setReviewFormData({ ...reviewFormData, maxMarks: num });
                        }
                      }
                    }}
                    className="aesthetic-input"
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Strictly numeric (Maximum 100 marks)</span>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>Instructions & Deliverables Guidance</label>
                  <textarea
                    rows={3}
                    value={reviewFormData.instructions || ''}
                    onChange={(e) => setReviewFormData({ ...reviewFormData, instructions: e.target.value })}
                    className="aesthetic-input"
                    style={{ width: '100%', resize: 'vertical' }}
                    placeholder="Outline required presentation slides, prototype demo, and report guidelines..."
                  />
                </div>

                {rescheduleReviewData && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', fontSize: '0.75rem', color: '#F59E0B', marginBottom: '0.5rem' }}>
                    ⏱ <strong>Reschedule Notice:</strong> Updating the date, deadline, and instructions will automatically reflect across the portals of all matching students and faculty members in this batch.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', padding: '0.85rem 1.5rem', background: 'var(--bg-card)', flexShrink: 0 }}>
                <button 
                  type="button"
                  className="btn-aesthetic btn-glass-secondary btn-sm"
                  onClick={() => { setIsScheduleReviewOpen(false); setRescheduleReviewData(null); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-aesthetic btn-primary-glow btn-sm"
                >
                  {rescheduleReviewData ? 'Save & Reschedule Review' : 'Schedule Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: DELETE CONFIRMATION MODAL
          ========================================================================= */}
      {deleteConfirmation && (
        <div className="ai-modal-overlay" onClick={() => setDeleteConfirmation(null)}>
          <div className="ai-modal-box" style={{ maxWidth: '420px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#EF4444', marginBottom: '0.75rem' }}>
              <AlertTriangle size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Confirm Deletion</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              {deleteConfirmation.prompt}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button 
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={() => setDeleteConfirmation(null)}
              >
                Cancel
              </button>
              <button
                className="btn-aesthetic btn-sm"
                style={{ background: '#EF4444', color: '#fff', border: 'none' }}
                onClick={executeDelete}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: PROJECT MASTER DOSSIER MODAL
          ========================================================================= */}
      {dossierProject && (
        <div className="ai-modal-overlay" onClick={() => setDossierProject(null)}>
          <div className="ai-modal-box" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="hero-pill-badge" style={{ margin: 0, padding: '0.15rem 0.55rem', fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                  Institutional Project Dossier
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-main)' }}>
                  {dossierProject.title}
                </h3>
              </div>
              <button 
                className="btn-ghost-icon" 
                onClick={() => setDossierProject(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* Status Header Banner */}
              {dossierProject.status === 'COMPLETED' ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10B981', fontWeight: 800, fontSize: '0.95rem' }}>
                    <CheckCircle2 size={18} />
                    <span>Project Officially Certified & Completed</span>
                  </div>
                  <p style={{ color: 'var(--text-main)', fontSize: '0.825rem', marginTop: '0.35rem', lineHeight: 1.5 }}>
                    {dossierProject.completionRemarks || 'Faculty guide has verified all deliverables and signed off this project as fully completed.'}
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Guide: <strong style={{ color: 'var(--text-main)' }}>{dossierProject.certifiedByGuideName || dossierProject.guideName || 'Faculty Guide'}</strong></span>
                    {dossierProject.completedAt && (
                      <span>Completed on: <strong style={{ color: 'var(--text-main)' }}>{new Date(dossierProject.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Milestone Execution Progress</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{dossierProject.progress || 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${dossierProject.progress || 0}%`, height: '100%', background: 'var(--gradient-primary)', borderRadius: '4px' }} />
                  </div>
                </div>
              )}

              {/* Meta Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'var(--bg-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Batch</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '0.15rem' }}>{dossierProject.batch || '2023-2027'}</div>
                </div>

                <div style={{ background: 'var(--bg-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Academic Year</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '0.15rem' }}>{dossierProject.academicYear || currentAcademicYear}</div>
                </div>

                <div style={{ background: 'var(--bg-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Department</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '0.15rem' }}>{dossierProject.department?.name || dossierProject.department || 'CSE'}</div>
                </div>

                <div style={{ background: 'var(--bg-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Faculty Guide</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem', marginTop: '0.15rem' }}>{dossierProject.guideName || (typeof dossierProject.guide === 'object' ? dossierProject.guide?.name : dossierProject.guide) || 'Not Assigned'}</div>
                </div>
              </div>

              {/* Team Lead & Members */}
              {(() => {
                const allRosterMembers = (Array.isArray(dossierProject.rawTeamMembers) && dossierProject.rawTeamMembers.length > 0)
                  ? dossierProject.rawTeamMembers
                  : (Array.isArray(dossierProject.teamMembers) && dossierProject.teamMembers.length > 0
                      ? dossierProject.teamMembers
                      : (dossierProject.members || []));

                const dossierLeadName = dossierProject.leadName || (typeof allRosterMembers[0] === 'object' ? allRosterMembers[0]?.name : allRosterMembers[0]) || 'Student Lead';
                let dossierLeadReg = dossierProject.leadRegNo || dossierProject.regNo || (typeof allRosterMembers[0] === 'object' ? allRosterMembers[0]?.regNo : '') || '';
                let dossierLeadEmail = dossierProject.leadEmail || dossierProject.email || (typeof allRosterMembers[0] === 'object' ? allRosterMembers[0]?.email : '') || '';

                if (!dossierLeadReg || !dossierLeadEmail) {
                  const leadStud = students.find(s => 
                    (dossierProject.leadStudentId && (String(s._id) === String(dossierProject.leadStudentId) || String(s.id) === String(dossierProject.leadStudentId))) ||
                    (dossierLeadName && s.name && s.name.toLowerCase().trim() === String(dossierLeadName).toLowerCase().trim())
                  );
                  if (leadStud) {
                    if (!dossierLeadReg) dossierLeadReg = leadStud.regNo || '';
                    if (!dossierLeadEmail) dossierLeadEmail = leadStud.email || '';
                  }
                }

                const otherTeamMembers = allRosterMembers.filter((m, idx) => {
                  const mName = typeof m === 'object' ? (m.name || m.student?.name) : String(m);
                  const mReg = typeof m === 'object' ? (m.regNo || m.student?.regNo) : '';
                  const mId = typeof m === 'object' ? String(m._id || m.id || '') : '';

                  if (dossierProject.leadStudentId && mId && mId === String(dossierProject.leadStudentId)) return false;
                  if (dossierLeadReg && mReg && mReg.toLowerCase().trim() === dossierLeadReg.toLowerCase().trim()) return false;
                  if (dossierLeadName && mName && mName.toLowerCase().trim() === dossierLeadName.toLowerCase().trim()) return false;
                  return idx > 0;
                });

                const totalRosterCount = 1 + otherTeamMembers.length;

                return (
                  <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Student Team Roster
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                        {totalRosterCount} {totalRosterCount === 1 ? 'Member (Solo)' : 'Members Total'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: otherTeamMembers.length > 0 ? '0.65rem' : '0' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                        {(dossierLeadName || 'L').charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                          {dossierLeadName} <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}>(Project Lead)</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          Reg: {dossierLeadReg || 'N/A'} {dossierLeadEmail ? `• ${dossierLeadEmail}` : ''}
                        </div>
                      </div>
                    </div>

                    {otherTeamMembers.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                          Additional Team Member{otherTeamMembers.length > 1 ? `s (${otherTeamMembers.length})` : ''}:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {otherTeamMembers.map((m, idx) => {
                            const mName = typeof m === 'object' ? (m.name || m.student?.name) : m;
                            let mReg = typeof m === 'object' ? (m.regNo || m.student?.regNo) : '';
                            if (!mReg && typeof m === 'string') {
                              const foundPeer = students.find(s => s.name && s.name.toLowerCase().trim() === m.toLowerCase().trim());
                              if (foundPeer) mReg = foundPeer.regNo || '';
                            }
                            return (
                              <span key={idx} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                                {mName} {mReg ? `(${mReg})` : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Description / Synopsis */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Project Synopsis & Abstract</div>
                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {dossierProject.description || dossierProject.abstract || 'No detailed abstract recorded for this project.'}
                </div>
              </div>

              {/* Milestones Verification Summary */}
              {dossierProject.milestones && dossierProject.milestones.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Milestone Stages & Verification Sign-Offs</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {dossierProject.milestones.map((m, idx) => {
                      const isDone = m.isVerified || m.status === 'COMPLETED';
                      return (
                        <div key={m._id || idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.65rem 0.85rem',
                          background: isDone ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-glass)',
                          border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}`,
                          borderRadius: 'var(--radius-sm)'
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--text-main)' }}>
                              Stage {idx + 1}: {m.title}
                            </div>
                            {m.dueDate && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                Due: {new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            )}
                          </div>
                          <div>
                            {isDone ? (
                              <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle2 size={13} /> Verified & Signed Off ✓
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Incomplete
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={() => setDossierProject(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
      {/* =========================================================================
          MODAL: ACADEMIC YEAR TRANSITION CONFIRMATION
          ========================================================================= */}
      {yearTransitionModal.isOpen && (
        <div className="ai-modal-overlay" onClick={() => !isTransitioningYear && setYearTransitionModal({ isOpen: false, targetYear: '', transitionType: 'INCREMENT' })}>
          <div className="ai-modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#F59E0B' }}>
                  <AlertTriangle size={18} />
                  Confirm Academic Cycle Transition
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Major institutional administrative state update
                </p>
              </div>
              {!isTransitioningYear && (
                <button
                  className="btn-ghost-icon"
                  onClick={() => setYearTransitionModal({ isOpen: false, targetYear: '', transitionType: 'INCREMENT' })}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* Transition Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Current Year</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.15rem' }}>{currentAcademicYear}</div>
                </div>

                <ArrowRight size={20} style={{ color: 'var(--primary)' }} />

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#10B981', textTransform: 'uppercase', fontWeight: 700 }}>New Academic Year</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10B981', marginTop: '0.15rem' }}>{yearTransitionModal.targetYear}</div>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.5', marginBottom: '1rem' }}>
                {yearTransitionModal.transitionType === 'INCREMENT' ? (
                  <>
                    Are you sure you want to <strong>advance</strong> the institutional academic cycle to <strong>{yearTransitionModal.targetYear}</strong>?
                  </>
                ) : (
                  <>
                    Are you sure you want to <strong>revert</strong> the institutional academic cycle back to <strong>{yearTransitionModal.targetYear}</strong>?
                  </>
                )}
              </div>

              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '1.25rem' }}>
                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>System-Wide Automatic Synchronization:</strong>
                <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
                  <li>Recalculates the <strong>Year of Study</strong> for all registered students across the database.</li>
                  {yearTransitionModal.transitionType === 'INCREMENT' ? (
                    <>
                      <li>Senior batch <strong>Batch {parseInt(yearTransitionModal.targetYear.split('-')[0], 10) - 4}-{parseInt(yearTransitionModal.targetYear.split('-')[0], 10)}</strong> will graduate and move to the <em>Graduated Roster</em>.</li>
                      <li>New freshman batch <strong>Batch {parseInt(yearTransitionModal.targetYear.split('-')[0], 10)}-{parseInt(yearTransitionModal.targetYear.split('-')[0], 10) + 4}</strong> will be enrolled as Year 1.</li>
                      <li>Faculty portals will automatically update to manage the current 4 batches.</li>
                    </>
                  ) : (
                    <>
                      <li>Reverts student batches and restores previous year of study metrics.</li>
                      <li>Batch filters will synchronize back to the {yearTransitionModal.targetYear} academic cycle.</li>
                    </>
                  )}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                <button
                  type="button"
                  disabled={isTransitioningYear}
                  className="btn-aesthetic btn-glass-secondary btn-sm"
                  onClick={() => setYearTransitionModal({ isOpen: false, targetYear: '', transitionType: 'INCREMENT' })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isTransitioningYear}
                  className="btn-aesthetic btn-primary-glow btn-sm"
                  onClick={handleConfirmYearTransition}
                  style={{ gap: '0.4rem' }}
                >
                  {isTransitioningYear && <ProjIntelSpinner size="xs" inline />}
                  <span>{isTransitioningYear ? 'Transitioning System...' : `Confirm & Switch to ${yearTransitionModal.targetYear}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Export Configuration Modal */}
      {isCsvModalOpen && (
        <div className="ai-modal-overlay" onClick={() => setIsCsvModalOpen(false)} style={{ zIndex: 3000 }}>
          <div 
            className="ai-modal-box" 
            style={{ 
              maxWidth: '540px', 
              width: '92%', 
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="ai-modal-header" style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: selectedCsvReportType === 'TEAM_MENTOR' ? 'rgba(99, 102, 241, 0.15)' : selectedCsvReportType === 'FINAL_REPORT' ? 'rgba(16, 185, 129, 0.15)' : selectedCsvReportType === 'IEEE_REPORT' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: selectedCsvReportType === 'TEAM_MENTOR' ? 'var(--primary)' : selectedCsvReportType === 'FINAL_REPORT' ? '#10B981' : selectedCsvReportType === 'IEEE_REPORT' ? '#06b6d4' : '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {selectedCsvReportType === 'TEAM_MENTOR' ? <Users size={18} /> : selectedCsvReportType === 'FINAL_REPORT' ? <Award size={18} /> : selectedCsvReportType === 'IEEE_REPORT' ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {selectedCsvReportType === 'TEAM_MENTOR' && 'Export Team & Mentor Allocation Report'}
                    {selectedCsvReportType === 'FINAL_REPORT' && 'Export Final Evaluation & Marks Report'}
                    {selectedCsvReportType === 'MASTER_ROSTER' && 'Export Master Institutional Projects Roster'}
                    {selectedCsvReportType === 'IEEE_REPORT' && 'Export IEEE Research & Conference Publication Report'}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0.15rem 0 0 0' }}>
                    Configure Academic Year / Batch and Department before exporting
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost-icon"
                onClick={() => setIsCsvModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="ai-modal-body" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem', overflowY: 'auto', flex: 1 }}>
              {/* Report Structure Banner */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem'
              }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.35rem' }}>
                  Institutional Columns &amp; Data Format:
                </div>
                {selectedCsvReportType === 'TEAM_MENTOR' && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    Generates a <strong>4-Column CSV</strong> adhering to Anna University / VCET audit standards:
                    <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.15rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      <li><strong>S.No</strong>: 1 row per team</li>
                      <li><strong>Project Name</strong>: 1 row per team</li>
                      <li><strong>Team Members</strong>: Row based on team size (each student on an individual row)</li>
                      <li><strong>Guide Name</strong>: 1 row per team</li>
                    </ul>
                  </div>
                )}
                {selectedCsvReportType === 'FINAL_REPORT' && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    Generates a <strong>3-Column CSV</strong> for final examination &amp; evaluation records:
                    <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.15rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      <li><strong>S.No</strong>: 1 row per team</li>
                      <li><strong>Project Name</strong>: 1 row per team</li>
                      <li><strong>Final Marks and Grade</strong>: 1 row (displays <strong>Nil</strong> if incomplete or pending evaluation)</li>
                    </ul>
                  </div>
                )}
                {selectedCsvReportType === 'MASTER_ROSTER' && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    Generates a comprehensive <strong>14-Column Master Roster</strong> covering Project Code, Title, Domain, Batch, Department, Lead, RegNo, Team Members, Guide, Milestone Progress, Project Status, Final Marks &amp; Grade.
                  </div>
                )}
                {selectedCsvReportType === 'IEEE_REPORT' && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    Generates a <strong>7-Column IEEE Publication CSV</strong> for research and conference tracking:
                    <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.15rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      <li><strong>S.No</strong>: 1 row per team</li>
                      <li><strong>Team member names</strong>: Row as per team size (each student on an individual row)</li>
                      <li><strong>IEEE paper title</strong>: 1 row per team</li>
                      <li><strong>Name of IEEE conference</strong>: 1 row per team</li>
                      <li><strong>Submission status (Y/N)</strong>: 1 row per team</li>
                      <li><strong>Acceptance status (Y/N)</strong>: 1 row per team</li>
                      <li><strong>Publishment status (Y/N)</strong>: 1 row per team</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Filter 1: Academic Year / Batch */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  Academic Batch / Year of Study:
                </label>
                <select
                  value={csvBatchFilter}
                  onChange={(e) => setCsvBatchFilter(e.target.value)}
                  className="aesthetic-input"
                  style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                >
                  <option value="ALL">All Batches (Institutional Cumulative)</option>
                  <optgroup label={`Active Undergraduate Batches (${currentAcademicYear})`}>
                    {activeBatchesList.map(b => (
                      <option key={b} value={b}>
                        Batch {b.replace('-', ' - ')} (Year {calculateYearOfStudy(b)})
                      </option>
                    ))}
                  </optgroup>
                  {graduatedBatchesList.length > 0 && (
                    <optgroup label="Graduated Batches">
                      {graduatedBatchesList.map(b => (
                        <option key={b} value={b}>
                          🎓 Batch {b.replace('-', ' - ')} (Graduated)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Filter 2: Department */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                  Academic Department:
                </label>
                <select
                  value={csvDeptFilter}
                  onChange={(e) => setCsvDeptFilter(e.target.value)}
                  className="aesthetic-input"
                  style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                >
                  <option value="ALL">All Departments (Institute Wide)</option>
                  {departments.map(d => (
                    <option key={d._id || d.name} value={d.name}>
                      {d.name} {d.code ? `(${d.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Matching Records Counter Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.95rem',
                background: csvMatchingProjectsCount > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${csvMatchingProjectsCount > 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                borderRadius: 'var(--radius-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: csvMatchingProjectsCount > 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                  <CheckCircle2 size={15} />
                  <span>
                    {csvMatchingProjectsCount > 0 
                      ? `${csvMatchingProjectsCount} matching project team${csvMatchingProjectsCount > 1 ? 's' : ''} ready to export`
                      : 'No project teams found for this combination'}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Batch: {csvBatchFilter === 'ALL' ? 'All' : csvBatchFilter} • Dept: {csvDeptFilter === 'ALL' ? 'All' : csvDeptFilter}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="ai-modal-footer" style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.65rem',
              flexShrink: 0
            }}>
              <button
                type="button"
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={() => setIsCsvModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={csvMatchingProjectsCount === 0}
                className="btn-aesthetic btn-primary-glow btn-sm"
                onClick={handleExecuteCsvExport}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  opacity: csvMatchingProjectsCount === 0 ? 0.5 : 1,
                  cursor: csvMatchingProjectsCount === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <Download size={14} />
                <span>Download CSV File</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
