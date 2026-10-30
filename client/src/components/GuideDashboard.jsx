import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  UserCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileCheck, 
  Star, 
  MessageSquare, 
  ChevronRight, 
  BookOpen, 
  Send, 
  AlertCircle, 
  Sparkles, 
  Layers, 
  FileText, 
  Edit3, 
  TrendingUp, 
  X, 
  Plus, 
  ListTodo, 
  CheckSquare, 
  Bot, 
  AlertTriangle, 
  Lightbulb, 
  ShieldAlert, 
  ShieldCheck,
  Calendar,
  Check, 
  RotateCcw,
  Award,
  Download,
  FileArchive,
  Presentation,
  RefreshCw,
  ArrowRight,
  GraduationCap,
  Users,
  Mail,
  Building,
  Archive
} from 'lucide-react';
import AIAssistantDrawer from './AIAssistantDrawer';
import GuideReviewSection from './GuideReviewSection';
import IEEEGuideSection from './IEEEGuideSection';
import ProjIntelSpinner from './ProjIntelSpinner';
import { exportWeeklyProgressReportPDF, exportFacultyCohortWeeklyDossierPDF } from '../utils/pdfExport';
import { 
  analyzeProposal, 
  analyzeFeasibility, 
  explainProjectRisk, 
  analyzeWeeklyReport, 
  generateFacultyFeedback 
} from '../services/aiService';
import { getFileUrl } from '../services/api';

const formatDisplayDate = (d) => {
  if (!d) return 'TBD';
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return String(d);
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getRomanYear = (yr) => {
  const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
  return map[yr] || String(yr);
};

const GuideDashboard = ({ 
  projectsList = [], 
  reviews = [],
  currentUser = null,
  currentGuideName = 'Dr. A. Sharma (HOD)', 
  currentGuideId = 'FAC-102',
  systemSettings = null,
  onApproveProposal, 
  onRequestRevision, 
  onRejectProposal, 
  onGradeWeeklyProgress, 
  onUpdateProject,
  onCompleteProject,
  onReopenProject,
  onVerifyMilestone,
  onUnverifyMilestone,
  onUpdateMilestone,
  onScheduleReview,
  onSaveOfficialEvaluation,
  onAddComment,
  onRefreshAllData
}) => {
  const [activeTab, setActiveTab] = useState('assigned'); // 'reviews' | 'evaluations' | 'assigned' | 'guidance' | 'weekly' | 'documents' | 'ieee'
  const [revisionModalProject, setRevisionModalProject] = useState(null);
  const [revisionNotesText, setRevisionNotesText] = useState('');

  // Dedicated Team Guidance & Group Chats State
  const [selectedChatProjectId, setSelectedChatProjectId] = useState(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedTeamInfoProject, setSelectedTeamInfoProject] = useState(null);
  const chatMessagesEndRef = useRef(null);

  // Track seen comments for faculty across supervised projects
  const [seenFacultyCommentKeys, setSeenFacultyCommentKeys] = useState(() => {
    try {
      const stored = localStorage.getItem(`faculty_seen_comments_${currentUser?._id || currentUser?.id || 'guide'}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Calculate project progress percentage for display
  const calcProjectProgress = (proj) => {
    if (!proj) return 0;
    if (proj.status === 'COMPLETED') return 100;
    if (typeof proj.progress === 'number' && proj.progress > 0) return proj.progress;
    if (Array.isArray(proj.milestones) && proj.milestones.length > 0) {
      const sum = proj.milestones.reduce((acc, m) => acc + (m.progress || 0), 0);
      return Math.round(sum / proj.milestones.length);
    }
    return proj.progress || 0;
  };

  // Calculate unread chat messages for each project (student messages that faculty has not seen)
  const getUnreadChatCountForProject = (proj) => {
    if (!proj || !Array.isArray(proj.comments)) return 0;
    const myName = String(currentGuideName || currentUser?.name || '').toLowerCase().trim();
    const incoming = proj.comments.filter(c => {
      if (c.isGuide === true) return false;
      const author = String(c.author || '').toLowerCase().trim();
      if (author.includes('(faculty guide)') || author.includes('(guide)')) return false;
      if (myName && author.includes(myName)) return false;
      return true;
    });
    return incoming.filter(c => {
      const key = String(c._id || c.id || `${c.author}_${c.time}_${c.text}`);
      return !seenFacultyCommentKeys.includes(key);
    }).length;
  };

  // Student Batch Gatekeeper State (Faculty selects student batch e.g. 2023-2027)
  const defaultAcadYear = systemSettings?.currentAcademicYear || '2026-2027';

  // Compute batch status (Year I..IV or Graduated) dynamically from central academic year
  const getBatchStatus = (batchStr) => {
    if (!batchStr || !batchStr.includes('-')) return { yearNum: 4, isGraduated: false, label: 'Year IV' };
    const parts = batchStr.split('-');
    const bStart = parseInt(parts[0], 10);
    const bEnd = parseInt(parts[1], 10);
    const aStart = parseInt((defaultAcadYear || '2026-2027').split('-')[0], 10);
    if (isNaN(bStart) || isNaN(aStart)) return { yearNum: 4, isGraduated: false, label: 'Year IV' };

    const rawYear = (aStart - bStart) + 1;
    const isGraduated = (!isNaN(bEnd) && aStart >= bEnd) || rawYear > 4;
    if (isGraduated) {
      return { yearNum: 5, isGraduated: true, label: 'Graduated' };
    }
    const clamped = Math.max(1, Math.min(4, rawYear));
    return { yearNum: clamped, isGraduated: false, label: `Year ${getRomanYear(clamped)}` };
  };

  const getYearOfStudy = (batchStr) => getBatchStatus(batchStr).yearNum;

  // Resolve rich team member records for display in Team Details modal
  const resolveTeamMemberList = (project) => {
    if (!project) return [];
    const list = [];
    const rawMembers = (Array.isArray(project.rawTeamMembers) && project.rawTeamMembers.length > 0)
      ? project.rawTeamMembers
      : (Array.isArray(project.teamMembers) && project.teamMembers.length > 0
          ? project.teamMembers
          : (Array.isArray(project.members) ? project.members : []));

    const projectDeptName = project.department?.name || project.dept || (typeof project.department === 'string' ? project.department : 'Computer Science & Engineering');
    const projectBatch = project.batch || '2023-2027';
    const computedYearNum = getYearOfStudy(projectBatch);

    rawMembers.forEach(m => {
      if (typeof m === 'object' && m !== null) {
        const memYr = m.yearOfStudy || m.year || computedYearNum;
        const isMemLead = (project.regNo && m.regNo && project.regNo === m.regNo) ||
                          (project.leadName && m.name && project.leadName.toLowerCase() === m.name.toLowerCase()) ||
                          (project.leadStudentId && String(m._id || m.id) === String(project.leadStudentId));

        const memEmail = m.email || (isMemLead ? (project.leadEmail || project.email) : '') || '—';

        list.push({
          id: m._id || m.id || m.regNo || m.name,
          name: m.name || 'Student Member',
          regNo: m.regNo || '—',
          email: memEmail,
          yearOfStudy: memYr,
          departmentName: m.department?.name || m.department?.code || (typeof m.department === 'string' ? m.department : projectDeptName),
          batch: m.batch || projectBatch,
          isLead: isMemLead
        });
      } else if (typeof m === 'string') {
        const isStrLead = project.leadName && project.leadName.toLowerCase() === m.toLowerCase();
        list.push({
          id: m,
          name: m,
          regNo: isStrLead ? (project.regNo || '—') : '—',
          email: isStrLead ? (project.leadEmail || project.email || '—') : '—',
          yearOfStudy: computedYearNum,
          departmentName: projectDeptName,
          batch: projectBatch,
          isLead: isStrLead
        });
      }
    });

    // Ensure leader is included
    if (project.leadName && !list.some(m => m.name.toLowerCase() === project.leadName.toLowerCase() || (project.regNo && m.regNo === project.regNo))) {
      list.unshift({
        id: project.leadStudentId || 'lead',
        name: project.leadName,
        regNo: project.regNo || '—',
        email: project.email || project.leadEmail || '—',
        yearOfStudy: computedYearNum,
        departmentName: projectDeptName,
        batch: projectBatch,
        isLead: true
      });
    }

    if (!list.some(m => m.isLead) && list.length > 0) {
      list[0].isLead = true;
    }

    return list;
  };

  // Available cohorts list: Strictly the 4 active undergraduate cohorts for the current academic year
  // Faculties always manage the current 4 active batches; graduated cohorts are excluded.
  const availableBatches = useMemo(() => {
    const aStart = parseInt((defaultAcadYear || '2026-2027').split('-')[0], 10);
    if (!isNaN(aStart)) {
      return [
        `${aStart - 3}-${aStart + 1}`, // Year IV (Senior Cohort)
        `${aStart - 2}-${aStart + 2}`, // Year III
        `${aStart - 1}-${aStart + 3}`, // Year II
        `${aStart}-${aStart + 4}`       // Year I (Freshman Cohort)
      ];
    }
    return ['2023-2027', '2024-2028', '2025-2029', '2026-2030'];
  }, [defaultAcadYear]);

  const [rawSelectedBatch, setRawSelectedBatch] = useState(() => localStorage.getItem('faculty_student_batch') || '');
  // Derive selectedBatch safely: if previous batch has graduated or is not active, resolve to empty selection
  const selectedBatch = availableBatches.includes(rawSelectedBatch) ? rawSelectedBatch : '';

  const handleSelectBatch = (batch) => {
    setRawSelectedBatch(batch);
    localStorage.setItem('faculty_student_batch', batch);
  };

  const handleSwitchBatch = () => {
    setRawSelectedBatch('');
    localStorage.removeItem('faculty_student_batch');
  };

  // Sub-filter tabs for Assigned Projects, Weekly Reports, and Documents
  const [assignedStatusFilter, setAssignedStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED'
  const [reportsStatusFilter, setReportsStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED'
  const [docsStatusFilter, setDocsStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED'
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  // Stage Verification Sign-off Modal State
  const [verifyModalData, setVerifyModalData] = useState(null); // { project, milestone }
  const [verifyComments, setVerifyComments] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Project Final Completion Modal State
  const [completeProjectModalData, setCompleteProjectModalData] = useState(null);
  const [completeSignOffNotes, setCompleteSignOffNotes] = useState('');
  const [completeFinalGrade, setCompleteFinalGrade] = useState('A+');
  const [completeFinalScore, setCompleteFinalScore] = useState('92');
  const [isCompletingProject, setIsCompletingProject] = useState(false);

  const handleOpenCompleteProjectModal = (project) => {
    setCompleteProjectModalData(project);
    setCompleteSignOffNotes(project.finalSignOffNotes || '');
    setCompleteFinalGrade(project.finalGrade || 'A+');
    setCompleteFinalScore(project.finalScore ? String(project.finalScore) : '92');
  };

  const handleConfirmCompleteProject = async () => {
    if (!completeProjectModalData) return;
    setIsCompletingProject(true);
    try {
      if (onCompleteProject) {
        await onCompleteProject(
          completeProjectModalData.id || completeProjectModalData._id,
          {
            signOffNotes: completeSignOffNotes.trim(),
            finalNotes: completeSignOffNotes.trim(),
            finalGrade: completeFinalGrade,
            finalScore: completeFinalScore ? Number(completeFinalScore) : null
          }
        );
      }
      setCompleteProjectModalData(null);
      setCompleteSignOffNotes('');
    } catch (err) {
      console.error('Error completing project:', err);
      alert(err.message || 'Failed to complete project.');
    } finally {
      setIsCompletingProject(false);
    }
  };

  const handleConfirmReopenProject = async (project) => {
    if (!window.confirm(`Reopen "${project.title}" back to active in-progress status?`)) return;
    try {
      if (onReopenProject) {
        await onReopenProject(project.id || project._id);
      }
    } catch (err) {
      console.error('Error reopening project:', err);
      alert(err.message || 'Failed to reopen project.');
    }
  };

  const handleOpenVerifyModal = (project, milestone) => {
    setVerifyModalData({ project, milestone });
    setVerifyComments(milestone.guideComments || '');
  };

  const handleConfirmVerify = async () => {
    if (!verifyModalData) return;
    setIsVerifying(true);
    try {
      if (onVerifyMilestone) {
        await onVerifyMilestone(
          verifyModalData.project.id || verifyModalData.project._id,
          verifyModalData.milestone.id || verifyModalData.milestone._id,
          { guideComments: verifyComments.trim() }
        );
      }
      setVerifyModalData(null);
      setVerifyComments('');
    } catch (err) {
      console.error('Verify milestone error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmUnverify = async (project, milestone) => {
    if (!window.confirm(`Revoke verification for Stage ${milestone.number}: "${milestone.title}"?\n\nThis will restore the milestone progress based on its task completion.`)) {
      return;
    }
    try {
      if (onUnverifyMilestone) {
        await onUnverifyMilestone(project.id || project._id, milestone.id || milestone._id);
      }
    } catch (err) {
      console.error('Error undoing milestone verification:', err);
    }
  };

  // Live Cloud Synchronization State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      if (onRefreshAllData) {
        await onRefreshAllData();
      }
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn('Guide sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (onRefreshAllData) {
      onRefreshAllData().catch(() => {});
    }
  };

  const [feedbackInputs, setFeedbackInputs] = useState({});
  const [commentInputs, setCommentInputs] = useState({});

  // AI Assistant Drawer State
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');

  // AI Proposal Analysis Modal
  const [proposalModalProject, setProposalModalProject] = useState(null);
  const [proposalAnalysisData, setProposalAnalysisData] = useState(null);
  const [isAnalyzingProposal, setIsAnalyzingProposal] = useState(false);

  // AI Feasibility Modal
  const [feasibilityModalProject, setFeasibilityModalProject] = useState(null);
  const [feasibilityData, setFeasibilityData] = useState(null);
  const [isAnalyzingFeasibility, setIsAnalyzingFeasibility] = useState(false);

  // AI Risk Explanation Modal
  const [riskModalProject, setRiskModalProject] = useState(null);
  const [riskExplanationData, setRiskExplanationData] = useState(null);
  const [isExplainingRisk, setIsExplainingRisk] = useState(false);

  // AI Weekly Report Analysis Modal
  const [reportModalData, setReportModalData] = useState(null);
  const [reportAnalysisData, setReportAnalysisData] = useState(null);
  const [isAnalyzingReport, setIsAnalyzingReport] = useState(false);

  // AI Feedback Generator State
  const [generatingFeedbackFor, setGeneratingFeedbackFor] = useState(null);
  const [generatedFeedbackResult, setGeneratedFeedbackResult] = useState(null);

  // Filter projects and reviews for the selected student batch strictly within the current academic cycle
  const cohortProjects = useMemo(() => {
    if (!selectedBatch) return [];
    return projectsList.filter(p => {
      const hasMembers = (Array.isArray(p.rawTeamMembers) && p.rawTeamMembers.length > 0) ||
                         (Array.isArray(p.teamMembers) && p.teamMembers.length > 0);
      if (!hasMembers) return false;
      const pAcad = p.academicYear || defaultAcadYear;
      if (pAcad !== defaultAcadYear) return false;
      const pBatch = p.batch || '2023-2027';
      return pBatch === selectedBatch;
    });
  }, [projectsList, selectedBatch, defaultAcadYear]);

  const cohortReviews = useMemo(() => {
    if (!selectedBatch) return [];
    return reviews.filter(r => {
      const rAcad = r.academicYear || defaultAcadYear;
      if (rAcad !== defaultAcadYear) return false;
      const rBatch = r.batch || '2023-2027';
      return rBatch === selectedBatch;
    });
  }, [reviews, selectedBatch, defaultAcadYear]);

  // Centralized guide assignment check: Returns true ONLY if the project is explicitly assigned to this logged-in faculty member
  const isProjectAssignedToMe = useCallback((p) => {
    if (!p) return false;
    const pGuideObj = (typeof p.guide === 'object' && p.guide !== null) ? p.guide : null;
    const hasAnyGuide = Boolean(
      p.guideId ||
      p.guideName ||
      p.guideEmail ||
      (typeof p.guide === 'string' && p.guide.trim()) ||
      (pGuideObj && (pGuideObj._id || pGuideObj.facultyId || pGuideObj.staffId || pGuideObj.name || pGuideObj.email))
    );
    // If project has no guide assigned at all, it belongs strictly in Admin Guide Allocation roster!
    if (!hasAnyGuide) return false;

    // Collect all candidate IDs for the logged in guide
    const myIds = [
      currentGuideId,
      currentUser?._id,
      currentUser?.id,
      currentUser?.facultyId,
      currentUser?.staffId
    ].filter(Boolean).map(String);

    // Collect all candidate IDs for the project's guide
    const projectGuideIds = [
      p.guideId,
      pGuideObj?._id,
      pGuideObj?.facultyId,
      pGuideObj?.staffId,
      pGuideObj?.id,
      typeof p.guide === 'string' ? p.guide : null
    ].filter(Boolean).map(String);

    // 1. Any ID match
    const idMatch = myIds.some(myId => projectGuideIds.includes(myId));
    if (idMatch) return true;

    // 2. Email match
    const myEmail = String(currentUser?.email || '').toLowerCase().trim();
    const projectGuideEmail = String(p.guideEmail || pGuideObj?.email || '').toLowerCase().trim();
    if (myEmail && projectGuideEmail && myEmail === projectGuideEmail) return true;

    // 3. Name match
    const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const curGuideName = clean(currentGuideName || currentUser?.name || '');
    const pGuideName = clean(p.guideName || pGuideObj?.name || '');
    if (curGuideName && pGuideName && (
      curGuideName === pGuideName ||
      pGuideName.includes(curGuideName) ||
      curGuideName.includes(pGuideName)
    )) {
      return true;
    }

    return false;
  }, [currentGuideId, currentUser, currentGuideName]);


  // Categorize projects based on Details.md lifecycle states
  // Only proposals that have been assigned to THIS faculty guide appear in their review queue
  const pendingReviews = useMemo(() => {
    return cohortProjects.filter(p => {
      const isPending = p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW';
      return isPending && isProjectAssignedToMe(p);
    });
  }, [cohortProjects, isProjectAssignedToMe]);

  const assignedProjects = useMemo(() => {
    return cohortProjects.filter(p => {
      if (p.status !== 'APPROVED' && p.status !== 'IN_PROGRESS' && p.status !== 'COMPLETED') return false;
      return isProjectAssignedToMe(p);
    });
  }, [cohortProjects, isProjectAssignedToMe]);

  // Past supervised projects from previous academic cycles or graduated cohorts
  const myPastSupervisedProjects = useMemo(() => {
    return projectsList.filter(p => {
      const pAcad = p.academicYear || defaultAcadYear;
      if (pAcad === defaultAcadYear) return false;
      return isProjectAssignedToMe(p);
    });
  }, [projectsList, defaultAcadYear, isProjectAssignedToMe]);

  const activeAssigned = useMemo(() => assignedProjects.filter(p => p.status !== 'COMPLETED'), [assignedProjects]);
  const completedAssigned = useMemo(() => assignedProjects.filter(p => p.status === 'COMPLETED'), [assignedProjects]);
  const awaitingFeedbackAssigned = useMemo(() => {
    return assignedProjects.filter(p => (p.weeklyUpdates || []).some(w => !w.facultyFeedback && !w.feedback));
  }, [assignedProjects]);

  const displayAssigned = useMemo(() => {
    if (assignedStatusFilter === 'ACTIVE') return activeAssigned;
    if (assignedStatusFilter === 'COMPLETED') return completedAssigned;
    if (assignedStatusFilter === 'AWAITING_FEEDBACK') return awaitingFeedbackAssigned;
    return assignedProjects;
  }, [assignedStatusFilter, assignedProjects, activeAssigned, completedAssigned, awaitingFeedbackAssigned]);

  const totalUnreadChatCount = useMemo(() => {
    return assignedProjects.reduce((sum, p) => sum + getUnreadChatCountForProject(p), 0);
  }, [assignedProjects, seenFacultyCommentKeys]);

  // When faculty is viewing guidance tab and has a selected project, mark its comments as seen
  useEffect(() => {
    if (activeTab === 'guidance') {
      const targetProjId = selectedChatProjectId || (assignedProjects[0] ? (assignedProjects[0]._id || assignedProjects[0].id) : null);
      if (targetProjId) {
        const activeProj = assignedProjects.find(p => (p._id === targetProjId || p.id === targetProjId));
        if (activeProj && Array.isArray(activeProj.comments) && activeProj.comments.length > 0) {
          const projKeys = activeProj.comments.map(c => String(c._id || c.id || `${c.author}_${c.time}_${c.text}`));
          setSeenFacultyCommentKeys(prev => {
            const merged = Array.from(new Set([...prev, ...projKeys]));
            try {
              localStorage.setItem(`faculty_seen_comments_${currentUser?._id || currentUser?.id || 'guide'}`, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      }
    }
  }, [activeTab, selectedChatProjectId, assignedProjects, currentUser?._id, currentUser?.id]);

  // Auto-scroll chat to bottom when comments update or selected chat changes
  useEffect(() => {
    if (activeTab === 'guidance' && chatMessagesEndRef?.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, selectedChatProjectId, commentInputs]);

  const handleExportProjectWeeklyPDF = (proj) => {
    if (!proj) return;
    exportWeeklyProgressReportPDF({
      project: proj,
      weeklyUpdates: proj.weeklyUpdates || [],
      currentUser,
      guideName: proj.guideName || currentGuideName,
      departmentName: proj.department?.name || proj.dept || currentUser?.department?.name,
      academicYear: proj.academicYear || '2026-2027'
    });
  };

  const handleExportAllWeeklyPDF = () => {
    exportFacultyCohortWeeklyDossierPDF({
      assignedProjects,
      currentUser,
      currentGuideName,
      departmentName: currentUser?.department?.name || 'Computer Science & Engineering',
      academicYear: systemSettings?.currentAcademicYear || '2026-2027',
      batch: selectedBatch || '2023 - 2027'
    });
  };

  // Actionable Tab Counter Badges
  const activeCohortReviewsCount = useMemo(() => {
    return cohortReviews.filter(r => !r.status || r.status === 'SCHEDULED' || r.status === 'IN_PROGRESS').length;
  }, [cohortReviews]);

  const pendingGradingCount = useMemo(() => {
    return assignedProjects.flatMap(p => p.weeklyUpdates || []).filter(w => !w.facultyFeedback && !w.feedback).length;
  }, [assignedProjects]);

  const handleApprove = (projectId) => {
    if (isQuotaFull) {
      alert(`Cannot approve proposal: You have reached your maximum supervision quota (${maxQuota} projects).`);
      return;
    }
    if (onApproveProposal) {
      onApproveProposal(projectId, currentGuideName, currentGuideId);
    }
  };

  const handleOpenRevisionModal = (proj) => {
    setRevisionModalProject(proj);
    setRevisionNotesText('');
  };

  const handleConfirmRevision = (e) => {
    e.preventDefault();
    if (!revisionModalProject || !revisionNotesText.trim()) return;

    if (onRequestRevision) {
      onRequestRevision(revisionModalProject.id, revisionNotesText);
    }
    setRevisionModalProject(null);
    setRevisionNotesText('');
  };

  const handleReject = (projectId) => {
    if (onRejectProposal) {
      onRejectProposal(projectId, 'Proposal does not meet academic department rigor criteria.');
    }
  };

  // AI Trigger: Analyze Proposal
  const handleOpenProposalAI = async (proj) => {
    setProposalModalProject(proj);
    setProposalAnalysisData(null);
    setIsAnalyzingProposal(true);
    try {
      const res = await analyzeProposal(proj);
      if (res && res.success) {
        setProposalAnalysisData(res.data || res);
      } else {
        alert(res?.error || 'AI service unavailable.');
      }
    } catch (err) {
      console.error('Error analyzing proposal:', err);
    } finally {
      setIsAnalyzingProposal(false);
    }
  };

  // AI Trigger: Analyze Feasibility
  const handleOpenFeasibilityAI = async (proj) => {
    setFeasibilityModalProject(proj);
    setFeasibilityData(null);
    setIsAnalyzingFeasibility(true);
    try {
      const res = await analyzeFeasibility(proj);
      if (res && res.success) {
        setFeasibilityData(res.data || res);
      } else {
        alert(res?.error || 'AI service unavailable.');
      }
    } catch (err) {
      console.error('Error analyzing feasibility:', err);
    } finally {
      setIsAnalyzingFeasibility(false);
    }
  };

  // AI Trigger: Explain Risk
  const handleOpenRiskAI = async (proj) => {
    setRiskModalProject(proj);
    setRiskExplanationData(null);
    setIsExplainingRisk(true);
    try {
      const res = await explainProjectRisk(proj);
      if (res && res.success) {
        setRiskExplanationData(res);
      }
    } catch (err) {
      console.error('Error explaining risk:', err);
    } finally {
      setIsExplainingRisk(false);
    }
  };

  // AI Trigger: Analyze Weekly Report
  const handleOpenReportAI = async (w, proj) => {
    setReportModalData({ ...w, projectTitle: proj.title });
    setReportAnalysisData(null);
    setIsAnalyzingReport(true);
    try {
      const res = await analyzeWeeklyReport(w, proj);
      if (res && res.success) {
        setReportAnalysisData(res.data || res);
      }
    } catch (err) {
      console.error('Error analyzing report:', err);
    } finally {
      setIsAnalyzingReport(false);
    }
  };

  // AI Trigger: Generate Feedback
  const handleGenerateFeedbackAI = async (w) => {
    const rawNotes = feedbackInputs[w.id] || 'Good progress, ensure all API endpoints are documented.';
    setGeneratingFeedbackFor(w.id);
    try {
      const res = await generateFacultyFeedback(rawNotes, {
        projectTitle: w.projectTitle,
        studentLead: w.leadName,
        weekNumber: w.weekNumber,
        workCompleted: w.workCompleted,
        problemsFaced: w.problemsFaced,
        nextWeekPlan: w.nextWeekPlan,
        progressPct: w.progressPct
      });

      if (res && res.success && res.data) {
        setGeneratedFeedbackResult({ weekId: w.id, ...res.data });
      } else {
        alert(res?.error || 'Feedback generator unavailable.');
      }
    } catch (err) {
      console.error('Error generating feedback:', err);
    } finally {
      setGeneratingFeedbackFor(null);
    }
  };

  const handleApplyGeneratedFeedback = (weekId, text) => {
    setFeedbackInputs(prev => ({ ...prev, [weekId]: text }));
    setGeneratedFeedbackResult(null);
  };

  const handleSaveWeeklyEvaluation = (projectId, weekId) => {
    const targetProj = projectsList.find(p => p.id === projectId || p._id === projectId);
    const targetWeek = targetProj?.weeklyUpdates?.find(w => w.id === weekId || w._id === weekId);
    const feedback = feedbackInputs[weekId] !== undefined ? feedbackInputs[weekId] : (targetWeek?.facultyFeedback || targetWeek?.feedback || '');

    if (!feedback.trim()) {
      alert('Please enter faculty feedback or click Generate AI Feedback before saving.');
      return;
    }

    if (onGradeWeeklyProgress) {
      onGradeWeeklyProgress(projectId, weekId, null, feedback.trim());
    }
  };

  const handleSendComment = async (e, projectId) => {
    e.preventDefault();
    const text = commentInputs[projectId];
    if (!text || !text.trim()) return;

    const project = projectsList.find(p => p.id === projectId || p._id === projectId);
    if (!project) return;

    const commentPayload = {
      author: `${currentGuideName || currentUser?.name || 'Dr. S. Kavitha'} (Faculty Guide)`,
      text: text.trim(),
      isGuide: true
    };

    if (onAddComment) {
      await onAddComment(project._id || project.id || projectId, commentPayload);
    } else if (onUpdateProject) {
      const newComment = {
        id: Date.now(),
        ...commentPayload,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      onUpdateProject({ ...project, comments: [...(project.comments || []), newComment] });
    }
    setCommentInputs(prev => ({ ...prev, [projectId]: '' }));
  };

  return (
    <div className="page-container">
      {/* Header Banner */}
      <div className="page-header-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span className="hero-pill-badge" style={{ margin: 0, padding: '0.2rem 0.65rem', background: 'rgba(6, 182, 212, 0.15)', color: '#06B6D4', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
              <UserCheck size={14} /> Faculty Guide Portal
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{currentGuideName}</span>

            {selectedBatch && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.35rem' }}>
                <span className="hero-pill-badge" style={{ margin: 0, padding: '0.2rem 0.65rem', background: 'rgba(99, 102, 241, 0.18)', color: '#818CF8', borderColor: 'rgba(99, 102, 241, 0.35)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <GraduationCap size={14} /> Batch: {selectedBatch} ({getBatchStatus(selectedBatch).isGraduated ? '🎓 Graduated' : getBatchStatus(selectedBatch).label})
                </span>
                <button
                  type="button"
                  onClick={handleSwitchBatch}
                  className="btn-aesthetic btn-glass-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', height: '24px' }}
                  title="Switch to another Student Batch"
                >
                  <RotateCcw size={11} /> Switch Batch
                </button>
              </div>
            )}
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            Faculty Project Review & Progress Evaluation
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Review submitted proposals with AI, track weekly milestone progress, and provide constructive academic feedback.
          </p>
        </div>

        {/* Action Controls & AI Assistant Trigger: STRICTLY HIDDEN UNTIL STUDENT BATCH IS CHOSEN */}
        {selectedBatch && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Live Cloud Data Sync */}
            <button 
              className="btn-aesthetic btn-glass-secondary btn-sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Refresh latest student deliverables, weekly updates, and project progress directly from MongoDB Atlas"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
            >
              {isSyncing ? <ProjIntelSpinner size="xs" inline /> : <RefreshCw size={14} />}
              <span>{isSyncing ? 'Syncing...' : 'Sync Assigned Projects'}</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.8, borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                {lastSyncedTime}
              </span>
            </button>

            <button 
              className="btn-aesthetic btn-primary-glow btn-sm"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
              onClick={() => {
                setAssistantPrompt('');
                setIsAssistantOpen(true);
              }}
            >
              <Bot size={15} />
              <span>Ask AI Assistant</span>
            </button>

            <div className="metric-card" style={{ padding: '0.5rem 1rem' }}>
              <div className="metric-info">
                <h3 style={{ fontSize: '0.75rem' }}>Pending Reviews</h3>
                <div className="metric-value" style={{ fontSize: '1.2rem', color: pendingReviews.length > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                  {pendingReviews.length}
                </div>
              </div>
            </div>

            <div className="metric-card" style={{ padding: '0.5rem 1rem' }}>
              <div className="metric-info">
                <h3 style={{ fontSize: '0.75rem' }}>Assigned Projects</h3>
                <div className="metric-value" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>
                  {assignedProjects.length}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* GATEKEEPER: When no student batch is chosen yet, render Student Batch Selection Prompt */}
      {!selectedBatch ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '2.5rem 2rem', textAlign: 'center', maxWidth: '840px', margin: '2rem auto' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <GraduationCap size={28} />
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Select Student Batch to Access Project Workspace
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto 1.75rem', lineHeight: '1.5' }}>
            Choose the student batch you wish to review and evaluate. All assigned academic projects, defense evaluations, weekly progress reports, and student repositories will be loaded for the selected batch.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', textAlign: 'left' }}>
            {availableBatches.map((b) => {
              const status = getBatchStatus(b);
              const batchProjectsCount = projectsList.filter(p => (p.batch || '2023-2027') === b && (p.academicYear || defaultAcadYear) === defaultAcadYear).length;
              
              // Faculty assigned projects count for this batch in active academic cycle
              const myIds = [currentGuideId, currentUser?._id, currentUser?.id, currentUser?.facultyId, currentUser?.staffId].filter(Boolean).map(String);
              const assignedCount = projectsList.filter(p => {
                if ((p.batch || '2023-2027') !== b) return false;
                if ((p.academicYear || defaultAcadYear) !== defaultAcadYear) return false;
                const pGuideObj = (typeof p.guide === 'object' && p.guide !== null) ? p.guide : null;
                const projectGuideIds = [p.guideId, pGuideObj?._id, pGuideObj?.facultyId, pGuideObj?.staffId, pGuideObj?.id, typeof p.guide === 'string' ? p.guide : null].filter(Boolean).map(String);
                return myIds.some(myId => projectGuideIds.includes(myId));
              }).length;

              return (
                <div 
                  key={b}
                  onClick={() => handleSelectBatch(b)}
                  style={{
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', gap: '0.5rem' }}>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.3rem', 
                      fontSize: '0.7rem', 
                      fontWeight: 800, 
                      textTransform: 'uppercase', 
                      color: status.isGraduated ? '#10B981' : '#818CF8', 
                      background: status.isGraduated ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)', 
                      padding: '0.2rem 0.55rem', 
                      borderRadius: '4px',
                      whiteSpace: 'nowrap'
                    }}>
                      {status.isGraduated ? '🎓 Graduated' : status.label}
                    </div>

                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      Acad. Yr {defaultAcadYear}
                    </span>
                  </div>

                  <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-main)' }}>
                    Batch {b}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    {assignedCount > 0 ? (
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{assignedCount} Assigned Project{assignedCount > 1 ? 's' : ''} to You</span>
                    ) : (
                      <span>{batchProjectsCount} Registered Project{batchProjectsCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                    <span>Open Batch Workspace</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Past Supervised Projects Archive Banner */}
          {myPastSupervisedProjects.length > 0 && (
            <div style={{
              marginTop: '1.75rem',
              padding: '1.1rem 1.35rem',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.18)', color: '#818CF8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Archive size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Past Supervised Projects Archive
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    You have {myPastSupervisedProjects.length} evaluated & signed-off project{myPastSupervisedProjects.length > 1 ? 's' : ''} from previous academic cycles.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(true)}
                className="btn-aesthetic btn-glass-secondary btn-sm"
                style={{ gap: '0.45rem', fontSize: '0.8rem', padding: '0.45rem 0.95rem' }}
              >
                <Archive size={14} />
                <span>View Past Projects Archive ({myPastSupervisedProjects.length})</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        <button
          onClick={() => handleTabChange('reviews')}
          className={`nav-item-link ${activeTab === 'reviews' ? 'active' : ''}`}
          style={{ height: '36px', padding: '0 1.1rem', position: 'relative' }}
        >
          <Clock size={15} className={pendingReviews.length > 0 ? 'status-text-loading' : ''} />
          <span>1. Proposal Reviews</span>
          {pendingReviews.length > 0 && (
            <span className="tab-counter-badge badge-alert" title={`${pendingReviews.length} proposal(s) awaiting review`}>
              {pendingReviews.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('evaluations')}
          className={`nav-item-link ${activeTab === 'evaluations' ? 'active' : ''}`}
          style={{ height: '36px', padding: '0 1.1rem' }}
        >
          <Award size={15} />
          <span>2. Reviews</span>
          {activeCohortReviewsCount > 0 && (
            <span className="tab-counter-badge" title={`${activeCohortReviewsCount} active/scheduled review(s)`}>
              {activeCohortReviewsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('assigned')}
          className={`nav-item-link ${activeTab === 'assigned' ? 'active' : ''}`}
          style={{ height: '36px', padding: '0 1.1rem' }}
        >
          <UserCheck size={15} />
          <span>3. Assigned Projects</span>
        </button>

        <button
          onClick={() => {
            if (!selectedChatProjectId && assignedProjects.length > 0) {
              setSelectedChatProjectId(assignedProjects[0]._id || assignedProjects[0].id);
            }
            handleTabChange('guidance');
          }}
          className={`nav-item-link ${activeTab === 'guidance' ? 'active' : ''}`}
          style={{ height: '36px', padding: '0 1.1rem' }}
        >
          <MessageSquare size={15} />
          <span>4. Team Guidance & Chats</span>
          {totalUnreadChatCount > 0 && (
            <span className="tab-counter-badge badge-alert" title={`${totalUnreadChatCount} new message(s) from student teams`}>
              {totalUnreadChatCount}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('weekly')}
          className={`nav-item-link ${activeTab === 'weekly' ? 'active' : ''}`}
          style={{ height: '36px', padding: '0 1.1rem' }}
        >
          <TrendingUp size={15} />
          <span>5. Weekly Reports & Feedback</span>
          {pendingGradingCount > 0 && (
            <span className="tab-counter-badge badge-alert" title={`${pendingGradingCount} report(s) awaiting feedback`}>
              {pendingGradingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('documents')}
          className={`nav-item-link ${activeTab === 'documents' ? 'active' : ''}`}
          style={{ height: '36px', padding: '0 1.1rem' }}
        >
          <FileText size={15} />
          <span>6. Document Repository</span>
        </button>

        <button
          onClick={() => handleTabChange('ieee')}
          className={`nav-item-link ${activeTab === 'ieee' ? 'active' : ''}`}
          style={{ height: '36px', padding: '0 1.1rem' }}
        >
          <Award size={15} style={{ color: '#06b6d4' }} />
          <span>7. IEEE Status</span>
        </button>
      </div>

      {/* TAB 1: PROPOSAL REVIEWS (Approve / Request Revision / Reject / AI Analyze) */}
      {activeTab === 'reviews' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} style={{ color: 'var(--warning)' }} />
              Submitted Project Proposals Awaiting Faculty Review
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Review student project scope, problem statement, objectives, and technology stack. Use AI analysis to evaluate rigor.
            </p>
          </div>

          {pendingReviews.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {pendingReviews.map((proj) => (
                <div 
                  key={proj.id}
                  style={{ 
                    background: 'var(--bg-glass)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-lg)', 
                    padding: '1.35rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="project-domain-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                          {proj.dept}
                        </span>
                        <span className="project-domain-badge">{proj.domain}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Submitted: {formatDisplayDate(proj.submittedDate)}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                        {proj.title}
                      </h4>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Project ID: <strong>{proj.id}</strong> | Lead: <strong>{proj.leadName}</strong> ({proj.regNo})
                        {(() => {
                          const peers = (Array.isArray(proj.teamMembers) ? proj.teamMembers : []).filter(m => {
                            const mName = typeof m === 'object' ? m.name : String(m);
                            return mName && proj.leadName && mName.toLowerCase().trim() !== proj.leadName.toLowerCase().trim();
                          });
                          return peers.length > 0
                            ? ` | Additional Members: ${peers.map(m => typeof m === 'object' ? `${m.name}${m.regNo ? ` (${m.regNo})` : ''}` : m).join(', ')}`
                            : ' | Solo Project';
                        })()}
                      </div>
                    </div>

                    {/* Action Buttons: AI Analyze / Feasibility / Approve / Request Revision / Reject */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button 
                        className="ai-pill-action"
                        onClick={() => handleOpenProposalAI(proj)}
                      >
                        <Sparkles size={13} />
                        <span>AI Analyze Proposal</span>
                      </button>

                      <button 
                        className="ai-pill-action"
                        style={{ color: '#06B6D4', borderColor: 'rgba(6, 182, 212, 0.3)', background: 'rgba(6, 182, 212, 0.1)' }}
                        onClick={() => handleOpenFeasibilityAI(proj)}
                      >
                        <Sparkles size={13} />
                        <span>AI Feasibility</span>
                      </button>

                      <button 
                        className="btn-aesthetic btn-primary-glow btn-sm"
                        onClick={() => {
                          if (onApproveProposal) {
                            onApproveProposal(proj.id, currentGuideName, currentGuideId);
                          }
                        }}
                        title={`Approve project proposal under your supervision (${currentGuideName})`}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          borderColor: '#10b981',
                          boxShadow: '0 0 15px rgba(16, 185, 129, 0.35)'
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>Approve Proposal</span>
                      </button>

                      <button 
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        onClick={() => handleOpenRevisionModal(proj)}
                        style={{ color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                      >
                        <Edit3 size={15} />
                        <span>Request Revision</span>
                      </button>

                      <button 
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        onClick={() => handleReject(proj.id)}
                        style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      >
                        <XCircle size={15} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {/* Proposal Deep-Dive Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                        Problem Statement
                      </div>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', margin: 0, lineHeight: '1.5' }}>
                        {proj.problemStatement || 'Problem statement defined by student team.'}
                      </p>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                        Key Objectives
                      </div>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                        {proj.objectives || 'Objectives specified for prototype development.'}
                      </p>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                        Tech Stack & Abstract
                      </div>
                      <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.3rem' }}>
                        {proj.technologies || proj.techStack || 'React, Node.js, Express, MongoDB'}
                      </div>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', margin: 0, lineHeight: '1.5' }}>
                        {proj.abstract || proj.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--success)', opacity: 0.8 }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Review Queue is Clear</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                All submitted project proposals have been reviewed and processed.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEFENSE REVIEWS & EVALUATION SYSTEM */}
      {activeTab === 'evaluations' && (
        <GuideReviewSection
          reviews={cohortReviews}
          assignedProjects={assignedProjects.length > 0 ? assignedProjects : cohortProjects}
          currentGuideId={currentGuideId}
          currentGuideName={currentGuideName}
          onScheduleReview={onScheduleReview}
          onSaveOfficialEvaluation={onSaveOfficialEvaluation}
          onRefreshReviews={handleManualSync}
        />
      )}

      {/* TAB 3: ASSIGNED PROJECTS & MILESTONE MONITORING WITH RISK INTELLIGENCE */}
      {activeTab === 'assigned' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Sub-Filters: All, Active, Completed */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: 'var(--bg-glass)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setAssignedStatusFilter('ALL')}
                className={`btn-aesthetic btn-sm ${assignedStatusFilter === 'ALL' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }}
              >
                All Projects ({assignedProjects.length})
              </button>
              <button
                type="button"
                onClick={() => setAssignedStatusFilter('AWAITING_FEEDBACK')}
                className={`btn-aesthetic btn-sm ${assignedStatusFilter === 'AWAITING_FEEDBACK' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.3rem 0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderColor: assignedStatusFilter === 'AWAITING_FEEDBACK' ? '#f59e0b' : (awaitingFeedbackAssigned.length > 0 ? 'rgba(245, 158, 11, 0.4)' : undefined),
                  color: assignedStatusFilter === 'AWAITING_FEEDBACK' ? '#fbbf24' : (awaitingFeedbackAssigned.length > 0 ? '#fbbf24' : undefined)
                }}
              >
                <Clock size={12} />
                <span>Needs Feedback ({awaitingFeedbackAssigned.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignedStatusFilter('ACTIVE')}
                className={`btn-aesthetic btn-sm ${assignedStatusFilter === 'ACTIVE' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }}
              >
                Active / In Progress ({activeAssigned.length})
              </button>
              <button
                type="button"
                onClick={() => setAssignedStatusFilter('COMPLETED')}
                className={`btn-aesthetic btn-sm ${assignedStatusFilter === 'COMPLETED' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }}
              >
                Completed & Certified ({completedAssigned.length})
              </button>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing {displayAssigned.length} of {assignedProjects.length} Supervised Projects
            </div>
          </div>

          {displayAssigned.length > 0 ? (
            displayAssigned.map((project) => (
              <div 
                key={project.id}
                style={{ 
                  background: 'var(--bg-card)', 
                  border: project.status === 'COMPLETED' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: '1.65rem',
                  boxShadow: project.status === 'COMPLETED' ? '0 0 20px rgba(16, 185, 129, 0.08)' : 'none'
                }}
              >
                {/* Project Header */}
                <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="project-domain-badge">{project.dept}</span>
                        <span className="project-domain-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                          Guide: {project.guideName || currentGuideName}
                        </span>
                        {project.status === 'COMPLETED' ? (
                          <span className="project-status-badge status-completed" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', border: '1px solid #10B981', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <CheckCircle2 size={12} /> Project Completed & Certified ✓
                          </span>
                        ) : (
                          <span className="project-status-badge status-completed">
                            {project.status === 'IN_PROGRESS' || project.status === 'APPROVED' ? 'Approved • Active' : project.status}
                          </span>
                        )}
                        {project.batch && (
                          <span className="project-domain-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                            Batch: {project.batch}
                          </span>
                        )}
                        {(project.weeklyUpdates || []).filter(w => !w.facultyFeedback && !w.feedback).length > 0 && (
                          <span 
                            className="project-status-badge"
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.5)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              handleTabChange('weekly');
                              setReportsStatusFilter('AWAITING_FEEDBACK');
                            }}
                            title="Click to view weekly reports awaiting feedback"
                          >
                            <Clock size={12} />
                            <span>Needs Feedback ({(project.weeklyUpdates || []).filter(w => !w.facultyFeedback && !w.feedback).length})</span>
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.2rem 0' }}>
                        {project.title}
                      </h3>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Lead: <strong>{project.leadName}</strong> ({project.regNo})
                        {(() => {
                          const peers = (Array.isArray(project.teamMembers) ? project.teamMembers : []).filter(m => {
                            const mName = typeof m === 'object' ? m.name : String(m);
                            return mName && project.leadName && mName.toLowerCase().trim() !== project.leadName.toLowerCase().trim();
                          });
                          return peers.length > 0
                            ? ` | Additional Members: ${peers.map(m => typeof m === 'object' ? `${m.name}${m.regNo ? ` (${m.regNo})` : ''}` : m).join(', ')}`
                            : ' | Solo Project';
                        })()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                      <button 
                        type="button"
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        onClick={() => setSelectedTeamInfoProject(project)}
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        title="View team member names, emails, register numbers, year of study & department"
                      >
                        <Users size={13} style={{ color: 'var(--primary)' }} />
                        <span>Team Details</span>
                      </button>

                      <button 
                        className="ai-pill-action"
                        onClick={() => handleOpenRiskAI(project)}
                      >
                        <Sparkles size={13} />
                        <span>AI Project Health</span>
                      </button>

                      <button
                        type="button"
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        onClick={() => handleExportProjectWeeklyPDF(project)}
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        title="Download official weekly progress logbook as PDF"
                      >
                        <Download size={13} />
                        <span>Weekly PDF</span>
                      </button>

                      {project.status !== 'COMPLETED' ? (
                        <button 
                          className="btn-aesthetic btn-success-glow btn-sm"
                          onClick={() => handleOpenCompleteProjectModal(project)}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            borderColor: '#10b981',
                            color: '#fff',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '0.35rem 0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: '0 0 15px rgba(16, 185, 129, 0.35)'
                          }}
                          title="Sign off and mark project as officially completed"
                        >
                          <Award size={14} />
                          <span>Sign Project as Completed</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConfirmReopenProject(project)}
                          className="btn-aesthetic btn-glass-secondary btn-sm"
                          style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', color: 'var(--text-muted)' }}
                          title="Reopen project to active status if marked completed mistakenly"
                        >
                          <RotateCcw size={12} />
                          <span>Reopen</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick project progress stat pills */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                    <span className="project-domain-badge" style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)' }}>
                      Tasks: {(project.tasks || []).filter(t => t.status === 'COMPLETED').length} / {(project.tasks || []).length} Completed
                    </span>
                    <span className="project-domain-badge" style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
                      Progress: {calcProjectProgress(project)}%
                    </span>
                    <span className="project-domain-badge" style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
                      {(project.weeklyUpdates || []).length} Weekly Reports
                    </span>
                    <span className="project-domain-badge" style={{ fontSize: '0.75rem', background: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6' }}>
                      {(project.documents || []).length} Documents
                    </span>
                  </div>
                </div>

                {/* Milestones & Tasks Summary & Verification */}
                <div style={{ marginBottom: '1.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                      Milestone Stages & Verification
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Overall Progress: <strong style={{ color: 'var(--primary)' }}>{project.progress || 0}%</strong>
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem', marginBottom: '1rem' }}>
                    {(project.milestones || []).map((m) => {
                      const totalInMs = m.totalTasks !== undefined 
                        ? m.totalTasks 
                        : (project.tasks || []).filter(t => (t.milestoneId === m.id || t.milestone === m.id || t.milestoneId === m._id || t.milestone === m._id)).length;
                      const completedInMs = m.completedTasks !== undefined
                        ? m.completedTasks
                        : (project.tasks || []).filter(t => (t.milestoneId === m.id || t.milestone === m.id || t.milestoneId === m._id || t.milestone === m._id) && ['COMPLETED', 'Completed'].includes(t.status)).length;

                      return (
                        <div 
                          key={m.id || m._id || m.number} 
                          style={{ 
                            padding: '0.75rem 0.85rem', 
                            background: 'var(--bg-glass)', 
                            borderRadius: 'var(--radius-sm)', 
                            border: m.verifiedByGuide ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)', 
                            fontSize: '0.78rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.5rem'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                              <span style={{ fontWeight: 800, color: m.status === 'COMPLETED' ? 'var(--success)' : 'var(--text-main)' }}>
                                Stage {m.number}: {m.title}
                              </span>
                              <span style={{ fontWeight: 700, color: m.status === 'COMPLETED' ? 'var(--success)' : m.status === 'IN_PROGRESS' ? 'var(--primary)' : 'var(--text-dim)' }}>
                                {m.status === 'COMPLETED' ? '✓' : `${m.progress || 0}%`}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                              {m.description || 'Deliverable milestone stage.'}
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                              <span>{completedInMs}/{totalInMs} Tasks Done</span>
                              <span>Due: {formatDisplayDate(m.dueDate)}</span>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.08)', height: '4px', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.55rem' }}>
                              <div style={{ width: `${m.progress || 0}%`, height: '100%', background: m.status === 'COMPLETED' ? 'var(--success)' : 'var(--primary)' }}></div>
                            </div>

                            {/* Verification Badge or Action Button */}
                            {m.verifiedByGuide ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <div 
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    gap: '0.3rem', 
                                    fontSize: '0.7rem', 
                                    color: 'var(--success, #10b981)', 
                                    background: 'rgba(16, 185, 129, 0.12)', 
                                    padding: '0.25rem 0.5rem', 
                                    borderRadius: '4px', 
                                    fontWeight: 700 
                                  }}
                                  title={m.guideComments ? `Verification comment: "${m.guideComments}"` : 'Certified by guide'}
                                >
                                  <ShieldCheck size={13} />
                                  Verified & Signed Off ✓
                                </div>
                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenVerifyModal(project, m)}
                                    style={{
                                      flex: 1,
                                      padding: '0.25rem 0.4rem',
                                      fontSize: '0.675rem',
                                      fontWeight: 600,
                                      borderRadius: '4px',
                                      border: '1px solid rgba(255, 255, 255, 0.12)',
                                      background: 'rgba(255, 255, 255, 0.04)',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer'
                                    }}
                                    title="Edit verification remarks"
                                  >
                                    Edit Remarks
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmUnverify(project, m)}
                                    style={{
                                      flex: 1,
                                      padding: '0.25rem 0.4rem',
                                      fontSize: '0.675rem',
                                      fontWeight: 600,
                                      borderRadius: '4px',
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      background: 'rgba(239, 68, 68, 0.1)',
                                      color: '#f87171',
                                      cursor: 'pointer'
                                    }}
                                    title="Revoke / undo milestone sign-off"
                                  >
                                    Undo Sign-off
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenVerifyModal(project, m)}
                                style={{
                                  width: '100%',
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  borderRadius: '4px',
                                  border: '1px solid var(--primary)',
                                  background: 'rgba(99, 102, 241, 0.12)',
                                  color: 'var(--primary)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <ShieldCheck size={13} />
                                Verify Stage
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team Guidance & Discussion Channel Shortcut */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                  gap: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: 'rgba(99, 102, 241, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)'
                    }}>
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Team Guidance & Live Discussion Channel
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {(project.comments || []).length} message(s) recorded with {project.leadName}'s team
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-aesthetic btn-primary-glow btn-sm"
                    onClick={() => {
                      setSelectedChatProjectId(project._id || project.id);
                      setActiveTab('guidance');
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                  >
                    <MessageSquare size={13} />
                    <span>Open Team Discussion Channel</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
              <UserCheck size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No Assigned Projects Yet</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Go to the "Proposal Reviews" tab to review and approve submitted student projects.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DIRECT TEAM GUIDANCE & PROJECT GROUP CHATS */}
      {activeTab === 'guidance' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <MessageSquare size={20} style={{ color: 'var(--primary)' }} />
              Direct Team Guidance & Project Discussions
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
              Dedicated live discussion channels with your supervised student teams. Select a project channel from the list below to provide mentorship, feedback, and guidance instructions.
            </p>
          </div>

          {assignedProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <MessageSquare size={38} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No Assigned Project Channels</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Once you review and approve student project proposals in Tab 1, their project channels will appear here automatically for live group discussions.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 340px) 1fr',
              gap: '1.25rem',
              alignItems: 'start'
            }}>
              {/* Left Column: List of All Group Chats / Project Tiles */}
              <div 
                className="chat-channel-sidebar"
                style={{
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                    Project Channels ({assignedProjects.length})
                  </span>
                  {totalUnreadChatCount > 0 && (
                    <span className="tab-counter-badge badge-alert" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      {totalUnreadChatCount} new
                    </span>
                  )}
                </div>

                {/* Filter / Search Bar */}
                <input
                  type="text"
                  placeholder="Search project channels..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  className="aesthetic-input"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.65rem', width: '100%' }}
                />

                {/* Scrollable list of project chat tiles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '520px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                  {assignedProjects
                    .filter(p => {
                      if (!chatSearchQuery.trim()) return true;
                      const q = chatSearchQuery.toLowerCase();
                      return (
                        (p.title && p.title.toLowerCase().includes(q)) ||
                        (p.leadName && p.leadName.toLowerCase().includes(q)) ||
                        (p.regNo && p.regNo.toLowerCase().includes(q))
                      );
                    })
                    .map(project => {
                      const projId = project._id || project.id;
                      const isSelected = (selectedChatProjectId === projId) || (!selectedChatProjectId && assignedProjects[0] && (assignedProjects[0]._id === projId || assignedProjects[0].id === projId));
                      const unreadCount = getUnreadChatCountForProject(project);
                      const comments = project.comments || [];
                      const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;

                      return (
                        <div
                          key={projId}
                          onClick={() => {
                            setSelectedChatProjectId(projId);
                            if (comments.length > 0) {
                              const projKeys = comments.map(c => String(c._id || c.id || `${c.author}_${c.time}_${c.text}`));
                              setSeenFacultyCommentKeys(prev => {
                                const merged = Array.from(new Set([...prev, ...projKeys]));
                                try {
                                  localStorage.setItem(`faculty_seen_comments_${currentUser?._id || currentUser?.id || 'guide'}`, JSON.stringify(merged));
                                } catch {}
                                return merged;
                              });
                            }
                          }}
                          className={`project-chat-tile ${isSelected ? 'active' : ''}`}
                          style={{
                            padding: '0.85rem',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.35rem', marginBottom: '0.25rem' }}>
                            <div style={{
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                              lineHeight: 1.3
                            }}>
                              {project.title}
                            </div>
                            {unreadCount > 0 && (
                              <span className="tab-counter-badge badge-alert" style={{ fontSize: '0.65rem', padding: '1px 5px', flexShrink: 0 }}>
                                {unreadCount}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                            <span>Lead: <strong style={{ color: 'var(--text-main)' }}>{project.leadName}</strong></span>
                            <span>•</span>
                            <span>{project.dept || 'CSE'}</span>
                          </div>

                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            opacity: 0.85
                          }}>
                            {lastComment ? (
                              <span>
                                <strong style={{ color: lastComment.isGuide ? 'var(--primary)' : 'var(--text-main)' }}>
                                  {lastComment.isGuide ? 'You' : (lastComment.author?.split(' ')?.[0] || 'Team')}:
                                </strong> {lastComment.text}
                              </span>
                            ) : (
                              <span style={{ fontStyle: 'italic', opacity: 0.6 }}>No messages yet</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right Column: Active Project Chat & Guidance Discussion Feed */}
              {(() => {
                const currentChatProj = assignedProjects.find(p => (p._id === selectedChatProjectId || p.id === selectedChatProjectId)) || assignedProjects[0];
                if (!currentChatProj) return null;
                const projId = currentChatProj._id || currentChatProj.id;
                const comments = currentChatProj.comments || [];

                return (
                  <div 
                    className="chat-conversation-container"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: '520px'
                    }}
                  >
                    {/* Chat Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: '0.85rem',
                      borderBottom: '1px solid var(--border-color)',
                      marginBottom: '1rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                            {currentChatProj.title}
                          </h4>
                          <span className="project-status-badge status-completed" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                            Progress: {calcProjectProgress(currentChatProj)}%
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span>Lead: <strong style={{ color: 'var(--text-main)' }}>{currentChatProj.leadName}</strong> ({currentChatProj.regNo})</span>
                          {(() => {
                            const peers = (Array.isArray(currentChatProj.teamMembers) ? currentChatProj.teamMembers : []).filter(m => {
                              const mName = typeof m === 'object' ? m.name : String(m);
                              return mName && currentChatProj.leadName && mName.toLowerCase().trim() !== currentChatProj.leadName.toLowerCase().trim();
                            });
                            return peers.length > 0 ? (
                              <>
                                <span>•</span>
                                <span>Additional Members: {peers.map(m => typeof m === 'object' ? (m.name || m.regNo) : String(m)).join(', ')}</span>
                              </>
                            ) : null;
                          })()}
                          <span>•</span>
                          <span>Batch: {currentChatProj.batch || '2023-2027'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        onClick={() => setActiveTab('assigned')}
                        style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        title="View stages and milestones in Assigned Projects tab"
                      >
                        <ShieldCheck size={13} />
                        <span>View Milestones</span>
                      </button>
                    </div>

                    {/* Messages Scroll Feed */}
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      maxHeight: '360px',
                      overflowY: 'auto',
                      paddingRight: '0.5rem',
                      marginBottom: '1rem'
                    }}>
                      {comments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                          <MessageSquare size={34} style={{ opacity: 0.35, margin: '0 auto 0.5rem' }} />
                          <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No messages yet in this project channel.</p>
                          <span style={{ fontSize: '0.78rem', opacity: 0.75 }}>
                            Send guidance or ask the team for a status update using the message box below.
                          </span>
                        </div>
                      ) : (
                        comments.map((c, cIdx) => (
                          <div
                            key={c._id || c.id || cIdx}
                            className={`chat-bubble ${c.isGuide ? 'chat-bubble-guide' : 'chat-bubble-student'}`}
                            style={{
                              padding: '0.75rem 1rem',
                              borderRadius: 'var(--radius-md)',
                              marginLeft: c.isGuide ? '2.5rem' : '0',
                              marginRight: c.isGuide ? '0' : '2.5rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: c.isGuide ? 'var(--primary)' : 'var(--text-main)' }}>
                                {c.author}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {typeof c.time === 'string' && (c.time.includes('T') || c.time.includes('Z'))
                                  ? new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : (c.time || 'Recent')}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.5 }}>
                              {c.text}
                            </p>
                          </div>
                        ))
                      )}
                      <div ref={chatMessagesEndRef} />
                    </div>

                    {/* Quick Guidance Chips */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '0.2rem' }}>
                        Quick Guidance:
                      </span>
                      {[
                        'Please submit your weekly progress report for evaluation.',
                        'Great progress on the current milestone, keep it up!',
                        'Kindly resolve the open task blockers before next week.',
                        'Let us schedule a quick discussion to review your system architecture.'
                      ].map((promptText, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          className="btn-aesthetic btn-glass-secondary btn-sm"
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '12px' }}
                          onClick={() => setCommentInputs(prev => ({
                            ...prev,
                            [projId]: promptText
                          }))}
                        >
                          {promptText.slice(0, 32)}...
                        </button>
                      ))}
                    </div>

                    {/* Reply Form */}
                    <form onSubmit={(e) => handleSendComment(e, projId)} style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder={`Send guidance or feedback to ${currentChatProj.leadName || 'student'}'s team...`}
                        value={commentInputs[projId] || ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [projId]: e.target.value })}
                        className="aesthetic-input"
                        style={{ flex: 1, fontSize: '0.85rem', padding: '0.55rem 0.85rem' }}
                      />
                      <button type="submit" className="btn-aesthetic btn-primary-glow btn-sm">
                        <Send size={14} />
                        <span>Send Guidance</span>
                      </button>
                    </form>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WEEKLY REPORTS & GRADING WITH AI REPORT ANALYZER & FEEDBACK GENERATOR */}
      {activeTab === 'weekly' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={20} style={{ color: 'var(--primary)' }} />
              Student Weekly Progress Reports & Feedback
            </h3>

            {/* Sub-Filters: All, Awaiting Feedback, Active, Completed, + Export PDF */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setReportsStatusFilter('ALL')}
                className={`btn-aesthetic btn-sm ${reportsStatusFilter === 'ALL' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
              >
                All Reports
              </button>
              <button
                type="button"
                onClick={() => setReportsStatusFilter('AWAITING_FEEDBACK')}
                className={`btn-aesthetic btn-sm ${reportsStatusFilter === 'AWAITING_FEEDBACK' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.25rem 0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderColor: reportsStatusFilter === 'AWAITING_FEEDBACK' ? '#f59e0b' : (pendingGradingCount > 0 ? 'rgba(245, 158, 11, 0.4)' : undefined),
                  color: reportsStatusFilter === 'AWAITING_FEEDBACK' ? '#fbbf24' : (pendingGradingCount > 0 ? '#fbbf24' : undefined)
                }}
              >
                <Clock size={12} />
                <span>Awaiting Feedback</span>
                {pendingGradingCount > 0 && (
                  <span style={{
                    background: 'rgba(245, 158, 11, 0.25)',
                    color: '#fbbf24',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: 800
                  }}>
                    {pendingGradingCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setReportsStatusFilter('ACTIVE')}
                className={`btn-aesthetic btn-sm ${reportsStatusFilter === 'ACTIVE' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
              >
                Active Projects
              </button>
              <button
                type="button"
                onClick={() => setReportsStatusFilter('COMPLETED')}
                className={`btn-aesthetic btn-sm ${reportsStatusFilter === 'COMPLETED' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
              >
                Completed Projects
              </button>
              <button
                type="button"
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={handleExportAllWeeklyPDF}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="Export all supervised projects cumulative progress dossier to printable PDF"
              >
                <Download size={13} />
                <span>Export Cohort Dossier (PDF)</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {assignedProjects
              .filter(p => {
                if (reportsStatusFilter === 'ACTIVE') return p.status !== 'COMPLETED';
                if (reportsStatusFilter === 'COMPLETED') return p.status === 'COMPLETED';
                if (reportsStatusFilter === 'AWAITING_FEEDBACK') {
                  return (p.weeklyUpdates || []).some(w => !w.facultyFeedback && !w.feedback);
                }
                return true;
              })
              .flatMap(proj => (proj.weeklyUpdates || []).map(w => ({ ...w, projectId: proj.id, projectTitle: proj.title, leadName: proj.leadName, fullProject: proj, isCompleted: proj.status === 'COMPLETED' })))
              .filter(w => {
                if (reportsStatusFilter === 'AWAITING_FEEDBACK') {
                  return !w.facultyFeedback && !w.feedback;
                }
                return true;
              }).length > 0 ? (
              assignedProjects
                .filter(p => {
                  if (reportsStatusFilter === 'ACTIVE') return p.status !== 'COMPLETED';
                  if (reportsStatusFilter === 'COMPLETED') return p.status === 'COMPLETED';
                  if (reportsStatusFilter === 'AWAITING_FEEDBACK') {
                    return (p.weeklyUpdates || []).some(w => !w.facultyFeedback && !w.feedback);
                  }
                  return true;
                })
                .flatMap(proj => (proj.weeklyUpdates || []).map(w => ({ ...w, projectId: proj.id, projectTitle: proj.title, leadName: proj.leadName, fullProject: proj, isCompleted: proj.status === 'COMPLETED' })))
                .filter(w => {
                  if (reportsStatusFilter === 'AWAITING_FEEDBACK') {
                    return !w.facultyFeedback && !w.feedback;
                  }
                  return true;
                }).map((w) => (
                <div 
                  key={w.id}
                  style={{ 
                    padding: '1.2rem', 
                    background: 'var(--bg-glass)', 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700 }}>
                        {w.projectTitle}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        Week #{w.weekNumber} Progress Report • <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Lead: {w.leadName}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <button
                        className="ai-pill-action"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                        onClick={() => handleOpenReportAI(w, w.fullProject)}
                      >
                        <Sparkles size={12} />
                        <span>AI Analyze Report</span>
                      </button>
                      <button
                        type="button"
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        onClick={() => handleExportProjectWeeklyPDF(w.fullProject || assignedProjects.find(p => p.id === w.projectId || p._id === w.projectId))}
                        title="Export official project logbook (PDF)"
                      >
                        <Download size={12} />
                        <span>Project Logbook (PDF)</span>
                      </button>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date: {w.date}</span>
                      <span className="project-domain-badge">Progress: {w.progressPct}%</span>
                      {(w.facultyFeedback || w.feedback) ? (
                        <span className="project-status-badge status-completed" style={{ fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={12} />
                          <span>Feedback Given</span>
                        </span>
                      ) : (
                        <span className="project-status-badge status-under-review" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={12} className="status-text-loading" />
                          <span>Pending Feedback</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Work Completed
                      </div>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        {w.workCompleted}
                      </p>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Problems / Roadblocks
                      </div>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        {w.problemsFaced || 'None'}
                      </p>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Next Week Plan
                      </div>
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                        {w.nextWeekPlan}
                      </p>
                    </div>
                  </div>

                  {/* Faculty Feedback Section */}
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <input
                          type="text"
                          placeholder={w.facultyFeedback || w.feedback || 'Type faculty feedback or click Generate AI Feedback...'}
                          value={feedbackInputs[w.id] !== undefined ? feedbackInputs[w.id] : (w.facultyFeedback || w.feedback || '')}
                          onChange={(e) => setFeedbackInputs({ ...feedbackInputs, [w.id]: e.target.value })}
                          className="aesthetic-input"
                          style={{ fontSize: '0.825rem', padding: '0.35rem 0.75rem' }}
                        />
                      </div>

                      <button
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        onClick={() => handleGenerateFeedbackAI(w)}
                        disabled={generatingFeedbackFor === w.id}
                      >
                        {generatingFeedbackFor === w.id ? (
                          <ProjIntelSpinner size="xs" inline />
                        ) : (
                          <Sparkles size={13} style={{ color: 'var(--primary)' }} />
                        )}
                        <span>Generate AI Feedback</span>
                      </button>

                      <button
                        className="btn-aesthetic btn-primary-glow btn-sm"
                        onClick={() => handleSaveWeeklyEvaluation(w.projectId, w.id)}
                      >
                        <CheckCircle2 size={14} />
                        <span>Save Feedback</span>
                      </button>
                    </div>

                    {(w.facultyFeedback || w.feedback) && (
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-main)', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                        <UserCheck size={14} style={{ color: 'var(--primary)', marginTop: '0.15rem', flexShrink: 0 }} />
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '0.35rem' }}>Current Feedback:</span>
                          "{w.facultyFeedback || w.feedback}"
                        </div>
                      </div>
                    )}

                    {/* AI Feedback Preview Dropdown if generated */}
                    {generatedFeedbackResult && generatedFeedbackResult.weekId === w.id && (
                      <div style={{ background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.35)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginTop: '0.4rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#818CF8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          AI Generated Polish:
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: '0 0 0.5rem 0', lineHeight: '1.45' }}>
                          "{generatedFeedbackResult.polishedFeedback}"
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn-aesthetic btn-primary-glow btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                            onClick={() => handleApplyGeneratedFeedback(w.id, generatedFeedbackResult.polishedFeedback)}
                          >
                            <Check size={12} />
                            <span>Use Feedback</span>
                          </button>
                          <button
                            className="btn-aesthetic btn-glass-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                            onClick={() => handleGenerateFeedbackAI(w)}
                          >
                            <RotateCcw size={12} />
                            <span>Regenerate</span>
                          </button>
                          <button
                            className="btn-aesthetic btn-glass-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                            onClick={() => setGeneratedFeedbackResult(null)}
                          >
                            <span>Dismiss</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <TrendingUp size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.875rem' }}>
                  {reportsStatusFilter === 'AWAITING_FEEDBACK'
                    ? 'All weekly progress reports have received feedback! No reports currently awaiting review.'
                    : 'No weekly reports found for this filter.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DOCUMENT REPOSITORY */}
      {activeTab === 'documents' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                <FileText size={20} style={{ color: 'var(--primary)' }} />
                Assigned Projects Document Repository
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem', marginBottom: 0 }}>
                Inspect and download student deliverables across all assigned academic projects.
              </p>
            </div>

            {/* Sub-Filters: All, Active, Completed */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setDocsStatusFilter('ALL')}
                className={`btn-aesthetic btn-sm ${docsStatusFilter === 'ALL' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
              >
                All Documents
              </button>
              <button
                type="button"
                onClick={() => setDocsStatusFilter('ACTIVE')}
                className={`btn-aesthetic btn-sm ${docsStatusFilter === 'ACTIVE' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
              >
                Active Projects
              </button>
              <button
                type="button"
                onClick={() => setDocsStatusFilter('COMPLETED')}
                className={`btn-aesthetic btn-sm ${docsStatusFilter === 'COMPLETED' ? 'btn-primary-glow' : 'btn-glass-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
              >
                Completed Projects
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {assignedProjects
              .filter(p => docsStatusFilter === 'ALL' || (docsStatusFilter === 'ACTIVE' ? p.status !== 'COMPLETED' : p.status === 'COMPLETED'))
              .flatMap(proj => (proj.documents || []).map(d => ({ ...d, projectTitle: proj.title, leadName: proj.leadName, isCompleted: proj.status === 'COMPLETED' }))).length > 0 ? (
              assignedProjects
                .filter(p => docsStatusFilter === 'ALL' || (docsStatusFilter === 'ACTIVE' ? p.status !== 'COMPLETED' : p.status === 'COMPLETED'))
                .flatMap(proj => (proj.documents || []).map(d => ({ ...d, projectTitle: proj.title, leadName: proj.leadName, isCompleted: proj.status === 'COMPLETED' }))).map((doc) => {
                const ext = (doc.fileName || '').split('.').pop()?.toLowerCase();
                const isPdf = ext === 'pdf';
                const isPpt = ['ppt', 'pptx'].includes(ext);
                const isZip = ['zip', 'rar', 'tar', 'gz'].includes(ext);

                const fileDownloadUrl = getFileUrl(doc.filePath);

                return (
                  <div 
                    key={doc.id || doc._id} 
                    style={{ 
                      padding: '0.95rem 1.15rem', 
                      background: 'var(--bg-glass)', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{ 
                        width: 38, 
                        height: 38, 
                        borderRadius: '10px', 
                        background: isPdf ? 'rgba(239, 68, 68, 0.15)' : isPpt ? 'rgba(245, 158, 11, 0.15)' : isZip ? 'rgba(139, 92, 246, 0.15)' : 'rgba(99, 102, 241, 0.15)', 
                        color: isPdf ? '#EF4444' : isPpt ? '#F59E0B' : isZip ? '#8B5CF6' : 'var(--primary)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        {isPdf ? <FileText size={20} /> : isPpt ? <Presentation size={20} /> : isZip ? <FileArchive size={20} /> : <FileText size={20} />}
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{doc.projectTitle}</span>
                          <span style={{ color: 'var(--text-muted)' }}>• Lead: {doc.leadName}</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', marginTop: '0.15rem' }}>
                          {doc.fileName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          <span>Type: <strong>{doc.docType || 'Document'}</strong></span>
                          <span>Version: <strong>v{doc.version || '1.0'}</strong></span>
                          <span>Uploaded: <strong>{doc.uploadDate || 'Recent'}</strong></span>
                          <span>Size: <strong>{doc.fileSize || '1.5 MB'}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className="project-domain-badge">{doc.docType || 'Document'}</span>

                      <a
                        href={fileDownloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={doc.fileName}
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <FileText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.875rem' }}>No documents uploaded by assigned teams yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: IEEE STATUS (Informative for Final-Year Teams) */}
      {activeTab === 'ieee' && (
        <IEEEGuideSection
          projects={assignedProjects}
          currentUser={currentUser}
        />
      )}


      {/* ============================================================
          AI PROPOSAL ANALYSIS MODAL (Per Section 21 Requirement)
          ============================================================ */}
      {proposalModalProject && (
        <div className="ai-modal-overlay" onClick={() => setProposalModalProject(null)}>
          <div className="ai-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="brand-icon" style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>AI Proposal Analysis</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{proposalModalProject.title}</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setProposalModalProject(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="ai-modal-body">
              {isAnalyzingProposal ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <ProjIntelSpinner size="xl" label="Analyzing Proposal with Groq AI..." />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>Evaluating problem definition, scope, and technical complexity.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="ai-section-box">
                    <div className="ai-section-title">Proposal Summary</div>
                    <p style={{ fontSize: '0.875rem', lineHeight: '1.5', margin: 0 }}>
                      {proposalAnalysisData?.summary || 'Project proposal evaluates real-time monitoring workflows.'}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div className="ai-section-box" style={{ margin: 0 }}>
                      <div className="ai-section-title">Problem Definition</div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {proposalAnalysisData?.problemDefinition || 'Clearly Defined'}
                      </span>
                    </div>

                    <div className="ai-section-box" style={{ margin: 0 }}>
                      <div className="ai-section-title">Scope & Complexity</div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {proposalAnalysisData?.scopeAnalysis || 'Medium Scope'} • {proposalAnalysisData?.technicalComplexity || 'Moderate'}
                      </span>
                    </div>
                  </div>

                  {proposalAnalysisData?.potentialConcerns?.length > 0 && (
                    <div className="ai-section-box" style={{ margin: 0, borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' }}>
                      <div className="ai-section-title" style={{ color: '#F59E0B' }}>Potential Concerns</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.84rem', lineHeight: '1.45' }}>
                        {proposalAnalysisData.potentialConcerns.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {proposalAnalysisData?.recommendations?.length > 0 && (
                    <div className="ai-section-box" style={{ margin: 0, borderColor: 'rgba(99, 102, 241, 0.3)', background: 'rgba(99, 102, 241, 0.05)' }}>
                      <div className="ai-section-title" style={{ color: '#818CF8' }}>Faculty Recommendations</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.84rem', lineHeight: '1.45' }}>
                        {proposalAnalysisData.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ai-modal-footer">
              <button className="btn-aesthetic btn-glass-secondary btn-sm" onClick={() => setProposalModalProject(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          AI FEASIBILITY ANALYSIS MODAL (Per Section 22 Requirement)
          ============================================================ */}
      {feasibilityModalProject && (
        <div className="ai-modal-overlay" onClick={() => setFeasibilityModalProject(null)}>
          <div className="ai-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="brand-icon" style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #06B6D4, #3B82F6)' }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>AI Feasibility Evaluation</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{feasibilityModalProject.title}</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setFeasibilityModalProject(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="ai-modal-body">
              {isAnalyzingFeasibility ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <ProjIntelSpinner size="xl" label="Evaluating Technical Feasibility..." />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>Assessing technical readiness, semester timeline, and tech compatibility.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div className="ai-section-box" style={{ margin: 0 }}>
                      <div className="ai-section-title">Technical Feasibility</div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--success)' }}>
                        {feasibilityData?.technicalFeasibility || 'High'}
                      </span>
                    </div>

                    <div className="ai-section-box" style={{ margin: 0 }}>
                      <div className="ai-section-title">Timeline Feasibility</div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {feasibilityData?.timelineFeasibility || 'Moderate / Achievable'}
                      </span>
                    </div>
                  </div>

                  <div className="ai-section-box" style={{ margin: 0 }}>
                    <div className="ai-section-title">Technology Compatibility</div>
                    <p style={{ fontSize: '0.86rem', margin: 0, lineHeight: '1.5' }}>
                      {feasibilityData?.technologyCompatibility || 'Fully compatible with standard institutional stack.'}
                    </p>
                  </div>

                  {feasibilityData?.potentialRisks?.length > 0 && (
                    <div className="ai-section-box" style={{ margin: 0, borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                      <div className="ai-section-title" style={{ color: '#EF4444' }}>Potential Risks</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.84rem', lineHeight: '1.45' }}>
                        {feasibilityData.potentialRisks.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {feasibilityData?.recommendations?.length > 0 && (
                    <div className="ai-section-box" style={{ margin: 0, borderColor: 'rgba(6, 182, 212, 0.3)', background: 'rgba(6, 182, 212, 0.05)' }}>
                      <div className="ai-section-title" style={{ color: '#06B6D4' }}>Advisory Guidance</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.84rem', lineHeight: '1.45' }}>
                        {feasibilityData.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ai-modal-footer">
              <button className="btn-aesthetic btn-glass-secondary btn-sm" onClick={() => setFeasibilityModalProject(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          AI RISK EXPLANATION MODAL (Per Section 23 Requirement)
          ============================================================ */}
      {riskModalProject && (
        <div className="ai-modal-overlay" onClick={() => setRiskModalProject(null)}>
          <div className="ai-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="brand-icon" style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}>
                  <ShieldAlert size={16} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Project Risk Health & AI Explanation</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{riskModalProject.title}</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setRiskModalProject(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="ai-modal-body">
              {isExplainingRisk ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <ProjIntelSpinner size="xl" label="Calculating Deterministic Risk & Explaining..." />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-glass)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk Level</div>
                      <span className={`project-status-badge ${riskExplanationData?.riskLevel === 'HIGH' ? 'status-revision' : 'status-in-progress'}`} style={{ fontSize: '0.9rem', padding: '0.2rem 0.6rem' }}>
                        {riskExplanationData?.riskLevel} RISK
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Deterministic Score</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{riskExplanationData?.riskScore}/100</div>
                    </div>
                  </div>

                  <div className="ai-section-box" style={{ margin: 0 }}>
                    <div className="ai-section-title">Measurable Risk Factors</div>
                    <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.84rem', lineHeight: '1.45' }}>
                      {(riskExplanationData?.riskFactors || []).map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="ai-section-box" style={{ margin: 0, background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                    <div className="ai-section-title" style={{ color: '#818CF8' }}>AI Contextual Explanation</div>
                    <p style={{ fontSize: '0.86rem', lineHeight: '1.5', margin: 0 }}>
                      "{riskExplanationData?.aiExplanation}"
                    </p>
                  </div>

                  {riskExplanationData?.recommendedAttention && (
                    <div className="ai-section-box" style={{ margin: 0 }}>
                      <div className="ai-section-title">Recommended Faculty Action</div>
                      <p style={{ fontSize: '0.85rem', margin: 0, lineHeight: '1.5', color: 'var(--text-main)' }}>
                        {riskExplanationData.recommendedAttention}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ai-modal-footer">
              <button className="btn-aesthetic btn-glass-secondary btn-sm" onClick={() => setRiskModalProject(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          AI WEEKLY REPORT ANALYSIS MODAL (Per Section 25 Requirement)
          ============================================================ */}
      {reportModalData && (
        <div className="ai-modal-overlay" onClick={() => setReportModalData(null)}>
          <div className="ai-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="brand-icon" style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>AI Weekly Report Analysis</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{reportModalData.projectTitle} • Week #{reportModalData.weekNumber}</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setReportModalData(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="ai-modal-body">
              {isAnalyzingReport ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <ProjIntelSpinner size="xl" label="Analyzing Weekly Submission..." />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="ai-section-box">
                    <div className="ai-section-title">Report Summary</div>
                    <p style={{ fontSize: '0.86rem', margin: 0, lineHeight: '1.5' }}>
                      {reportAnalysisData?.summary}
                    </p>
                  </div>

                  {reportAnalysisData?.detectedBlockers?.length > 0 && (
                    <div className="ai-section-box" style={{ margin: 0, borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                      <div className="ai-section-title" style={{ color: '#EF4444' }}>Detected Issues & Blockers</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.84rem', lineHeight: '1.45' }}>
                        {reportAnalysisData.detectedBlockers.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {reportAnalysisData?.suggestedFacultyAttention && (
                    <div className="ai-section-box" style={{ margin: 0, borderColor: 'rgba(99, 102, 241, 0.3)', background: 'rgba(99, 102, 241, 0.05)' }}>
                      <div className="ai-section-title" style={{ color: '#818CF8' }}>Suggested Faculty Focus</div>
                      <p style={{ fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
                        {reportAnalysisData.suggestedFacultyAttention}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ai-modal-footer">
              <button className="btn-aesthetic btn-glass-secondary btn-sm" onClick={() => setReportModalData(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST REVISION MODAL */}
      {revisionModalProject && (
        <div className="modal-backdrop-overlay" onClick={() => setRevisionModalProject(null)}>
          <div className="aesthetic-modal-card" style={{ maxWidth: '520px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setRevisionModalProject(null)}>
              <X size={16} />
            </button>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Edit3 size={18} style={{ color: 'var(--warning)' }} />
              Request Project Proposal Revision
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              For: <strong>{revisionModalProject.title}</strong> (Lead: {revisionModalProject.leadName})
            </p>

            <form onSubmit={handleConfirmRevision}>
              <div className="form-group" style={{ marginBottom: '1.15rem' }}>
                <label className="form-label">Revision Instructions & Feedback *</label>
                <textarea
                  rows="4"
                  required
                  placeholder="Specify required corrections (e.g. clarify problem scope, specify exact machine learning architecture, expand testing methodology)..."
                  value={revisionNotesText}
                  onChange={(e) => setRevisionNotesText(e.target.value)}
                  className="aesthetic-input"
                  style={{ padding: '0.6rem 0.85rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn-aesthetic btn-glass-secondary"
                  onClick={() => setRevisionModalProject(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-aesthetic btn-primary-glow"
                  style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }}
                >
                  <Send size={15} />
                  <span>Send Revision Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FACULTY MILESTONE VERIFICATION MODAL */}
      {verifyModalData && (
        <div className="modal-backdrop-overlay" onClick={() => setVerifyModalData(null)}>
          <div className="aesthetic-modal-card" style={{ maxWidth: '520px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setVerifyModalData(null)}>
              <X size={16} />
            </button>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={20} style={{ color: 'var(--success)' }} />
              Official Milestone Stage Verification
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Project: <strong>{verifyModalData.project.title}</strong>
            </p>

            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.2rem' }}>
                Stage {verifyModalData.milestone.number}: {verifyModalData.milestone.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                {verifyModalData.milestone.description || 'Deliverable milestone stage.'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Target Deadline: <strong>{formatDisplayDate(verifyModalData.milestone.dueDate)}</strong>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleConfirmVerify(); }}>
              <div className="form-group" style={{ marginBottom: '1.15rem' }}>
                <label className="form-label">Faculty Verification Remarks / Evaluation Feedback</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Stage deliverables reviewed, code verified against SRS specifications, approved to advance to next stage."
                  value={verifyComments}
                  onChange={(e) => setVerifyComments(e.target.value)}
                  className="aesthetic-input"
                  style={{ padding: '0.6rem 0.85rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn-aesthetic btn-glass-secondary"
                  onClick={() => setVerifyModalData(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isVerifying}
                  className="btn-aesthetic btn-primary-glow"
                  style={{ background: 'var(--success)', borderColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {isVerifying ? (
                    <>
                      <ProjIntelSpinner size="xs" inline />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Sign Off & Verify Stage</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROJECT FINAL COMPLETION OFFICIAL SIGN-OFF MODAL */}
      {completeProjectModalData && (
        <div className="modal-backdrop-overlay" onClick={() => setCompleteProjectModalData(null)}>
          <div className="aesthetic-modal-card" style={{ maxWidth: '540px', padding: '1.6rem' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setCompleteProjectModalData(null)}>
              <X size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                <Award size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Sign Off & Mark Project as Completed
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Institutional Project Final Certification
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', margin: '1rem 0' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Project Title</div>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>
                {completeProjectModalData.title}
              </div>
              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.45rem', fontSize: '0.775rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>Lead: <strong style={{ color: 'var(--text-main)' }}>{completeProjectModalData.leadName}</strong></span>
                <span>Batch: <strong style={{ color: 'var(--primary)' }}>{completeProjectModalData.batch || '2023-2027'}</strong></span>
                <span>Final Progress: <strong style={{ color: 'var(--success)' }}>100% (Certified)</strong></span>
              </div>
            </div>

            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '1.15rem' }}>
              Signing this project as completed certifies that the student team has satisfactorily delivered all planned project milestones, system code, documentation, and oral viva reviews. This will move the project to completed status across all faculty and admin portal sections.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleConfirmCompleteProject(); }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Official Final Grade <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    className="aesthetic-input"
                    value={completeFinalGrade}
                    onChange={(e) => setCompleteFinalGrade(e.target.value)}
                    style={{ padding: '0.6rem 0.85rem', width: '100%', fontWeight: 700, color: 'var(--primary)' }}
                  >
                    <option value="O">O (Outstanding • 90-100%)</option>
                    <option value="A+">A+ (Excellent • 80-89%)</option>
                    <option value="A">A (Very Good • 70-79%)</option>
                    <option value="B+">B+ (Good • 60-69%)</option>
                    <option value="B">B (Above Average • 55-59%)</option>
                    <option value="C">C (Satisfactory • 50-54%)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    Overall Score / Marks (out of 100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 94"
                    value={completeFinalScore}
                    onChange={(e) => setCompleteFinalScore(e.target.value)}
                    className="aesthetic-input"
                    style={{ padding: '0.6rem 0.85rem', width: '100%', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  Faculty Completion Remarks / Certification Feedback (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Prototype implementation thoroughly tested and validated. Final report and presentation approved with distinction."
                  value={completeSignOffNotes}
                  onChange={(e) => setCompleteSignOffNotes(e.target.value)}
                  className="aesthetic-input"
                  style={{ padding: '0.6rem 0.85rem', resize: 'vertical', width: '100%' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn-aesthetic btn-glass-secondary"
                  onClick={() => setCompleteProjectModalData(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isCompletingProject}
                  className="btn-aesthetic btn-primary-glow"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {isCompletingProject ? (
                    <>
                      <ProjIntelSpinner size="xs" inline />
                      <span>Signing Off...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirm Project Completion</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {/* Floating or Header-connected Faculty AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        userRole="FACULTY"
        context={{
          guideName: currentGuideName,
          assignedProjects: assignedProjects.map(p => ({
            id: p.id,
            title: p.title,
            domain: p.domain,
            dept: p.dept,
            leadName: p.leadName,
            status: p.status,
            milestones: p.milestones,
            tasks: p.tasks,
            weeklyUpdates: p.weeklyUpdates
          }))
        }}
        initialPrompt={assistantPrompt}
      />

      {/* Team Details Modal */}
      {selectedTeamInfoProject && (
        <div className="modal-backdrop-overlay" onClick={() => setSelectedTeamInfoProject(null)}>
          <div 
            className="aesthetic-modal-card" 
            style={{ maxWidth: '680px', width: '92%', maxHeight: 'calc(100vh - 3rem)', overflowY: 'auto', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close-btn" onClick={() => setSelectedTeamInfoProject(null)} aria-label="Close modal">
              <X size={16} />
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div className="brand-icon" style={{ background: 'var(--gradient-primary)' }}>
                <Users size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Project Team Details
                  </h3>
                  <span className="project-domain-badge" style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                    {selectedTeamInfoProject.dept || selectedTeamInfoProject.department?.name || 'CSE'}
                  </span>
                  <span className="project-domain-badge" style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
                    Batch: {selectedTeamInfoProject.batch || '2023-2027'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Project: <strong style={{ color: 'var(--text-main)' }}>{selectedTeamInfoProject.title}</strong>
                </div>
              </div>
            </div>

            {/* Team Members List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {(() => {
                const members = resolveTeamMemberList(selectedTeamInfoProject);
                if (members.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      No team members recorded for this project.
                    </div>
                  );
                }
                return members.map((mem, mIdx) => (
                  <div
                    key={mem.id || mIdx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      boxShadow: mem.isLead ? '0 0 15px rgba(99, 102, 241, 0.08)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: mem.isLead ? 'var(--gradient-primary)' : 'rgba(255, 255, 255, 0.08)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}>
                          {mem.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{mem.name}</span>
                            {mem.isLead && (
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '10px',
                                background: 'rgba(99, 102, 241, 0.2)',
                                color: '#818CF8',
                                border: '1px solid rgba(99, 102, 241, 0.4)'
                              }}>
                                Team Leader
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="project-domain-badge" style={{ fontSize: '0.75rem', background: 'rgba(6, 182, 212, 0.15)', color: '#06B6D4' }}>
                          Year {getRomanYear(mem.yearOfStudy)}
                        </span>
                        <span className="project-domain-badge" style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                          Reg No: {mem.regNo}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0.5rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Mail size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span>Email: </span>
                        {mem.email && mem.email !== '—' ? (
                          <a href={`mailto:${mem.email}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                            {mem.email}
                          </a>
                        ) : (
                          <span style={{ opacity: 0.6 }}>Not provided</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Building size={13} style={{ color: '#10B981', flexShrink: 0 }} />
                        <span>Department: </span>
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{mem.departmentName}</span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={() => setSelectedTeamInfoProject(null)}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PAST SUPERVISED PROJECTS ARCHIVE
          ========================================================================= */}
      {isArchiveModalOpen && (
        <div className="ai-modal-overlay" onClick={() => setIsArchiveModalOpen(false)}>
          <div className="ai-modal-box" style={{ maxWidth: '820px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Archive size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Past Supervised Projects Archive
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    Certified projects supervised by {currentGuideName || 'Faculty'} from prior academic years
                  </p>
                </div>
              </div>
              <button
                className="btn-ghost-icon"
                onClick={() => setIsArchiveModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', maxHeight: '65vh', overflowY: 'auto' }}>
              {myPastSupervisedProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No historical archived projects found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {myPastSupervisedProjects.map((p) => {
                    const status = p.status || 'COMPLETED';
                    const leadName = p.leadName || (p.teamMembers && p.teamMembers[0]?.name) || 'Lead';
                    const leadReg = p.leadRegNo || (p.teamMembers && p.teamMembers[0]?.regNo) || '';
                    const peerMembers = (p.teamMembers || []).filter(m => {
                      const mName = typeof m === 'object' ? (m.name || m.regNo) : String(m);
                      return mName && leadName && mName.toLowerCase().trim() !== leadName.toLowerCase().trim();
                    });
                    const memberNames = peerMembers.map(m => typeof m === 'object' ? (m.name || m.regNo) : m).join(', ');

                    return (
                      <div
                        key={p._id || p.id}
                        style={{
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1.1rem 1.25rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                                Acad. Year {p.academicYear || 'Past Cycle'}
                              </span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                                Batch {p.batch || 'Archived'}
                              </span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle2 size={11} /> {status}
                              </span>
                              {p.finalGrade && (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                                  Grade: {p.finalGrade} ({p.finalScore || 100}/100)
                                </span>
                              )}
                            </div>
                            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.25rem 0' }}>
                              {p.title}
                            </h4>
                            {p.domain && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                                Domain: {p.domain}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.65rem', marginTop: '0.5rem' }}>
                          <div>
                            <strong style={{ color: 'var(--text-main)' }}>Team Lead:</strong> {leadName} {leadReg ? `(${leadReg})` : ''}
                          </div>
                          {memberNames && (
                            <div>
                              <strong style={{ color: 'var(--text-main)' }}>Members:</strong> {memberNames}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={() => setIsArchiveModalOpen(false)}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Close Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuideDashboard;
