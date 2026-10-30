import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  Upload,
  FileText,
  Send,
  UserCheck,
  AlertCircle,
  Edit3,
  BookOpen,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Plus,
  Calendar,
  CheckSquare,
  ListTodo,
  TrendingUp,
  FileCheck,
  MessageSquare,
  X,
  FileCode,
  Tag,
  ArrowRight,
  Bot,
  RefreshCw,
  HelpCircle,
  Flame,
  Lightbulb,
  Check,
  Award,
  Download,
  ExternalLink,
  Trash2,
  FileArchive,
  Presentation,
  Lock,
  ShieldAlert,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import EditTeamModal from './EditTeamModal';
import AIAssistantDrawer from './AIAssistantDrawer';
import StudentReviewSection from './StudentReviewSection';
import DocumentUploadModal from './DocumentUploadModal';
import IEEEStudentSection from './IEEEStudentSection';
import ProjIntelSpinner from './ProjIntelSpinner';
import { exportWeeklyProgressReportPDF } from '../utils/pdfExport';
import { deleteProjectDocument } from '../services/documentService';
import { getFileUrl } from '../services/api';
import {
  calculateProjectRisk,
  explainProjectRisk,
  prioritizeTasks,
  generateProjectSummary,
  analyzeWeeklyReport
} from '../services/aiService';

const StudentDashboard = ({
  project,
  user,
  reviews = [],
  isViewingArchive = false,
  pastProjects = [],
  currentYearProject = null,
  currentAcademicYear = '2026-2027',
  onSelectArchiveProject,
  onReturnToCurrentCycle,
  onUpdateProject,
  onSubmitProposal,
  onOpenNewProject,
  onAddTask,
  onUpdateTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onSubmitWeeklyProgress,
  onUpdateWeeklyProgress,
  onUploadDocument,
  onSubmitReviewDeliverable,
  onAddComment,
  onRefreshAllData
}) => {
  const isCompleted = project?.status === 'COMPLETED' || project?.finalSignedByGuide === true;
  const isStudentAlumni = user?.isPassedOut === true || user?.academicStatus === 'PASSED_OUT' || (user?.yearOfStudy && user?.yearOfStudy > 4);
  const isViewOnly = isCompleted || isViewingArchive || isStudentAlumni;
  const isDraft = project?.status === 'DRAFT' && !isViewOnly;
  const isUnderReview = (project?.status === 'SUBMITTED' || project?.status === 'UNDER_REVIEW') && !isViewOnly;
  const isRevisionRequired = project?.status === 'REVISION_REQUIRED' && !isViewOnly;
  const isApproved = ['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(project?.status);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'milestones' | 'weekly' | 'documents' | 'feedback'
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Responsive Tab Rail State & Scroll Controls
  const tabRailRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkTabScroll = () => {
    const el = tabRailRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  };

  useEffect(() => {
    checkTabScroll();
    const handleResize = () => checkTabScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-center active tab whenever activeTab changes
  useEffect(() => {
    const el = tabRailRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab="${activeTab}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    checkTabScroll();
  }, [activeTab]);

  const handleScrollTabs = (direction) => {
    const el = tabRailRef.current;
    if (!el) return;
    const scrollAmount = direction === 'left' ? -240 : 240;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    setTimeout(checkTabScroll, 250);
  };

  const handleTabWheel = (e) => {
    const el = tabRailRef.current;
    if (!el) return;
    if (e.deltaY !== 0) {
      el.scrollLeft += e.deltaY;
      checkTabScroll();
    }
  };

  // Final Year Detection: Exclusively unlock IEEE Details for Year 4 students
  const isFinalYear = useMemo(() => {
    if (user?.yearOfStudy === 4 || user?.year === 4 || user?.yearOfStudy === '4' || user?.year === '4') return true;
    if (Array.isArray(project?.teamMembers)) {
      const hasYear4 = project.teamMembers.some(m =>
        m?.yearOfStudy === 4 || m?.year === 4 || m?.yearOfStudy === '4' || m?.year === '4'
      );
      if (hasYear4) return true;
    }
    const batchStr = String(project?.batch || user?.batch || '');
    if (batchStr.includes('2027') || batchStr.includes('2023-2027')) return true;
    return false;
  }, [user, project]);

  // Track seen feedback on weekly reports (badge only shows if there is unseen faculty feedback)
  const [seenWeeklyFeedbackKeys, setSeenWeeklyFeedbackKeys] = useState(() => {
    try {
      const stored = localStorage.getItem(`seen_weekly_fb_${user?._id || user?.id || user?.email || 'student'}_${project?._id || project?.id || 'proj'}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Track seen guide discussion comments (badge only shows if there are new unread messages from faculty/teammates)
  const [seenCommentKeys, setSeenCommentKeys] = useState(() => {
    try {
      const stored = localStorage.getItem(`seen_comments_${user?._id || user?.id || user?.email || 'student'}_${project?._id || project?.id || 'proj'}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Unread faculty feedback count on weekly reports
  const unreadWeeklyFeedbackCount = useMemo(() => {
    const updates = project?.weeklyUpdates || [];
    const withFeedback = updates.filter(w => Boolean(w.facultyFeedback || w.feedback || w.grade || w.status === 'GRADED'));
    const unread = withFeedback.filter(w => {
      const key = `${w.id || w._id || w.weekNumber}_${w.facultyFeedback || w.feedback || w.grade || 'graded'}`;
      return !seenWeeklyFeedbackKeys.includes(key);
    });
    return unread.length;
  }, [project?.weeklyUpdates, seenWeeklyFeedbackKeys]);

  // Mark weekly feedback seen when student enters or views weekly tab
  useEffect(() => {
    if (activeTab === 'weekly' && project?.weeklyUpdates?.length) {
      const withFeedback = project.weeklyUpdates.filter(w => Boolean(w.facultyFeedback || w.feedback || w.grade || w.status === 'GRADED'));
      const allFeedbackKeys = withFeedback.map(w => `${w.id || w._id || w.weekNumber}_${w.facultyFeedback || w.feedback || w.grade || 'graded'}`);
      if (allFeedbackKeys.length > 0) {
        setSeenWeeklyFeedbackKeys(prev => {
          const merged = Array.from(new Set([...prev, ...allFeedbackKeys]));
          try {
            localStorage.setItem(
              `seen_weekly_fb_${user?._id || user?.id || user?.email || 'student'}_${project?._id || project?.id || 'proj'}`,
              JSON.stringify(merged)
            );
          } catch { }
          return merged;
        });
      }
    }
  }, [activeTab, project?.weeklyUpdates, user?._id, user?.id, user?.email, project?._id, project?.id]);

  // Unread comments count in Guide Feedback discussion (incoming messages from guide or peers)
  const unreadCommentsCount = useMemo(() => {
    const comments = project?.comments || [];
    const myName = (user?.name || user?.fullName || '').trim().toLowerCase();
    const incomingComments = comments.filter(c => {
      if (!c.author) return false;
      if (myName && c.author.toLowerCase().includes(myName)) return false;
      return true;
    });
    const unread = incomingComments.filter(c => {
      const key = String(c._id || c.id || `${c.author}_${c.time}_${c.text}`);
      return !seenCommentKeys.includes(key);
    });
    return unread.length;
  }, [project?.comments, seenCommentKeys, user?.name, user?.fullName]);

  // Mark comments seen when student enters or views feedback tab
  useEffect(() => {
    if (activeTab === 'feedback' && project?.comments?.length) {
      const allCommentKeys = project.comments.map(c => String(c._id || c.id || `${c.author}_${c.time}_${c.text}`));
      setSeenCommentKeys(prev => {
        const merged = Array.from(new Set([...prev, ...allCommentKeys]));
        try {
          localStorage.setItem(
            `seen_comments_${user?._id || user?.id || user?.email || 'student'}_${project?._id || project?.id || 'proj'}`,
            JSON.stringify(merged)
          );
        } catch { }
        return merged;
      });
    }
  }, [activeTab, project?.comments, user?._id, user?.id, user?.email, project?._id, project?.id]);

  // Track seen uploaded documents (badge only shows if there are new unread documents, disappears when student views tab)
  const [seenDocKeys, setSeenDocKeys] = useState(() => {
    try {
      const stored = localStorage.getItem(`seen_docs_${user?._id || user?.id || user?.email || 'student'}_${project?._id || project?.id || 'proj'}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Unread documents count (new documents uploaded since student last opened tab)
  const unreadDocumentsCount = useMemo(() => {
    const docs = project?.documents || [];
    const unread = docs.filter(d => {
      const key = String(d._id || d.id || d.fileName || d.name || d.uploadedAt || '');
      return key && !seenDocKeys.includes(key);
    });
    return unread.length;
  }, [project?.documents, seenDocKeys]);

  // Mark documents as seen when student enters or views documents tab
  useEffect(() => {
    if (activeTab === 'documents' && project?.documents?.length) {
      const allDocKeys = project.documents
        .map(d => String(d._id || d.id || d.fileName || d.name || d.uploadedAt || ''))
        .filter(Boolean);
      if (allDocKeys.length > 0) {
        setSeenDocKeys(prev => {
          const merged = Array.from(new Set([...prev, ...allDocKeys]));
          try {
            localStorage.setItem(
              `seen_docs_${user?._id || user?.id || user?.email || 'student'}_${project?._id || project?.id || 'proj'}`,
              JSON.stringify(merged)
            );
          } catch { }
          return merged;
        });
      }
    }
  }, [activeTab, project?.documents, user?._id, user?.id, user?.email, project?._id, project?.id]);

  // Dynamic Milestone Management State
  const [isAddMilestoneModalOpen, setIsAddMilestoneModalOpen] = useState(false);
  const [isEditMilestoneModalOpen, setIsEditMilestoneModalOpen] = useState(false);
  const [selectedMilestoneForEdit, setSelectedMilestoneForEdit] = useState(null);
  const [milestoneFormData, setMilestoneFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    dueDate: ''
  });

  const handleOpenAddMilestone = () => {
    if (isViewOnly) {
      alert('This project is officially completed and locked in View-Only Mode.');
      return;
    }
    if (!isApproved) {
      alert('Milestones and tasks are locked until your project proposal is approved by your faculty guide.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const defaultDue = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    setMilestoneFormData({
      title: '',
      description: '',
      startDate: today,
      dueDate: defaultDue
    });
    setIsAddMilestoneModalOpen(true);
  };

  const handleSaveAddMilestone = async (e) => {
    e.preventDefault();
    if (isViewOnly || !isApproved) return;
    if (!milestoneFormData.title.trim()) return;

    const todayStr = getTodayDateStr();
    if (milestoneFormData.dueDate && milestoneFormData.dueDate < todayStr) {
      alert('Milestone deadline date cannot be in the past.');
      return;
    }

    if (onAddMilestone) {
      await onAddMilestone(project.id || project._id, {
        title: milestoneFormData.title.trim(),
        description: milestoneFormData.description.trim(),
        startDate: milestoneFormData.startDate || undefined,
        dueDate: milestoneFormData.dueDate || undefined
      });
    }
    setIsAddMilestoneModalOpen(false);
  };

  const handleOpenEditMilestone = (m) => {
    if (isViewOnly) {
      alert('This project is officially completed and locked in View-Only Mode.');
      return;
    }
    if (!isApproved) {
      alert('Milestones and tasks are locked until your project proposal is approved by your faculty guide.');
      return;
    }
    setSelectedMilestoneForEdit(m);
    setMilestoneFormData({
      title: m.title || '',
      description: m.description || '',
      startDate: m.startDate ? new Date(m.startDate).toISOString().split('T')[0] : '',
      dueDate: m.dueDate ? new Date(m.dueDate).toISOString().split('T')[0] : ''
    });
    setIsEditMilestoneModalOpen(true);
  };

  const handleSaveEditMilestone = async (e) => {
    e.preventDefault();
    if (isViewOnly || !isApproved) return;
    if (!selectedMilestoneForEdit || !milestoneFormData.title.trim()) return;

    const todayStr = getTodayDateStr();
    if (milestoneFormData.dueDate && milestoneFormData.dueDate < todayStr) {
      alert('Milestone deadline date cannot be in the past.');
      return;
    }

    if (onUpdateMilestone) {
      await onUpdateMilestone(project.id || project._id, selectedMilestoneForEdit.id || selectedMilestoneForEdit._id, {
        title: milestoneFormData.title.trim(),
        description: milestoneFormData.description.trim(),
        startDate: milestoneFormData.startDate || undefined,
        dueDate: milestoneFormData.dueDate || undefined
      });
    }
    setIsEditMilestoneModalOpen(false);
    setSelectedMilestoneForEdit(null);
  };

  const handleConfirmDeleteMilestone = async (m) => {
    if (isViewOnly) {
      alert('This project is officially completed and locked in View-Only Mode.');
      return;
    }
    if (!isApproved) {
      alert('Milestones and tasks are locked until your project proposal is approved by your faculty guide.');
      return;
    }
    if ((project.milestones || []).length <= 1) {
      alert('A project must have at least one active milestone stage.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Milestone Stage ${m.number}: "${m.title}"? Associated tasks will be automatically reassigned to preserve progress.`)) {
      return;
    }
    if (onDeleteMilestone) {
      await onDeleteMilestone(project.id || project._id, m.id || m._id);
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
      console.warn('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'documents' && project?.documents?.length) {
      const allDocKeys = project.documents
        .map(d => String(d._id || d.id || d.fileName || d.name || d.uploadedAt || ''))
        .filter(Boolean);
      if (allDocKeys.length > 0) {
        setSeenDocKeys(prev => {
          const merged = Array.from(new Set([...prev, ...allDocKeys]));
          try {
            localStorage.setItem(
              `seen_docs_${user?._id || user?.id || user?.email || 'student'}_${project?._id || project?.id || 'proj'}`,
              JSON.stringify(merged)
            );
          } catch { }
          return merged;
        });
      }
    }
    if (onRefreshAllData) {
      onRefreshAllData().catch(() => { });
    }
  };

  // AI State
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');

  // AI Project Health & Risk
  const [riskData, setRiskData] = useState(null);
  const [isRiskLoading, setIsRiskLoading] = useState(false);

  // AI Task Prioritization Modal
  const [isPrioritizerOpen, setIsPrioritizerOpen] = useState(false);
  const [prioritizationData, setPrioritizationData] = useState(null);
  const [isPrioritizing, setIsPrioritizing] = useState(false);

  // AI Project Summary Modal
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // AI Weekly Report Analysis in Modal
  const [weeklyAnalysis, setWeeklyAnalysis] = useState(null);
  const [isAnalyzingWeekly, setIsAnalyzingWeekly] = useState(false);

  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    milestoneId: project?.milestones?.[0]?.id || project?.milestones?.[0]?._id || 'm1',
    priority: 'MEDIUM',
    dueDate: ''
  });

  // Edit Task State
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState({
    title: '',
    description: '',
    milestoneId: '',
    priority: 'MEDIUM',
    dueDate: '',
    status: 'TODO'
  });

  // Helper to compute dynamic "Due in X days" tag with color coding
  const getTaskDueTag = (dueDate, status) => {
    if (!dueDate) {
      return {
        text: 'No Due Date',
        type: 'none',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.1)',
        border: '1px solid rgba(148, 163, 184, 0.2)'
      };
    }
    const due = new Date(dueDate);
    if (isNaN(due.getTime())) {
      return {
        text: 'No Due Date',
        type: 'none',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.1)',
        border: '1px solid rgba(148, 163, 184, 0.2)'
      };
    }
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffDays = Math.round((startOfDue - startOfToday) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const overdue = Math.abs(diffDays);
      if (status === 'COMPLETED') {
        return {
          text: overdue === 1 ? 'Due 1 day ago' : `Due ${overdue} days ago`,
          type: 'past_due',
          color: '#94a3b8',
          bg: 'rgba(148, 163, 184, 0.1)',
          border: '1px solid rgba(148, 163, 184, 0.2)'
        };
      }
      return {
        text: overdue === 1 ? 'Overdue by 1 day' : `Overdue by ${overdue} days`,
        type: 'overdue',
        color: '#f87171',
        bg: 'rgba(239, 68, 68, 0.14)',
        border: '1px solid rgba(239, 68, 68, 0.35)'
      };
    } else if (diffDays === 0) {
      return {
        text: 'Due today',
        type: 'today',
        color: '#fbbf24',
        bg: 'rgba(245, 158, 11, 0.16)',
        border: '1px solid rgba(245, 158, 11, 0.4)'
      };
    } else if (diffDays === 1) {
      return {
        text: 'Due in 1 day',
        type: 'urgent',
        color: '#fbbf24',
        bg: 'rgba(245, 158, 11, 0.14)',
        border: '1px solid rgba(245, 158, 11, 0.3)'
      };
    } else {
      return {
        text: `Due in ${diffDays} days`,
        type: 'upcoming',
        color: '#818cf8',
        bg: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.28)'
      };
    }
  };

  const handleOpenEditTask = (task) => {
    if (isViewOnly) {
      alert('This project is officially completed and locked in View-Only Mode.');
      return;
    }
    if (!isApproved) {
      alert('Milestones and tasks are locked until your project proposal is approved by your faculty guide.');
      return;
    }
    setSelectedTaskForEdit(task);
    setEditTaskForm({
      title: task.title || '',
      description: task.description || '',
      milestoneId: task.milestoneId || task.milestone || (project?.milestones?.[0]?.id || project?.milestones?.[0]?._id || 'm1'),
      priority: task.priority || 'MEDIUM',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      status: task.status || 'TODO'
    });
    setIsEditTaskModalOpen(true);
  };

  const handleSaveEditTask = async (e) => {
    e.preventDefault();
    if (isViewOnly || !isApproved || !selectedTaskForEdit) return;
    if (!editTaskForm.title.trim()) return;

    const todayStr = getTodayDateStr();
    if (editTaskForm.dueDate && editTaskForm.dueDate < todayStr) {
      alert('Task target due date cannot be in the past.');
      return;
    }

    const updatedData = {
      title: editTaskForm.title.trim(),
      description: editTaskForm.description.trim(),
      milestone: editTaskForm.milestoneId,
      milestoneId: editTaskForm.milestoneId,
      priority: editTaskForm.priority,
      dueDate: editTaskForm.dueDate || undefined,
      status: editTaskForm.status
    };

    const taskId = selectedTaskForEdit.id || selectedTaskForEdit._id;
    const projId = project.id || project._id;

    if (onUpdateTask) {
      await onUpdateTask(projId, taskId, updatedData);
    } else {
      const updated = (project.tasks || []).map(t =>
        (t.id === taskId || t._id === taskId)
          ? { ...t, ...updatedData }
          : t
      );
      onUpdateProject({ ...project, tasks: updated });
    }

    setIsEditTaskModalOpen(false);
    setSelectedTaskForEdit(null);
  };

  const handleCreateTaskSubmit = async (e) => {
    e.preventDefault();
    if (isViewOnly) {
      alert('This project is officially completed and locked in View-Only Mode.');
      return;
    }
    if (!isApproved) {
      alert('Milestones and tasks are locked until your project proposal is approved by your faculty guide.');
      return;
    }
    if (!taskForm.title.trim()) return;

    const todayStr = getTodayDateStr();
    if (taskForm.dueDate && taskForm.dueDate < todayStr) {
      alert('Task target due date cannot be in the past.');
      return;
    }

    const payload = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      milestone: taskForm.milestoneId,
      milestoneId: taskForm.milestoneId,
      priority: taskForm.priority || 'MEDIUM',
      dueDate: taskForm.dueDate || undefined
    };

    if (onAddTask) {
      await onAddTask(project.id || project._id, payload);
    }
    setTaskForm({
      title: '',
      description: '',
      milestoneId: project?.milestones?.[0]?.id || project?.milestones?.[0]?._id || 'm1',
      priority: 'MEDIUM',
      dueDate: ''
    });
    setIsTaskModalOpen(false);
  };

  const handleToggleTaskStatus = (task) => {
    if (isViewOnly) return;
    if (!isApproved) {
      alert('Milestones and tasks are locked until your project proposal is approved by your faculty guide.');
      return;
    }
    const nextStatus = task.status === 'COMPLETED' ? 'TODO' : task.status === 'TODO' ? 'IN_PROGRESS' : 'COMPLETED';
    const taskId = task.id || task._id;
    const projId = project.id || project._id;
    if (onUpdateTaskStatus) {
      onUpdateTaskStatus(projId, taskId, nextStatus);
    } else if (onUpdateTask) {
      onUpdateTask(projId, taskId, { status: nextStatus });
    } else {
      const updated = (project.tasks || []).map(t =>
        (t.id === taskId || t._id === taskId) ? { ...t, status: nextStatus } : t
      );
      onUpdateProject({ ...project, tasks: updated });
    }
  };

  // Dynamic next week number evaluated from existing weekly reports
  const nextWeekNumber = useMemo(() => {
    const updates = project?.weeklyUpdates || [];
    if (!updates || updates.length === 0) return 1;
    const maxWeek = updates.reduce((max, u) => Math.max(max, Number(u.weekNumber) || 0), 0);
    return maxWeek + 1;
  }, [project?.weeklyUpdates]);

  // Weekly progress form state (only cumulative percentage, work completed, challenges faced, next week plan)
  const [weeklyForm, setWeeklyForm] = useState({
    workCompleted: '',
    problemsFaced: '',
    nextWeekPlan: '',
    progressPct: 0
  });

  // Document upload form state
  const [docForm, setDocForm] = useState({
    fileName: '',
    docType: 'SRS',
    version: '1.0'
  });
  const [docFilter, setDocFilter] = useState('ALL');

  // Calculate project progress percentage
  const calcProjectProgress = () => {
    if (!project || !project.milestones || project.milestones.length === 0) return 0;
    const sum = project.milestones.reduce((acc, m) => acc + (m.progress || 0), 0);
    return Math.round(sum / project.milestones.length);
  };

  const loadRiskInsights = async () => {
    if (!project) return;
    setIsRiskLoading(true);
    try {
      const res = await explainProjectRisk(project);
      if (res && res.success) {
        setRiskData(res);
      }
    } catch (err) {
      console.error('Failed to load risk insights:', err);
    } finally {
      setIsRiskLoading(false);
    }
  };

  // Load project risk analysis on mount or whenever student updates tasks, milestones, or weekly progress
  useEffect(() => {
    if (project) {
      loadRiskInsights();
    }
  }, [
    project?.id,
    project?.status,
    project?.tasks?.length,
    (project?.tasks || []).map(t => `${t.id || t._id}:${t.status}`).join(','),
    (project?.milestones || []).map(m => `${m.id || m.number}:${m.progress}`).join(','),
    project?.weeklyUpdates?.length
  ]);

  const handleRunPrioritization = async () => {
    setIsPrioritizerOpen(true);
    setIsPrioritizing(true);
    try {
      const res = await prioritizeTasks(project);
      if (res && res.success) {
        setPrioritizationData(res);
      }
    } catch (err) {
      console.error('Failed to prioritize tasks:', err);
    } finally {
      setIsPrioritizing(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsSummaryOpen(true);
    setIsSummaryLoading(true);
    try {
      const res = await generateProjectSummary(project);
      if (res && res.success) {
        setSummaryData(res.data || res);
      }
    } catch (err) {
      console.error('Failed to generate project summary:', err);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleAnalyzeWeeklyDraft = async () => {
    if (!weeklyForm.workCompleted.trim()) {
      alert('Please enter your work completed before running AI analysis.');
      return;
    }
    setIsAnalyzingWeekly(true);
    try {
      const targetWeek = editingWeekly ? (Number(editingWeekly.weekNumber) || 1) : nextWeekNumber;
      const res = await analyzeWeeklyReport({ ...weeklyForm, weekNumber: targetWeek }, project);
      if (res && res.success) {
        setWeeklyAnalysis(res.data || res);
      } else {
        alert(res?.error || 'AI analysis unavailable.');
      }
    } catch (err) {
      console.error('Failed to analyze weekly draft:', err);
    } finally {
      setIsAnalyzingWeekly(false);
    }
  };

  if (!project) {
    return (
      <div className="page-container">
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '3.5rem 2rem',
          textAlign: 'center',
          maxWidth: '680px',
          margin: '2rem auto'
        }}>
          <div className="brand-icon" style={{ margin: '0 auto 1.25rem', width: 54, height: 54 }}>
            <Sparkles size={28} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.6rem' }}>
            No Active Project Proposal Found
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', lineHeight: '1.6', marginBottom: '1.75rem' }}>
            You have registered successfully! To begin your academic project workflow, create a project proposal with your problem statement, objectives, and technology stack.
          </p>
          <button
            className="btn-aesthetic btn-primary-glow btn-lg"
            onClick={onOpenNewProject}
          >
            <Plus size={18} />
            <span>Create New Project Proposal</span>
          </button>
        </div>
      </div>
    );
  }

  // Render high-aesthetic locked state for sections 2 through 6 until proposal approval
  const renderLockedSection = (sectionTitle, IconComponent, sectionDescription) => (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: '3rem 2rem',
      textAlign: 'center',
      maxWidth: '720px',
      margin: '1.5rem auto',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '180px',
        height: '180px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239, 68, 68, 0.12) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.28)',
        color: '#EF4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem'
      }}>
        <Lock size={30} />
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#EF4444', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.75rem' }}>
        <AlertCircle size={13} />
        <span>Pre-Approval Phase — Section Locked</span>
      </div>

      <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
        {sectionTitle} is Locked
      </h3>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', maxWidth: '560px', margin: '0 auto 1.5rem' }}>
        {sectionDescription || 'This section is only accessible after your project proposal is officially approved by your faculty guide.'}
      </p>

      {/* Guidance breakdown box */}
      <div style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        textAlign: 'left',
        marginBottom: '1.75rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem'
      }}>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--success, #10B981)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Check size={14} /> Currently Available Actions:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.825rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
            <li><strong>Edit Proposal:</strong> Refine title, problem statement, objectives, and tech stack.</li>
            <li><strong>Proposal Overview:</strong> Review details and guide allocation status.</li>
            {(isDraft || isRevisionRequired) && (
              <li><strong>Submit Proposal:</strong> Send your proposal to your faculty guide for approval.</li>
            )}
          </ul>
        </div>

        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Lock size={14} /> Unlocks Upon Faculty Approval:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <li>Milestone roadmap and task progress tracking</li>
            <li>Weekly progress reporting & guide evaluation</li>
            <li>Document repository uploads & deliverables</li>
            <li>Guide feedback discussions & reviews</li>
          </ul>
        </div>
      </div>

      {/* Proposal status indicator */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 1rem', borderRadius: 'var(--radius-full)', background: 'var(--bg-glass)', border: '1px solid var(--border-color)', marginBottom: '1.75rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Proposal Status:</span>
        <span className="project-status-badge" style={{
          background: isApproved ? 'rgba(16, 185, 129, 0.15)' : isDraft ? 'rgba(148, 163, 184, 0.15)' : isRevisionRequired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          color: isApproved ? 'var(--success)' : isDraft ? 'var(--text-muted)' : isRevisionRequired ? '#EF4444' : '#F59E0B',
          border: `1px solid ${isApproved ? 'rgba(16, 185, 129, 0.3)' : isDraft ? 'rgba(148, 163, 184, 0.3)' : isRevisionRequired ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          fontWeight: 700,
          fontSize: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem'
        }}>
          {isApproved ? 'APPROVED' : isRevisionRequired ? 'REVISION REQUIRED' : isDraft ? 'DRAFT' : 'UNDER REVIEW'}
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-aesthetic btn-glass-secondary btn-sm"
          onClick={() => setActiveTab('overview')}
        >
          <BookOpen size={14} />
          <span>Return to Proposal Overview</span>
        </button>

        <button
          type="button"
          className="btn-aesthetic btn-primary-glow btn-sm"
          onClick={() => setIsEditModalOpen(true)}
        >
          <Edit3 size={14} />
          <span>Edit Proposal Details</span>
        </button>

        {(isDraft || isRevisionRequired) && (
          <button
            type="button"
            className="btn-aesthetic btn-primary-glow btn-sm"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
            onClick={() => {
              if (onSubmitProposal) onSubmitProposal(project.id || project._id);
              else onUpdateProject({ ...project, status: 'UNDER_REVIEW', submittedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) });
            }}
          >
            <Send size={14} />
            <span>{isRevisionRequired ? 'Resubmit Revised Proposal' : 'Submit Proposal to Guide'}</span>
          </button>
        )}
      </div>
    </div>
  );

  // Handlers
  const handleOpenNewWeekly = () => {
    if (isViewOnly) {
      alert('This project is officially completed and locked in View-Only Mode.');
      return;
    }
    if (!isApproved) {
      alert('Weekly progress reporting is locked until your project proposal is approved by your faculty guide.');
      return;
    }
    setEditingWeekly(null);
    setWeeklyForm({
      workCompleted: '',
      problemsFaced: '',
      nextWeekPlan: '',
      progressPct: project?.progress || 0
    });
    setWeeklyAnalysis(null);
    setIsWeeklyModalOpen(true);
  };

  const handleOpenEditWeekly = (w) => {
    if (isViewOnly) {
      alert('This project is in View-Only Mode.');
      return;
    }
    const hasFeedback = Boolean(w.facultyFeedback || w.feedback || w.status === 'GRADED');
    if (hasFeedback) {
      alert('This weekly report has already received faculty feedback and can no longer be edited.');
      return;
    }
    setEditingWeekly(w);
    setWeeklyForm({
      workCompleted: w.workCompleted || '',
      problemsFaced: (w.problemsFaced === 'None' || !w.problemsFaced) ? '' : w.problemsFaced,
      nextWeekPlan: w.nextWeekPlan || '',
      progressPct: w.progressPct ?? w.progressPercentage ?? 0
    });
    setWeeklyAnalysis(null);
    setIsWeeklyModalOpen(true);
  };

  const handleCloseWeeklyModal = () => {
    setIsWeeklyModalOpen(false);
    setEditingWeekly(null);
    setWeeklyAnalysis(null);
  };

  const handleWeeklySubmit = async (e) => {
    e.preventDefault();
    if (isViewOnly) {
      alert('This project is officially completed and locked in View-Only Mode.');
      return;
    }
    if (!isApproved) {
      alert('Weekly progress reporting is locked until your project proposal is approved by your faculty guide.');
      return;
    }
    if (!weeklyForm.workCompleted.trim()) return;

    if (editingWeekly) {
      // Disallow edit if feedback from guide has already been received
      if (editingWeekly.facultyFeedback || editingWeekly.feedback || editingWeekly.status === 'GRADED') {
        alert('Cannot edit weekly report. Faculty guide has already provided feedback.');
        handleCloseWeeklyModal();
        return;
      }

      const updatedFields = {
        workCompleted: weeklyForm.workCompleted.trim(),
        problemsFaced: weeklyForm.problemsFaced?.trim() || 'None',
        nextWeekPlan: weeklyForm.nextWeekPlan.trim(),
        progressPct: parseInt(weeklyForm.progressPct) || 0,
        progressPercentage: parseInt(weeklyForm.progressPct) || 0,
        weekNumber: editingWeekly.weekNumber
      };

      if (onUpdateWeeklyProgress) {
        await onUpdateWeeklyProgress(project.id || project._id, editingWeekly.id || editingWeekly._id, updatedFields);
      } else {
        const targetId = editingWeekly.id || editingWeekly._id;
        const updatedWeekly = (project.weeklyUpdates || []).map(w =>
          (w.id === targetId || w._id === targetId)
            ? { ...w, ...updatedFields }
            : w
        );
        onUpdateProject({ ...project, weeklyUpdates: updatedWeekly });
      }

      handleCloseWeeklyModal();
      return;
    }

    const newWeekly = {
      id: `w-${Date.now()}`,
      weekNumber: nextWeekNumber,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      workCompleted: weeklyForm.workCompleted.trim(),
      problemsFaced: weeklyForm.problemsFaced?.trim() || 'None',
      nextWeekPlan: weeklyForm.nextWeekPlan.trim(),
      progressPct: parseInt(weeklyForm.progressPct) || 0,
      facultyFeedback: null,
      facultyScore: null
    };

    if (onSubmitWeeklyProgress) {
      onSubmitWeeklyProgress(project.id, newWeekly);
    } else {
      const updatedWeekly = [newWeekly, ...(project.weeklyUpdates || [])];
      onUpdateProject({ ...project, weeklyUpdates: updatedWeekly });
    }

    handleCloseWeeklyModal();
  };

  const handleExportWeeklyPDF = () => {
    exportWeeklyProgressReportPDF({
      project,
      weeklyUpdates: project?.weeklyUpdates || [],
      currentUser: user,
      guideName: project?.guideName || project?.guide?.name,
      departmentName: project?.department?.name || project?.dept || user?.department?.name,
      academicYear: project?.academicYear || '2026-2027'
    });
  };

  const handleDocUploadSuccess = (newDoc) => {
    if (isViewOnly) {
      alert('This project is officially completed and locked in View-Only Mode.');
      return;
    }
    if (!isApproved) {
      alert('Document uploads are locked until your project proposal is approved by your faculty guide.');
      return;
    }
    const docPayload = {
      ...newDoc,
      id: newDoc.id || newDoc._id || `doc-${Date.now()}`,
      uploadDate: newDoc.uploadDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    if (onUploadDocument) {
      onUploadDocument(project.id || project._id, docPayload);
    } else {
      const updatedDocs = [docPayload, ...(project.documents || [])];
      onUpdateProject({ ...project, documents: updatedDocs });
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (isViewOnly) {
      alert('This project is officially completed and locked in View-Only Mode.');
      return;
    }
    if (!isApproved) {
      alert('Document repository is locked until your project proposal is approved by your faculty guide.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this document from the project repository?')) return;

    try {
      await deleteProjectDocument(docId);
    } catch (err) {
      console.warn('Backend delete failed, removing locally:', err);
    }

    const updatedDocs = (project.documents || []).filter(d => d.id !== docId && d._id !== docId);
    if (onUpdateProject) {
      onUpdateProject({ ...project, documents: updatedDocs });
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (isViewOnly) {
      alert('This project is officially completed and discussion is archived.');
      return;
    }
    if (!isApproved) {
      alert('Guide discussion is locked until your project proposal is approved by your faculty guide.');
      return;
    }
    if (!commentText.trim() || !project) return;

    // Accurately determine if the logged-in student user is the Team Lead or a Team Member
    const isLead = Boolean(
      (user?.id && project.leadId && String(user.id) === String(project.leadId)) ||
      (user?._id && project.leadId && String(user._id) === String(project.leadId)) ||
      (user?.regNo && project.regNo && String(user.regNo).trim().toLowerCase() === String(project.regNo).trim().toLowerCase()) ||
      (user?.name && project.leadName && user.name.trim().toLowerCase() === project.leadName.trim().toLowerCase()) ||
      (project.rawTeamMembers?.[0] && (
        String(project.rawTeamMembers[0]._id || project.rawTeamMembers[0].id) === String(user?._id || user?.id) ||
        (project.rawTeamMembers[0].regNo && user?.regNo && String(project.rawTeamMembers[0].regNo).trim().toLowerCase() === String(user?.regNo).trim().toLowerCase()) ||
        (project.rawTeamMembers[0].name && user?.name && String(project.rawTeamMembers[0].name).trim().toLowerCase() === String(user?.name).trim().toLowerCase())
      ))
    );

    const senderName = user?.name || user?.fullName || 'Student';
    const roleTag = isLead ? 'Team Lead' : 'Team Member';
    const commentPayload = {
      author: `${senderName} (${roleTag})`,
      text: commentText.trim(),
      isGuide: false
    };

    if (onAddComment) {
      await onAddComment(project._id || project.id, commentPayload);
    } else if (onUpdateProject) {
      const newComment = {
        id: Date.now(),
        ...commentPayload,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      onUpdateProject({ ...project, comments: [...(project.comments || []), newComment] });
    }
    setCommentText('');
  };

  const riskLevelNormalized = String(riskData?.riskLevel || 'LOW').toUpperCase();
  const riskBadgeColor = {
    LOW: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
    MEDIUM: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
    HIGH: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' }
  }[riskLevelNormalized] || { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' };

  const formatList = (val, fallback = 'None') => {
    if (!val) return fallback;
    if (Array.isArray(val)) {
      return val.map(item => (typeof item === 'object' && item !== null ? (item.name || item.title || item._id) : String(item))).join(', ');
    }
    return String(val);
  };

  const formatDisplayDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch (e) { }
    return String(dateVal);
  };

  const getTodayDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayDateStr = getTodayDateStr();

  // Reviews pending student deliverable submission (actionable reviews)
  const pendingReviewsCount = useMemo(() => {
    if (!project || !isApproved) return 0;
    const pId = String(project._id || project.id || '').trim();
    const uId = String(user?._id || user?.id || '').trim();
    const uReg = String(user?.regNo || '').trim().toLowerCase();

    const studentDeptId = String(user?.department?._id || user?.department || project?.department?._id || project?.department || '').trim();
    const studentDeptName = (user?.department?.name || user?.dept || project?.department?.name || project?.dept || '').toLowerCase().trim();
    const studentYear = Number(user?.yearOfStudy || user?.year || 4);

    return (reviews || []).filter(r => {
      if (!r) return false;
      const revPId = String(r.project?._id || r.project?.id || r.project || r.projectId || '').trim();

      // Direct project match or cohort match
      if (pId && revPId && revPId !== pId) return false;
      if (!revPId) {
        const revDeptId = String(r.department?._id || r.department || '').trim();
        const revDeptName = (r.department?.name || r.department?.code || '').toLowerCase().trim();
        const revYear = Number(r.yearOfStudy || 4);

        const matchesDept = !revDeptId || revDeptId === studentDeptId || (revDeptName && studentDeptName && studentDeptName.includes(revDeptName));
        const matchesYear = !r.yearOfStudy || revYear === studentYear;
        if (!matchesDept || !matchesYear) return false;
      }

      // Check if project has already submitted
      let hasSubmission = false;
      if (Array.isArray(r.submissions)) {
        hasSubmission = r.submissions.some(s => {
          if (!s) return false;
          const subPId = String(s.project?._id || s.project?.id || s.project || '').trim();
          if (pId && subPId && subPId === pId) return true;
          const subUId = String(s.submittedBy?._id || s.submittedBy?.id || s.submittedBy || '').trim();
          if (uId && subUId && subUId === uId) return true;
          const subReg = String(s.submittedBy?.regNo || '').trim().toLowerCase();
          if (uReg && subReg && subReg === uReg) return true;
          return false;
        });
      } else if (r.submission) {
        const subPId = String(r.submission.project?._id || r.submission.project?.id || r.submission.project || '').trim();
        if (pId && subPId && subPId === pId) hasSubmission = true;
      }
      if (hasSubmission) return false;

      // Check if project has already been evaluated
      let hasEvaluation = false;
      if (Array.isArray(r.evaluations)) {
        hasEvaluation = r.evaluations.some(e => {
          if (!e) return false;
          const evalPId = String(e.project?._id || e.project?.id || e.project || '').trim();
          return pId && evalPId && evalPId === pId;
        });
      } else if (r.officialEvaluation) {
        const evalPId = String(r.officialEvaluation.project?._id || r.officialEvaluation.project?.id || r.officialEvaluation.project || '').trim();
        if (pId && evalPId && evalPId === pId) hasEvaluation = true;
      }
      if (hasEvaluation) return false;

      // Check if submission window has passed or review is completed
      if (r.status === 'COMPLETED' || r.status === 'CANCELLED') return false;
      if (r.scheduledDate) {
        const revDate = new Date(r.scheduledDate);
        let windowEnd = new Date(revDate.getFullYear(), revDate.getMonth(), revDate.getDate(), 23, 59, 59, 999);
        if (r.submissionDeadline || r.deadline) {
          const dl = new Date(r.submissionDeadline || r.deadline);
          if (dl > windowEnd) windowEnd = dl;
        }
        if (new Date() > windowEnd) return false;
      }

      return true;
    }).length;
  }, [reviews, project, user, isApproved]);

  return (
    <div className="page-container">
      {/* Archived Project Navigation Banner */}
      {isViewingArchive && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(16, 185, 129, 0.12))',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.9rem 1.4rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileArchive size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Archived Project Record • Academic Year {project.academicYear || 'Past Year'}</span>
                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', fontWeight: 700 }}>
                  Finalized in View-Only Mode
                </span>
              </div>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Viewing completed project dossier for {project.batch || 'Batch'}. All stages and reviews are locked for historical preservation.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-aesthetic btn-primary-glow btn-sm"
            onClick={onReturnToCurrentCycle}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <ArrowRight size={14} />
            <span>Return to Current Academic Year ({currentAcademicYear})</span>
          </button>
        </div>
      )}

      {/* Multi-Year Academic Archive Switcher Pills */}
      {pastProjects && pastProjects.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '0.5rem 0.85rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color)'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Award size={14} style={{ color: '#818CF8' }} /> Academic Cycles:
          </span>
          {currentYearProject && (
            <button
              type="button"
              onClick={onReturnToCurrentCycle}
              style={{
                padding: '3px 10px',
                borderRadius: '16px',
                fontSize: '0.74rem',
                fontWeight: 700,
                border: '1px solid',
                cursor: 'pointer',
                borderColor: !isViewingArchive ? 'var(--primary)' : 'var(--border-color)',
                background: !isViewingArchive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: !isViewingArchive ? '#818CF8' : 'var(--text-muted)'
              }}
            >
              ● Current: AY {currentAcademicYear} {currentYearProject.status === 'COMPLETED' ? '(Completed ✓)' : `(${currentYearProject.status})`}
            </button>
          )}
          {pastProjects.map((p) => {
            const isSelected = String(project?._id || project?.id) === String(p._id || p.id);
            return (
              <button
                key={p._id || p.id}
                type="button"
                onClick={() => onSelectArchiveProject && onSelectArchiveProject(p._id || p.id)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  border: '1px solid',
                  cursor: 'pointer',
                  borderColor: isSelected ? '#10B981' : 'var(--border-color)',
                  background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  color: isSelected ? '#10B981' : 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>AY {p.academicYear || 'Past'}: {p.title}</span>
                <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.25)', color: '#34d399' }}>
                  {p.finalGrade || 'A+'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Header Banner */}
      <div className="page-header-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span className="hero-pill-badge" style={{ margin: 0, padding: '0.2rem 0.65rem' }}>
              <GraduationCap size={14} /> Student Workspace
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reg No: {user?.regNo || project.regNo || ''}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>• {project.dept || project.department?.name || user?.department?.name || user?.dept || ''}</span>
            <span className="hero-pill-badge" style={{ margin: 0, padding: '0.15rem 0.55rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', fontSize: '0.78rem' }}>
              Batch {user?.batch || project?.batch || '2023-2027'} • Year {user?.yearOfStudy || user?.year || 4}
            </span>
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0.2rem 0' }}>
            {project.title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            {/* Status Badges */}
            {isDraft && (
              <span className="project-status-badge" style={{ background: 'rgba(156, 163, 175, 0.15)', color: '#9CA3AF', border: '1px solid rgba(156, 163, 175, 0.3)' }}>
                Draft (Not Submitted)
              </span>
            )}
            {isUnderReview && (
              <span className="project-status-badge status-under-review" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={13} className="status-text-loading" />
                <span>Proposal Submitted & Under Faculty Review</span>
              </span>
            )}
            {isUnderReview && (project.guide || project.guideName) && (
              <span className="project-status-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <UserCheck size={13} />
                <span>Allocated Guide: <strong>{project.guideName || (typeof project.guide === 'object' ? project.guide?.name : null)}</strong> (Pending Faculty Approval)</span>
              </span>
            )}
            {isRevisionRequired && (
              <span className="project-status-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <AlertCircle size={13} />
                <span>Revision Requested by Faculty</span>
              </span>
            )}
            {project.status === 'COMPLETED' ? (
              <span className="project-status-badge" style={{
                background: 'rgba(16, 185, 129, 0.18)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '0.25rem 0.75rem',
                borderRadius: '6px',
                fontWeight: 800,
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <CheckCircle2 size={14} />
                <span>Project Completed & Certified • Grade: <strong>{project.finalGrade || 'A+'}</strong></span>
              </span>
            ) : isApproved && (
              <span className="project-status-badge status-completed" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <UserCheck size={14} />
                <span>Assigned Guide: <strong>{project.guideName || (typeof project.guide === 'object' ? project.guide?.name : null) || 'Dr. A. Sharma (HOD)'}</strong></span>
              </span>
            )}

            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Team: <strong>{formatList(project.teamMembers, project.leadName || 'Student')}</strong>
            </span>
          </div>
        </div>

        {/* Action Buttons & Real-Time Sync */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Real-time Project Data Synchronization Button */}
          <button
            className="btn-aesthetic btn-glass-secondary btn-sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            title="Refresh latest project milestones, assigned guide, weekly grades, and reviews from MongoDB Atlas"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            {isSyncing ? <ProjIntelSpinner size="xs" inline /> : <RefreshCw size={14} />}
            <span>{isSyncing ? 'Syncing...' : 'Sync Project Data'}</span>
            <span style={{ fontSize: '0.72rem', opacity: 0.8, borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              {lastSyncedTime}
            </span>
          </button>

          {/* Ask AI Trigger Button */}
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

          {/* Edit Proposal Details Button - Hidden when project is view-only */}
          {!isViewOnly && (
            <button
              type="button"
              className="btn-aesthetic btn-glass-secondary btn-sm"
              onClick={() => setIsEditModalOpen(true)}
              title="Edit proposal title, domain, problem statement, objectives, and tech stack"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Edit3 size={14} />
              <span>Edit Proposal</span>
            </button>
          )}

          {(isDraft || isRevisionRequired) && (
            <button
              type="button"
              className="btn-aesthetic btn-primary-glow btn-sm"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              onClick={() => {
                if (onSubmitProposal) onSubmitProposal(project.id || project._id);
                else onUpdateProject({ ...project, status: 'UNDER_REVIEW', submittedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) });
              }}
            >
              <Send size={14} />
              <span>{isRevisionRequired ? 'Resubmit Revised Proposal' : 'Submit Proposal to Faculty'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Official Project Completion Certification & Grade Showcase Banner */}
      {project.status === 'COMPLETED' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(99, 102, 241, 0.1) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem 1.75rem',
          marginBottom: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.12)'
        }}>
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
            {/* Left Column: Certification Information */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.1rem', flex: 1, minWidth: '300px' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.35))',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
              }}>
                <Award size={28} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10B981' }}>
                    Institutional Project Completed & Certified
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 800, textTransform: 'uppercase' }}>
                    AY {project.academicYear || '2026-2027'} Official Record
                  </span>
                </div>

                <p style={{ color: 'var(--text-main)', fontSize: '0.88rem', marginTop: '0.4rem', marginBottom: '0.6rem', lineHeight: 1.55 }}>
                  "{project.completionRemarks || project.finalNotes || 'This project has satisfactorily satisfied all departmental review milestones, deliverables, and oral viva standards.'}"
                </p>

                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>Verified by Guide: <strong style={{ color: 'var(--text-main)' }}>{project.certifiedByGuideName || project.guideName || 'Faculty Guide'}</strong></span>
                  {project.completedAt && (
                    <span>Certified Date: <strong style={{ color: 'var(--text-main)' }}>{new Date(project.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                  )}
                  <span>Status: <strong style={{ color: '#10B981' }}>View-Only Mode (Permanent Record)</strong></span>
                </div>
              </div>
            </div>

            {/* Right Column: Prominent Grade & Score Showcase Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
              {/* Overall Score Badge */}
              <div style={{
                textAlign: 'center',
                padding: '0.75rem 1.1rem',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  Overall Score
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '0.1rem' }}>
                  {project.finalScore != null ? project.finalScore : 95}<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>/100</span>
                </div>
              </div>

              {/* Final Grade Badge */}
              <div style={{
                textAlign: 'center',
                padding: '0.75rem 1.25rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.35))',
                border: '1.5px solid rgba(16, 185, 129, 0.55)',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.2)'
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#10B981', letterSpacing: '0.5px' }}>
                  Final Grade
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#34d399', lineHeight: 1.1, marginTop: '0.1rem' }}>
                  {project.finalGrade || 'A+'}
                </div>
              </div>
            </div>
          </div>

          {/* Academic Policy Notice Footer */}
          <div style={{
            marginTop: '1rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.775rem',
            color: 'var(--text-muted)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Lock size={13} style={{ color: '#10B981' }} />
              <span>Workspace locked in <strong>View-Only Mode</strong>. Under institutional regulations, students complete one academic project per academic year.</span>
            </div>
            <span style={{ color: '#818CF8' }}>
              Batch: <strong>{project.batch || user?.batch || '2023-2027'}</strong> • Next cycle opens when Academic Year advances.
            </span>
          </div>
        </div>
      )}

      {/* ============================================================
          AI PROJECT INSIGHTS BANNER (Per Section 15 Requirement)
          ============================================================ */}
      <div className="ai-insight-card" style={{ marginBottom: '1.5rem' }}>
        <div className="ai-card-glow-accent" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="ai-badge-gradient">
              <Sparkles size={13} /> AI Project Insights
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Deterministic Risk Engine + Groq Intelligence
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ai-pill-action"
              onClick={handleGenerateSummary}
              disabled={isSummaryLoading}
              title="Generate comprehensive AI executive summary of project status, objectives, and deliverables"
            >
              {isSummaryLoading ? (
                <ProjIntelSpinner size="xs" inline label="Generating..." />
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Generate AI Summary</span>
                </>
              )}
            </button>

            <button
              className="ai-pill-action"
              onClick={loadRiskInsights}
              disabled={isRiskLoading}
            >
              {isRiskLoading ? (
                <>
                  <ProjIntelSpinner size="xs" inline label="Calculating Risk..." />
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  <span>Refresh AI Health</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {/* Health & Risk Level */}
          <div style={{ background: 'var(--bg-glass)', padding: '0.85rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Project Health & Risk Level
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  background: riskBadgeColor.bg,
                  color: riskBadgeColor.text,
                  border: `1px solid ${riskBadgeColor.border}`,
                  padding: '0.2rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                {riskData?.riskLevel === 'HIGH' ? <AlertTriangle size={14} /> : riskData?.riskLevel === 'MEDIUM' ? <Clock size={14} /> : <CheckCircle2 size={14} />}
                {riskData?.riskLevel ? `${riskData.riskLevel} RISK` : 'EVALUATING...'}
              </span>
              <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Score: {riskData?.riskScore ?? '--'}/100
              </span>
            </div>
          </div>

          {/* Project Progress */}
          <div style={{ background: 'var(--bg-glass)', padding: '0.85rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Milestone Progress
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                {calcProjectProgress()}%
              </span>
              <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${calcProjectProgress()}%`, height: '100%', background: 'var(--gradient-primary)' }} />
              </div>
            </div>
          </div>

          {/* Risk Factors */}
          <div style={{ background: 'var(--bg-glass)', padding: '0.85rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gridColumn: 'span 1' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Detected Risk Factors
            </div>
            {riskData?.riskFactors && riskData.riskFactors.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                {riskData.riskFactors.slice(0, 2).map((factor, idx) => (
                  <li key={idx} style={{ marginBottom: '0.15rem' }}>{factor}</li>
                ))}
              </ul>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>• All active milestones progressing normally</span>
            )}
          </div>
        </div>

        {/* AI Natural Language Recommendation */}
        <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '0.9rem 1.15rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Lightbulb size={18} style={{ color: '#818CF8', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              AI Advisory Recommendation
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
              "{riskData?.aiExplanation || 'Focus on closing open tasks in the current milestone and resolving any blocking dependencies before starting downstream modules.'}"
            </p>
          </div>
        </div>
      </div>

      {/* PROPOSAL DRAFT NOTICE BANNER */}
      {isDraft && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', maxWidth: '720px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
              <Edit3 size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                  Project Proposal in Draft Status
                </h4>
                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Lock size={10} /> Other Sections Locked
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
                You can review your proposal details and edit your problem statement, objectives, and tech stack. All downstream sections (milestones, tasks, weekly logs, documents, and reviews) will remain locked until your proposal is submitted and approved by your faculty guide.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-aesthetic btn-glass-secondary btn-sm" onClick={() => setIsEditModalOpen(true)}>
              <Edit3 size={14} /> <span>Edit Proposal Details</span>
            </button>
            <button
              type="button"
              className="btn-aesthetic btn-primary-glow btn-sm"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              onClick={() => {
                if (onSubmitProposal) onSubmitProposal(project.id || project._id);
                else onUpdateProject({ ...project, status: 'UNDER_REVIEW', submittedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) });
              }}
            >
              <Send size={14} /> <span>Submit Proposal to Faculty</span>
            </button>
          </div>
        </div>
      )}

      {/* REVISION REQUIRED NOTICE BANNER */}
      {isRevisionRequired && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', maxWidth: '720px' }}>
            <AlertCircle size={24} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#EF4444', margin: 0 }}>
                  Faculty Guide Requested Project Revisions
                </h4>
                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Lock size={10} /> Other Sections Locked
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
                {project.revisionNotes ? (
                  <span><strong>Guide Notes:</strong> "{project.revisionNotes}". </span>
                ) : 'Please refine the problem statement scope, provide a detailed hardware/software component list, and clarify the expected testing methodology before resubmitting.'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-aesthetic btn-glass-secondary btn-sm"
              onClick={() => setIsEditModalOpen(true)}
            >
              <Edit3 size={13} />
              <span>Edit Proposal & Address Feedback</span>
            </button>
            <button
              type="button"
              className="btn-aesthetic btn-primary-glow btn-sm"
              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
              onClick={() => {
                if (onSubmitProposal) onSubmitProposal(project.id || project._id);
                else onUpdateProject({ ...project, status: 'UNDER_REVIEW', submittedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) });
              }}
            >
              <Send size={14} /> <span>Resubmit Revised Proposal</span>
            </button>
          </div>
        </div>
      )}

      {/* UNDER REVIEW NOTICE BANNER */}
      {isUnderReview && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', maxWidth: '720px' }}>
            <Clock size={24} className="status-text-loading" style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--warning)', margin: 0 }}>
                  Proposal Submitted — Awaiting Faculty Guide Approval
                </h4>
                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Lock size={10} /> Other Sections Locked
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
                Your project proposal was submitted on <strong>{project.submittedDate ? new Date(project.submittedDate).toLocaleDateString() : 'Recently'}</strong> and is currently waiting for faculty guide approval. Other sections remain locked until approval. You may continue to refine your proposal details.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-aesthetic btn-glass-secondary btn-sm" onClick={() => setIsEditModalOpen(true)}>
              <Edit3 size={14} /> <span>Edit Proposal Details</span>
            </button>
          </div>
        </div>
      )}

      {/* Split-View & Narrow Screen Quick Section Dropdown */}
      <div className="student-tabs-split-selector-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          <Layers size={15} style={{ color: 'var(--primary)' }} />
          <span>Active Section:</span>
        </div>
        <select
          value={activeTab}
          onChange={(e) => handleTabChange(e.target.value)}
          className="aesthetic-input"
          style={{
            flex: 1,
            height: '36px',
            fontSize: '0.825rem',
            fontWeight: 700,
            padding: '0 0.75rem',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)'
          }}
          aria-label="Select Project Workspace Section"
        >
          <option value="overview">1. Proposal Overview</option>
          <option value="milestones" disabled={!isApproved}>2. Milestones and tasks {!isApproved ? '(Locked)' : ''}</option>
          <option value="weekly" disabled={!isApproved}>3. Weekly Progress {!isApproved ? '(Locked)' : ''}</option>
          <option value="documents" disabled={!isApproved}>4. Documents {!isApproved ? '(Locked)' : ''}</option>
          <option value="feedback" disabled={!isApproved}>5. Guide Feedback {!isApproved ? '(Locked)' : ''}</option>
          <option value="reviews" disabled={!isApproved}>6. Reviews {!isApproved ? '(Locked)' : ''}</option>
          {isFinalYear && (
            <option value="ieee" disabled={!isApproved}>7. IEEE Details {!isApproved ? '(Locked)' : ''}</option>
          )}
        </select>
      </div>

      {/* Main Tab Navigation & Actions */}
      <div className="student-tabs-nav-container">
        <div className="student-tabs-rail-wrapper">
          {/* Left Scroll Chevron */}
          {canScrollLeft && (
            <>
              <div className="student-tab-edge-fade-left" />
              <button
                type="button"
                onClick={() => handleScrollTabs('left')}
                className="student-tab-scroll-btn left"
                title="Scroll sections left"
                aria-label="Scroll sections left"
              >
                <ChevronLeft size={16} />
              </button>
            </>
          )}

          {/* Student Dashboard Section Navigation Rail */}
          <div
            ref={tabRailRef}
            onScroll={checkTabScroll}
            onWheel={handleTabWheel}
            className="student-tabs-rail"
          >
            <button
              data-tab="overview"
              onClick={() => handleTabChange('overview')}
              className={`nav-item-link ${activeTab === 'overview' ? 'active' : ''}`}
              style={{ height: '34px', padding: '0 0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <BookOpen size={14} />
              <span>1. Proposal Overview</span>
            </button>

            <button
              data-tab="milestones"
              onClick={() => handleTabChange('milestones')}
              className={`nav-item-link ${activeTab === 'milestones' ? 'active' : ''}`}
              style={{
                height: '34px',
                padding: '0 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                opacity: !isApproved ? 0.75 : 1,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title={!isApproved ? 'Section locked until project proposal is approved by faculty guide' : 'Milestones and tasks'}
            >
              {!isApproved ? <Lock size={12} style={{ color: '#EF4444' }} /> : <Sparkles size={14} />}
              <span>2. Milestones and tasks</span>
              {!isApproved && (
                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 700 }}>
                  Locked
                </span>
              )}
            </button>

            <button
              data-tab="weekly"
              onClick={() => handleTabChange('weekly')}
              className={`nav-item-link ${activeTab === 'weekly' ? 'active' : ''}`}
              style={{
                height: '34px',
                padding: '0 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                opacity: !isApproved ? 0.75 : 1,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title={!isApproved ? 'Section locked until project proposal is approved by faculty guide' : 'Weekly Progress'}
            >
              {!isApproved ? <Lock size={12} style={{ color: '#EF4444' }} /> : <TrendingUp size={14} />}
              <span>3. Weekly Progress</span>
              {unreadWeeklyFeedbackCount > 0 && (
                <span className="tab-counter-badge badge-alert" title={`${unreadWeeklyFeedbackCount} new faculty feedback on weekly progress`}>
                  {unreadWeeklyFeedbackCount}
                </span>
              )}
              {!isApproved && (
                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 700 }}>
                  Locked
                </span>
              )}
            </button>

            <button
              data-tab="documents"
              onClick={() => handleTabChange('documents')}
              className={`nav-item-link ${activeTab === 'documents' ? 'active' : ''}`}
              style={{
                height: '34px',
                padding: '0 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                opacity: !isApproved ? 0.75 : 1,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title={!isApproved ? 'Section locked until project proposal is approved by faculty guide' : 'Project Documents'}
            >
              {!isApproved ? <Lock size={12} style={{ color: '#EF4444' }} /> : <FileText size={14} />}
              <span>4. Documents</span>
              {unreadDocumentsCount > 0 && (
                <span className="tab-counter-badge badge-alert" title={`${unreadDocumentsCount} new document(s) uploaded`}>
                  {unreadDocumentsCount}
                </span>
              )}
              {!isApproved && (
                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 700 }}>
                  Locked
                </span>
              )}
            </button>

            <button
              data-tab="feedback"
              onClick={() => handleTabChange('feedback')}
              className={`nav-item-link ${activeTab === 'feedback' ? 'active' : ''}`}
              style={{
                height: '34px',
                padding: '0 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                opacity: !isApproved ? 0.75 : 1,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title={!isApproved ? 'Section locked until project proposal is approved by faculty guide' : 'Guide Feedback'}
            >
              {!isApproved ? <Lock size={12} style={{ color: '#EF4444' }} /> : <MessageSquare size={14} />}
              <span>5. Guide Feedback</span>
              {unreadCommentsCount > 0 && (
                <span className="tab-counter-badge badge-alert" title={`${unreadCommentsCount} unread message(s) from guide / teammates`}>
                  {unreadCommentsCount}
                </span>
              )}
              {!isApproved && (
                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 700 }}>
                  Locked
                </span>
              )}
            </button>

            <button
              data-tab="reviews"
              onClick={() => handleTabChange('reviews')}
              className={`nav-item-link ${activeTab === 'reviews' ? 'active' : ''}`}
              style={{
                height: '34px',
                padding: '0 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                opacity: !isApproved ? 0.75 : 1,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title={!isApproved ? 'Section locked until project proposal is approved by faculty guide' : 'Reviews'}
            >
              {!isApproved ? <Lock size={12} style={{ color: '#EF4444' }} /> : <Award size={14} />}
              <span>6. Reviews</span>
              {pendingReviewsCount > 0 && (
                <span className="tab-counter-badge badge-alert" title={`${pendingReviewsCount} review(s) pending deliverable submission`}>
                  {pendingReviewsCount}
                </span>
              )}
              {!isApproved && (
                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 700 }}>
                  Locked
                </span>
              )}
            </button>

            {/* TAB 7: IEEE DETAILS (Exclusive to Final Year Students Only) */}
            {isFinalYear && (
              <button
                data-tab="ieee"
                onClick={() => handleTabChange('ieee')}
                className={`nav-item-link ${activeTab === 'ieee' ? 'active' : ''}`}
                style={{
                  height: '34px',
                  padding: '0 0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  opacity: !isApproved ? 0.75 : 1,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title={!isApproved ? 'Section locked until project proposal is approved by faculty guide' : 'IEEE Paper & Conference Details'}
              >
                {!isApproved ? <Lock size={12} style={{ color: '#EF4444' }} /> : <Sparkles size={14} style={{ color: '#06b6d4' }} />}
                <span>7. IEEE Details</span>
                {!isApproved && (
                  <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontWeight: 700 }}>
                    Locked
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Right Scroll Chevron */}
          {canScrollRight && (
            <>
              <div className="student-tab-edge-fade-right" />
              <button
                type="button"
                onClick={() => handleScrollTabs('right')}
                className="student-tab-scroll-btn right"
                title="Scroll sections right"
                aria-label="Scroll sections right"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: PROPOSAL OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick Metrics Bar */}
          {!isApproved ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="metric-card" style={{ padding: '1rem 1.25rem' }}>
                <div className="metric-icon" style={{
                  background: isDraft ? 'rgba(99, 102, 241, 0.15)' : isRevisionRequired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: isDraft ? 'var(--primary)' : isRevisionRequired ? '#EF4444' : '#F59E0B'
                }}>
                  {isDraft ? <Edit3 size={20} /> : isRevisionRequired ? <AlertCircle size={20} /> : <Clock size={20} />}
                </div>
                <div className="metric-info">
                  <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proposal Status</h3>
                  <div className="metric-value" style={{ fontSize: '1.15rem', color: isDraft ? 'var(--primary)' : isRevisionRequired ? '#EF4444' : '#F59E0B' }}>
                    {isDraft ? 'Draft' : isRevisionRequired ? 'Revision Required' : 'Under Review'}
                  </div>
                </div>
              </div>

              <div className="metric-card" style={{ padding: '1rem 1.25rem' }}>
                <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
                  <UserCheck size={20} />
                </div>
                <div className="metric-info">
                  <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faculty Guide</h3>
                  <div className="metric-value" style={{ fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {project.guideName || (typeof project.guide === 'object' ? project.guide?.name : null) || 'Pending Assignment'}
                  </div>
                </div>
              </div>

              <div className="metric-card" style={{ padding: '1rem 1.25rem' }}>
                <div className="metric-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
                  <Lock size={20} />
                </div>
                <div className="metric-info">
                  <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Execution Sections</h3>
                  <div className="metric-value" style={{ fontSize: '1.15rem', color: '#EF4444' }}>
                    Locked
                  </div>
                </div>
              </div>

              <div className="metric-card" style={{ padding: '1rem 1.25rem' }}>
                <div className="metric-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' }}>
                  <GraduationCap size={20} />
                </div>
                <div className="metric-info">
                  <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project Phase</h3>
                  <div className="metric-value" style={{ fontSize: '1.15rem' }}>
                    Proposal Stage
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="metric-card" style={{ padding: '1rem 1.25rem' }}>
                <div className="metric-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                  <CheckSquare size={20} />
                </div>
                <div className="metric-info">
                  <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tasks Completed</h3>
                  <div className="metric-value" style={{ fontSize: '1.4rem' }}>
                    {(project.tasks || []).filter(t => t.status === 'COMPLETED').length} / {(project.tasks || []).length}
                  </div>
                </div>
              </div>

              <div className="metric-card" style={{ padding: '1rem 1.25rem' }}>
                <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
                  <TrendingUp size={20} />
                </div>
                <div className="metric-info">
                  <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Milestone Progress</h3>
                  <div className="metric-value" style={{ fontSize: '1.4rem', color: '#10B981' }}>
                    {calcProjectProgress()}%
                  </div>
                </div>
              </div>

              <div className="metric-card" style={{ padding: '1rem 1.25rem' }}>
                <div className="metric-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                  <BookOpen size={20} />
                </div>
                <div className="metric-info">
                  <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekly Reports</h3>
                  <div className="metric-value" style={{ fontSize: '1.4rem' }}>
                    {(project.weeklyUpdates || []).length} Submitted
                  </div>
                </div>
              </div>

              <div className="metric-card" style={{ padding: '1rem 1.25rem' }}>
                <div className="metric-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' }}>
                  <FileText size={20} />
                </div>
                <div className="metric-info">
                  <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Documents Stored</h3>
                  <div className="metric-value" style={{ fontSize: '1.4rem' }}>
                    {(project.documents || []).length} Files
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <BookOpen size={18} style={{ color: 'var(--primary)' }} />
                Scope & Problem Statement
              </h3>

              <div style={{ padding: '0.85rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Problem Statement
                </div>
                <p style={{ fontSize: '0.85rem', lineHeight: '1.55', color: 'var(--text-main)', margin: 0 }}>
                  {project.problemStatement || 'Manual tracking of final year academic projects causes delays, fragmented feedback, and lack of visibility between students, guides, and departments.'}
                </p>
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Key Objectives
                </div>
                <p style={{ fontSize: '0.85rem', lineHeight: '1.55', color: 'var(--text-main)', margin: 0, whiteSpace: 'pre-line' }}>
                  {Array.isArray(project.objectives) ? project.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n') : (project.objectives || '1. Centralize proposal review and digital approval.\n2. Enable milestone and task management.\n3. Track weekly progress and marks evaluation.')}
                </p>
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Abstract / Description
                </div>
                <p style={{ fontSize: '0.85rem', lineHeight: '1.55', color: 'var(--text-main)', margin: 0 }}>
                  {project.abstract || project.description || 'A unified web application for managing academic final-year projects between students, faculty guides, and administrators.'}
                </p>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} />
                Metadata & Roster
              </h3>

              <div style={{ padding: '0.85rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Department & Domain
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                  {project.dept} • <span style={{ color: 'var(--primary)' }}>{project.domain}</span>
                </div>
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Technology Stack
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {formatList(project.technologies || project.techStack, 'React, Node.js, Express, MongoDB')}
                </div>
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Team Members & Lead
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                  Lead: {project.leadName} {project.regNo ? `(${project.regNo})` : ''}
                </div>
                {(() => {
                  const rawList = (Array.isArray(project.rawTeamMembers) && project.rawTeamMembers.length > 0)
                    ? project.rawTeamMembers
                    : (Array.isArray(project.teamMembers) ? project.teamMembers : []);
                  const peers = rawList.filter((m, idx) => {
                    const mName = typeof m === 'object' ? (m.name || m.student?.name) : String(m);
                    const mReg = typeof m === 'object' ? (m.regNo || m.student?.regNo) : '';
                    if (project.regNo && mReg && mReg === project.regNo) return false;
                    if (project.leadName && mName && mName.toLowerCase().trim() === project.leadName.toLowerCase().trim()) return false;
                    return idx > 0;
                  });
                  return (
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {peers.length > 0
                        ? `Members: ${peers.map(m => typeof m === 'object' ? (m.name || m.regNo) : m).join(', ')}`
                        : 'Solo Project (No additional members)'}
                    </div>
                  );
                })()}
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Faculty Guide Status
                </div>
                {(project.guideName || (typeof project.guide === 'object' ? project.guide?.name : null)) ? (
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <UserCheck size={16} />
                    <span>{project.guideName || project.guide?.name}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={15} className="status-text-loading" />
                    <span>Guide will be assigned upon faculty review</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MILESTONES AND TASKS */}
      {activeTab === 'milestones' && (
        !isApproved ? (
          renderLockedSection('Milestones & Project Stages', Sparkles, 'Dynamic stage roadmap, custom milestones, and task boards are locked until your project proposal is approved by your faculty guide.')
        ) : (
          <div>
            {/* Milestones Stepper Header */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                    <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                    Milestones and Project Stages
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem', margin: 0 }}>
                    Dynamic stage roadmap with deadline tracking, guide certification, and automated progress derivation.
                  </p>
                </div>
                {!isViewOnly && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleOpenAddMilestone}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.825rem',
                      padding: '0.45rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      borderColor: 'var(--primary)',
                      color: 'var(--primary)'
                    }}
                  >
                    <Plus size={15} />
                    <span>Add Custom Milestone</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.95rem' }}>
                {(project.milestones || []).map((m, index) => {
                  const totalInMs = m.totalTasks !== undefined
                    ? m.totalTasks
                    : (project.tasks || []).filter(t => (t.milestoneId === m.id || t.milestone === m.id || t.milestoneId === m._id || t.milestone === m._id)).length;
                  const completedInMs = m.completedTasks !== undefined
                    ? m.completedTasks
                    : (project.tasks || []).filter(t => (t.milestoneId === m.id || t.milestone === m.id || t.milestoneId === m._id || t.milestone === m._id) && ['COMPLETED', 'Completed'].includes(t.status)).length;

                  return (
                    <div
                      key={m.id || m._id || m.number || index}
                      className={`stepper-card ${m.status === 'COMPLETED' ? 'completed' : m.status === 'IN_PROGRESS' ? 'current' : ''}`}
                      style={{ padding: '0.9rem', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}
                    >
                      <div>
                        {/* Top Row: Stage & Dates & Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span className="step-num" style={{ color: m.status === 'COMPLETED' ? 'var(--success)' : m.status === 'IN_PROGRESS' ? 'var(--primary)' : 'var(--text-dim)', fontWeight: 800 }}>
                              Stage {m.number || (index + 1)} {m.status === 'COMPLETED' ? '✓' : ''}
                            </span>
                            {m.isCustom && (
                              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontWeight: 700 }}>
                                Custom
                              </span>
                            )}
                          </div>
                          {!isViewOnly && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditMilestone(m)}
                                title="Edit milestone title, description, or target deadline"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  borderRadius: '4px'
                                }}
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteMilestone(m)}
                                title="Delete this milestone stage"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--danger, #ef4444)',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  borderRadius: '4px'
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div className="step-title" style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                          {m.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', lineHeight: '1.3' }}>
                          {m.description || 'Milestone deliverable stage.'}
                        </div>
                      </div>

                      <div>
                        {/* Meta info: Tasks count & Due Date */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                          <span>
                            <ListTodo size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                            {completedInMs}/{totalInMs} Tasks
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                            <Calendar size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                            {formatDisplayDate(m.dueDate)}
                          </span>
                        </div>

                        {/* Guide Verification Badge */}
                        {m.verifiedByGuide && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.68rem',
                              color: 'var(--success, #10b981)',
                              background: 'rgba(16, 185, 129, 0.1)',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '4px',
                              marginBottom: '0.45rem',
                              fontWeight: 700
                            }}
                            title={m.guideComments ? `Guide remark: "${m.guideComments}"` : 'Officially certified by Faculty Guide'}
                          >
                            <ShieldCheck size={12} />
                            Verified by Guide ✓
                          </div>
                        )}

                        {/* Progress bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          <span>Completion</span>
                          <span style={{ fontWeight: 700, color: m.status === 'COMPLETED' ? 'var(--success)' : 'var(--text-main)' }}>
                            {m.progress || 0}%
                          </span>
                        </div>
                        <div style={{ background: 'var(--bg-glass)', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${m.progress || 0}%`, height: '100%', background: m.status === 'COMPLETED' ? 'var(--success)' : 'var(--primary)', transition: 'width 0.3s ease' }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tasks Management Section */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ListTodo size={18} style={{ color: 'var(--primary)' }} />
                    Milestone Task Manager
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.15rem' }}>
                    Create and manage actionable tasks nested under specific milestone stages.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button
                    className="btn-aesthetic btn-glass-secondary btn-sm"
                    onClick={handleRunPrioritization}
                    disabled={isPrioritizing}
                  >
                    {isPrioritizing ? (
                      <ProjIntelSpinner size="xs" inline label="Prioritizing..." />
                    ) : (
                      <>
                        <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                        <span>AI Prioritize Tasks</span>
                      </>
                    )}
                  </button>

                  {!isViewOnly && (
                    <button
                      className="btn-aesthetic btn-primary-glow btn-sm"
                      onClick={() => {
                        if (project?.milestones && project.milestones.length > 0) {
                          setTaskForm(prev => ({
                            ...prev,
                            milestoneId: project.milestones[0].id || project.milestones[0]._id || 'm1'
                          }));
                        }
                        setIsTaskModalOpen(true);
                      }}
                    >
                      <Plus size={15} />
                      <span>Add New Task</span>
                    </button>
                  )}
                </div>
              </div>

              {project.tasks && project.tasks.length > 0 ? (() => {
                const activeTasks = project.tasks.filter(t => t.status !== 'COMPLETED');
                const completedTasks = project.tasks.filter(t => t.status === 'COMPLETED');

                const renderTaskRow = (task) => {
                  const parentMs = (project.milestones || []).find(
                    m => m.id === task.milestoneId || m._id === task.milestoneId || m.id === task.milestone || m._id === task.milestone
                  );
                  const dueTag = getTaskDueTag(task.dueDate, task.status);
                  const isCompleted = task.status === 'COMPLETED';

                  return (
                    <div
                      key={task.id || task._id}
                      style={{
                        padding: '1.1rem 1.25rem',
                        background: 'rgba(255, 255, 255, 0.025)',
                        borderRadius: '12px',
                        border: isCompleted
                          ? '1px solid rgba(16, 185, 129, 0.28)'
                          : '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                      }}
                    >
                      {/* Left: Checkbox & Task Information */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => { if (!isViewOnly) handleToggleTaskStatus(task); }}
                          disabled={isViewOnly}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: isViewOnly ? 'default' : 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            flexShrink: 0,
                            transition: 'transform 0.15s ease'
                          }}
                          onMouseEnter={(e) => { if (!isViewOnly) e.currentTarget.style.transform = 'scale(1.12)'; }}
                          onMouseLeave={(e) => { if (!isViewOnly) e.currentTarget.style.transform = 'scale(1)'; }}
                          title={isViewOnly ? `Status: ${task.status} (View-Only Mode)` : `Status: ${task.status}. Click to change.`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={26} style={{ color: '#10b981' }} />
                          ) : task.status === 'IN_PROGRESS' ? (
                            <Clock size={26} style={{ color: '#818cf8' }} />
                          ) : (
                            <div style={{
                              width: 24,
                              height: 24,
                              borderRadius: '7px',
                              border: '2.5px solid var(--text-dim, rgba(255, 255, 255, 0.38))',
                              background: 'rgba(255, 255, 255, 0.03)'
                            }} />
                          )}
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Badges line: Stage + Priority + Dynamic Due in Days Tag + Exact Date */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                            {parentMs && (
                              <span style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.55rem',
                                borderRadius: '5px',
                                background: 'rgba(99, 102, 241, 0.12)',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                color: '#a5b4fc',
                                fontWeight: 700
                              }}>
                                Stage {parentMs.number}: {parentMs.title}
                              </span>
                            )}

                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '5px',
                              textTransform: 'uppercase',
                              background: task.priority === 'HIGH'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : task.priority === 'LOW'
                                  ? 'rgba(148, 163, 184, 0.12)'
                                  : 'rgba(245, 158, 11, 0.15)',
                              color: task.priority === 'HIGH'
                                ? '#f87171'
                                : task.priority === 'LOW'
                                  ? '#94a3b8'
                                  : '#fbbf24',
                              border: `1px solid ${task.priority === 'HIGH' ? 'rgba(239, 68, 68, 0.3)' : task.priority === 'LOW' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(245, 158, 11, 0.3)'}`
                            }}>
                              {task.priority || 'MEDIUM'}
                            </span>

                            {/* Tag showing task due in days */}
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.55rem',
                              borderRadius: '5px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: dueTag.bg,
                              color: dueTag.color,
                              border: dueTag.border
                            }}>
                              <Clock size={11} />
                              {dueTag.text}
                            </span>

                            {task.dueDate && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                                ({formatDisplayDate(task.dueDate)})
                              </span>
                            )}
                          </div>

                          {/* Task Title */}
                          <div style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: isCompleted ? 'var(--text-muted, #94a3b8)' : 'var(--text-main, #f8fafc)',
                            textDecoration: isCompleted ? 'line-through' : 'none',
                            lineHeight: 1.4,
                            wordBreak: 'break-word'
                          }}>
                            {task.title}
                          </div>

                          {/* Task Description */}
                          {task.description && (
                            <div style={{
                              fontSize: '0.825rem',
                              color: 'var(--text-muted, #94a3b8)',
                              marginTop: '0.25rem',
                              lineHeight: 1.45,
                              wordBreak: 'break-word'
                            }}>
                              {task.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions (Status Pill, Edit Button, Delete Button) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => { if (!isViewOnly) handleToggleTaskStatus(task); }}
                          disabled={isViewOnly}
                          title={isViewOnly ? `Status: ${task.status} (View-Only Mode)` : "Click to advance status"}
                          style={{
                            background: isCompleted
                              ? 'rgba(16, 185, 129, 0.12)'
                              : task.status === 'IN_PROGRESS'
                                ? 'rgba(99, 102, 241, 0.14)'
                                : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.3)' : task.status === 'IN_PROGRESS' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.12)'}`,
                            color: isCompleted ? '#34d399' : task.status === 'IN_PROGRESS' ? '#a5b4fc' : 'var(--text-secondary, #cbd5e1)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '0.3rem 0.75rem',
                            borderRadius: '20px',
                            cursor: isViewOnly ? 'default' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          {isCompleted ? <CheckCircle2 size={12} /> : task.status === 'IN_PROGRESS' ? <Clock size={12} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
                          <span>{isCompleted ? 'Completed' : task.status === 'IN_PROGRESS' ? 'In Progress' : 'To Do'}</span>
                        </button>

                        {!isViewOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditTask(task)}
                              title="Edit this task"
                              style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                                color: 'var(--text-secondary, #cbd5e1)',
                                cursor: 'pointer',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <Edit3 size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete task "${task.title}"?`)) {
                                  if (onDeleteTask) onDeleteTask(project.id || project._id, task.id || task._id);
                                }
                              }}
                              title="Delete this task"
                              style={{
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: 'var(--danger, #ef4444)',
                                cursor: 'pointer',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {activeTasks.length > 0 ? (
                      activeTasks.map(renderTaskRow)
                    ) : (
                      <div style={{
                        padding: '1.1rem',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        color: '#34d399',
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}>
                        <CheckCircle2 size={18} />
                        <span>All active milestone tasks completed! Great progress.</span>
                      </div>
                    )}

                    {completedTasks.length > 0 && (
                      <div style={{
                        marginTop: activeTasks.length > 0 ? '1.5rem' : '0.5rem',
                        paddingTop: activeTasks.length > 0 ? '1.25rem' : '0.5rem',
                        borderTop: activeTasks.length > 0 ? '1px dashed rgba(255, 255, 255, 0.12)' : 'none'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.85rem',
                          color: '#10B981',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          <CheckCircle2 size={16} />
                          <span>Completed Tasks ({completedTasks.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {completedTasks.map(renderTaskRow)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <ListTodo size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '0.875rem' }}>No milestone tasks created yet. Click "Add New Task" to begin breakdown.</p>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* TAB 3: WEEKLY PROGRESS SUBMISSIONS */}
      {activeTab === 'weekly' && (
        !isApproved ? (
          renderLockedSection('Weekly Progress Reports', TrendingUp, 'Weekly progress updates, blocker reporting, and faculty evaluations are locked until your project proposal is approved by your faculty guide.')
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
                  Weekly Progress Reports
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.15rem' }}>
                  Log work completed, roadblocks, and next week's targets for faculty evaluation.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                {(project.weeklyUpdates && project.weeklyUpdates.length > 0) && (
                  <button
                    type="button"
                    className="btn-aesthetic btn-glass-secondary btn-sm"
                    onClick={handleExportWeeklyPDF}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                    title="Export official cumulative weekly progress logbook as printable PDF"
                  >
                    <Download size={14} />
                    <span>Download Weekly Logbook (PDF)</span>
                  </button>
                )}
                {!isViewOnly && (
                  <button
                    className="btn-aesthetic btn-primary-glow btn-sm"
                    onClick={handleOpenNewWeekly}
                  >
                    <Plus size={15} />
                    <span>Submit Week {nextWeekNumber} Progress</span>
                  </button>
                )}
              </div>
            </div>

            {project.weeklyUpdates && project.weeklyUpdates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {project.weeklyUpdates.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      padding: '1.15rem',
                      background: 'var(--bg-glass)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="project-domain-badge" style={{ background: 'var(--primary)', color: 'white' }}>
                          Week #{w.weekNumber}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date: {w.date || (w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'Recent')}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>Progress: {w.progressPct}%</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {(w.facultyFeedback || w.feedback || w.status === 'GRADED') ? (
                          <span className="project-status-badge status-completed" style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10B981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}>
                            <CheckCircle2 size={13} />
                            <span>Feedback Received</span>
                          </span>
                        ) : (
                          <>
                            <span className="project-status-badge status-under-review" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Clock size={12} className="status-text-loading" />
                              <span>Awaiting Faculty Feedback</span>
                            </span>
                            {!isViewOnly && (
                              <button
                                type="button"
                                className="btn-aesthetic btn-glass-secondary btn-sm"
                                onClick={() => handleOpenEditWeekly(w)}
                                title="Edit this weekly report before faculty feedback is given"
                                style={{
                                  padding: '0.2rem 0.6rem',
                                  fontSize: '0.75rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  borderRadius: '6px'
                                }}
                              >
                                <Edit3 size={12} />
                                <span>Edit</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem', marginBottom: '0.75rem' }}>
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
                          Problems / Obstacles
                        </div>
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                          {w.problemsFaced || 'None encountered'}
                        </p>
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Next Week's Plan
                        </div>
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                          {w.nextWeekPlan}
                        </p>
                      </div>
                    </div>

                    {(w.facultyFeedback || w.feedback) && (
                      <div style={{ padding: '0.75rem 1rem', background: 'rgba(99, 102, 241, 0.12)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <UserCheck size={14} />
                          <span>Faculty Guide Feedback & Guidance:</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                          "{w.facultyFeedback || w.feedback}"
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <TrendingUp size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.875rem' }}>No weekly updates submitted yet. Click "+ Submit Week 1 Progress" to start.</p>
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 4: DOCUMENTS & FILES */}
      {activeTab === 'documents' && (
        !isApproved ? (
          renderLockedSection('Project Document Repository', FileText, 'Uploading, downloading, and storing deliverables (SRS, diagrams, presentations) are locked until your project proposal is approved by your faculty guide.')
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <FileText size={18} style={{ color: 'var(--primary)' }} />
                  Project Document Repository
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem', marginBottom: 0 }}>
                  Upload, download, and manage your project deliverables, SRS, diagrams, and presentations.
                </p>
              </div>

              {!isViewOnly && (
                <button
                  className="btn-aesthetic btn-primary-glow btn-sm"
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <Upload size={15} />
                  <span>Upload Document</span>
                </button>
              )}
            </div>

            {/* Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Filter size={13} /> Filter Category:
              </label>
              <select
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="aesthetic-input"
                style={{
                  maxWidth: '280px',
                  padding: '6px 12px',
                  fontSize: '0.825rem',
                  borderRadius: '8px',
                  background: 'var(--bg-glass, rgba(255, 255, 255, 0.05))',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Documents ({project.documents?.length || 0})</option>
                <option value="IEEE">IEEE Paper / Manuscript</option>
                <option value="Synopsis">Synopsis</option>
                <option value="SRS">SRS</option>
                <option value="Design Document">Design Document</option>
                <option value="Source Code">Source Code</option>
                <option value="Test Report">Test Report</option>
                <option value="Presentation">Presentation</option>
                <option value="Final Report">Final Report</option>
              </select>
            </div>

            {project.documents && project.documents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(docFilter === 'ALL'
                  ? project.documents
                  : project.documents.filter(d =>
                    docFilter === 'IEEE'
                      ? (d.docType === 'IEEE' || d.documentType === 'IEEE' || (d.docType && d.docType.toLowerCase().includes('ieee')) || (d.fileName && d.fileName.toLowerCase().includes('ieee')))
                      : (d.docType === docFilter || d.documentType === docFilter)
                  )
                ).map((doc) => {
                  const ext = (doc.fileName || '').split('.').pop()?.toLowerCase();
                  const isPdf = ext === 'pdf';
                  const isPpt = ['ppt', 'pptx'].includes(ext);
                  const isZip = ['zip', 'rar', 'tar', 'gz'].includes(ext);

                  const fileDownloadUrl = getFileUrl(doc.filePath);

                  return (
                    <div
                      key={doc.id || doc._id}
                      style={{
                        padding: '0.9rem 1.15rem',
                        background: 'var(--bg-glass)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
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
                          {isPdf ? <FileText size={20} /> : isPpt ? <Presentation size={20} /> : isZip ? <FileArchive size={20} /> : <FileCode size={20} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{doc.fileName}</span>
                            <span className="project-domain-badge" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                              {doc.docType || 'Document'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                            <span>Format: <strong>{doc.documentType || ext?.toUpperCase() || 'PDF'}</strong></span>
                            <span>Version: <strong>v{doc.version || '1.0'}</strong></span>
                            <span>Uploaded: <strong>{doc.uploadDate || 'Recent'}</strong></span>
                            <span>Size: <strong>{doc.fileSize || '1.5 MB'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

                        {!isViewOnly && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc.id || doc._id)}
                            className="btn-aesthetic btn-glass-secondary btn-sm"
                            style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '0.35rem 0.6rem' }}
                            title="Delete Document"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <FileText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.875rem' }}>No documents found matching the filter. Click "+ Upload Document" to upload a deliverable.</p>
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 5: FACULTY FEEDBACK & DISCUSSION */}
      {activeTab === 'feedback' && (
        !isApproved ? (
          renderLockedSection('Faculty Guide Discussion', MessageSquare, 'Guide feedback discussions and live messaging are locked until your project proposal is approved by your faculty guide.')
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MessageSquare size={18} style={{ color: 'var(--primary)' }} />
              Guide Feedback & Live Guidance Discussion
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.5rem' }}>
              {(project.comments || []).map((c, cIdx) => (
                <div
                  key={c._id || c.id || cIdx}
                  className={`chat-bubble ${c.isGuide ? 'chat-bubble-guide' : 'chat-bubble-student'}`}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    marginLeft: c.isGuide ? '0' : '2rem',
                    marginRight: c.isGuide ? '2rem' : '0'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: c.isGuide ? 'var(--primary)' : 'var(--text-main)' }}>
                      {c.author}
                    </span>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      {typeof c.time === 'string' && (c.time.includes('T') || c.time.includes('Z'))
                        ? new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : (c.time || 'Just now')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0 }}>{c.text}</p>
                </div>
              ))}
            </div>

            {isViewOnly ? (
              <div style={{
                padding: '0.85rem 1.15rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
              }}>
                <Lock size={15} style={{ color: '#10B981' }} />
                <span>This project is officially completed and certified. Faculty guide discussion thread is archived in View-Only Mode.</span>
              </div>
            ) : (
              <form onSubmit={handleSendComment} style={{ display: 'flex', gap: '0.65rem' }}>
                <input
                  type="text"
                  placeholder={`Send message to faculty guide (${project.guideName || 'Assigned Guide'})...`}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="aesthetic-input"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-aesthetic btn-primary-glow btn-sm">
                  <Send size={15} />
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        )
      )}

      {/* TAB 6: REVIEWS EVALUATION */}
      {activeTab === 'reviews' && (
        !isApproved ? (
          renderLockedSection('Reviews & Evaluations', Award, 'Scheduled reviews and evaluation deliverable submissions are locked until your project proposal is approved by your faculty guide.')
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <StudentReviewSection
              reviews={reviews}
              project={project}
              studentUser={user}
              isCompleted={isCompleted}
              isViewOnly={isViewOnly}
              onSubmitReviewDeliverable={onSubmitReviewDeliverable}
              onRefreshReviews={handleManualSync}
            />
          </div>
        )
      )}

      {/* TAB 7: IEEE DETAILS (Exclusive to Final Year Students Only) */}
      {activeTab === 'ieee' && isFinalYear && (
        !isApproved ? (
          renderLockedSection('IEEE Details & Manuscript Tracking', Sparkles, 'IEEE paper uploads, conference tracking, and publication proof management are locked until your project proposal is approved by your faculty guide.')
        ) : (
          <IEEEStudentSection
            project={project}
            user={user}
            onUpdateProject={(updatedProj, opts = {}) => {
              if (onUpdateProject) {
                onUpdateProject(updatedProj, { ...opts, silent: true, skipApi: true });
              }
            }}
            isViewOnly={isViewOnly}
          />
        )
      )}

      {/* ============================================================
          AI TASK PRIORITIZATION MODAL (Per Section 16 Requirement)
          ============================================================ */}
      {isPrioritizerOpen && (
        <div className="ai-modal-overlay" onClick={() => setIsPrioritizerOpen(false)}>
          <div className="ai-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="brand-icon" style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>AI Task Prioritization Engine</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Schedule & dependency optimization</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setIsPrioritizerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="ai-modal-body">
              {isPrioritizing ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <ProjIntelSpinner size="xl" label="Prioritizing Tasks with AI..." />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>Evaluating deadlines, milestones, and blocking dependencies.</p>
                </div>
              ) : (
                <>
                  {prioritizationData?.summary && (
                    <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.25)', marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                        Strategic Guidance
                      </div>
                      <p style={{ fontSize: '0.86rem', margin: 0, color: 'var(--text-main)', lineHeight: '1.5' }}>
                        {prioritizationData.summary}
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(prioritizationData?.prioritizedTasks || []).map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '1rem',
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>#{t.rank || idx + 1}</span> {t.title}
                          </span>
                          <span
                            className={`project-status-badge ${t.recommendedPriority === 'CRITICAL' || t.recommendedPriority === 'HIGH' ? 'status-revision' : 'status-in-progress'}`}
                            style={{ fontSize: '0.75rem', padding: '0.15rem 0.55rem' }}
                          >
                            Recommended: {t.recommendedPriority}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.45' }}>
                          <strong>Reason:</strong> {t.reason}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                          <button
                            className="btn-aesthetic btn-glass-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                            onClick={() => {
                              // Human in the loop: student clicks to update priority
                              const matchedTask = (project.tasks || []).find(pt => pt.title === t.title || pt.id === t.taskId);
                              if (matchedTask) {
                                const newP = t.recommendedPriority === 'CRITICAL' ? 'HIGH' : t.recommendedPriority;
                                const updatedTasks = (project.tasks || []).map(pt => pt.id === matchedTask.id ? { ...pt, priority: newP } : pt);
                                onUpdateProject({ ...project, tasks: updatedTasks });
                                alert(`Updated priority for "${t.title}" to ${newP}.`);
                              }
                            }}
                          >
                            <Check size={12} />
                            <span>Apply Recommended Priority</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
                    * AI recommendations are advisory. Click "Apply Recommended Priority" to adopt suggestions.
                  </p>
                </>
              )}
            </div>

            <div className="ai-modal-footer">
              <button className="btn-aesthetic btn-glass-secondary btn-sm" onClick={() => setIsPrioritizerOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          AI PROJECT SUMMARY MODAL (Per Section 17 Requirement)
          ============================================================ */}
      {isSummaryOpen && (
        <div className="ai-modal-overlay" onClick={() => setIsSummaryOpen(false)}>
          <div className="ai-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="brand-icon" style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Executive AI Project Summary</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Verified milestone & task intelligence</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setIsSummaryOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="ai-modal-body">
              {isSummaryLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <ProjIntelSpinner size="xl" label="Generating AI Summary..." />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>Synthesizing active milestones, completed deliverables, and blockers.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="ai-section-box">
                    <div className="ai-section-title">Status Overview</div>
                    <p style={{ fontSize: '0.875rem', lineHeight: '1.5', margin: 0, color: 'var(--text-main)' }}>
                      {summaryData?.statusSummary || 'Project is currently progressing through system design and initial backend architecture.'}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div className="ai-section-box" style={{ margin: 0 }}>
                      <div className="ai-section-title">Completed Work</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.825rem', lineHeight: '1.45' }}>
                        {(summaryData?.completedWork || ['Completed initial problem definition and SRS.']).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="ai-section-box" style={{ margin: 0 }}>
                      <div className="ai-section-title">Pending Work</div>
                      <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.825rem', lineHeight: '1.45' }}>
                        {(summaryData?.pendingWork || ['Build Express REST Endpoints', 'Implement React UI']).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="ai-section-box" style={{ margin: 0 }}>
                    <div className="ai-section-title">Upcoming Focus</div>
                    <p style={{ fontSize: '0.86rem', lineHeight: '1.5', margin: 0, color: 'var(--text-main)' }}>
                      {summaryData?.upcomingFocus || 'Complete API routing and verify requirements coverage across all user roles.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="ai-modal-footer">
              <button className="btn-aesthetic btn-glass-secondary btn-sm" onClick={() => setIsSummaryOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      <EditTeamModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        team={project}
        onSave={(updated) => {
          if (onUpdateProject) onUpdateProject(updated);
        }}
      />

      {/* Add Task Modal */}
      {isTaskModalOpen && (
        <div className="modal-backdrop-overlay" onClick={() => setIsTaskModalOpen(false)}>
          <div className="aesthetic-modal-card" style={{ maxWidth: '480px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsTaskModalOpen(false)}>
              <X size={16} />
            </button>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={18} style={{ color: 'var(--primary)' }} />
              Add Milestone Task
            </h3>
            <form onSubmit={handleCreateTaskSubmit}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Database Schema for Mongoose"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="aesthetic-input"
                  style={{ paddingLeft: '0.85rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Milestone Stage</label>
                <select
                  value={taskForm.milestoneId}
                  onChange={(e) => setTaskForm({ ...taskForm, milestoneId: e.target.value })}
                  className="aesthetic-input"
                  style={{ paddingLeft: '0.85rem' }}
                >
                  {project?.milestones && project.milestones.length > 0 ? (
                    project.milestones.map((m, idx) => (
                      <option key={m.id || m._id || idx} value={m.id || m._id}>
                        {m.number ? `${m.number}. ` : `${idx + 1}. `}{m.title}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="m1">1. Problem Definition</option>
                      <option value="m2">2. Literature Survey</option>
                      <option value="m3">3. Requirements Analysis</option>
                      <option value="m4">4. System Design</option>
                      <option value="m5">5. Implementation</option>
                      <option value="m6">6. Testing</option>
                      <option value="m7">7. Documentation</option>
                      <option value="m8">8. Final Presentation</option>
                    </>
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Due Date</label>
                  <input
                    type="date"
                    min={todayDateStr}
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Task Description</label>
                <textarea
                  rows="2"
                  placeholder="Task details and expected outcome..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="aesthetic-input"
                  style={{ padding: '0.5rem 0.85rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <button type="submit" className="btn-aesthetic btn-primary-glow" style={{ width: '100%', padding: '0.65rem' }}>
                <CheckCircle2 size={16} />
                <span>Save Milestone Task</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {isEditTaskModalOpen && selectedTaskForEdit && (
        <div className="modal-backdrop-overlay" onClick={() => setIsEditTaskModalOpen(false)}>
          <div className="aesthetic-modal-card" style={{ maxWidth: '480px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsEditTaskModalOpen(false)}>
              <X size={16} />
            </button>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Edit3 size={18} style={{ color: 'var(--primary)' }} />
              Edit Milestone Task
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Update task title, milestone stage, priority, due date, status, or description.
            </p>

            <form onSubmit={handleSaveEditTask}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={editTaskForm.title}
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
                  className="aesthetic-input"
                  style={{ paddingLeft: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Milestone Stage</label>
                  <select
                    value={editTaskForm.milestoneId}
                    onChange={(e) => setEditTaskForm({ ...editTaskForm, milestoneId: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  >
                    {project?.milestones && project.milestones.length > 0 ? (
                      project.milestones.map((m, idx) => (
                        <option key={m.id || m._id || idx} value={m.id || m._id}>
                          {m.number ? `${m.number}. ` : `${idx + 1}. `}{m.title}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="m1">1. Problem Definition</option>
                        <option value="m2">2. Literature Survey</option>
                        <option value="m3">3. Requirements Analysis</option>
                        <option value="m4">4. System Design</option>
                        <option value="m5">5. Implementation</option>
                        <option value="m6">6. Testing</option>
                        <option value="m7">7. Documentation</option>
                        <option value="m8">8. Final Presentation</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    value={editTaskForm.priority}
                    onChange={(e) => setEditTaskForm({ ...editTaskForm, priority: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Target Due Date</label>
                  <input
                    type="date"
                    min={todayDateStr}
                    value={editTaskForm.dueDate}
                    onChange={(e) => setEditTaskForm({ ...editTaskForm, dueDate: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    value={editTaskForm.status}
                    onChange={(e) => setEditTaskForm({ ...editTaskForm, status: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  >
                    <option value="TODO">TODO</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Task Description</label>
                <textarea
                  rows="2"
                  placeholder="Task details and expected deliverables..."
                  value={editTaskForm.description}
                  onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })}
                  className="aesthetic-input"
                  style={{ padding: '0.5rem 0.85rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsEditTaskModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-aesthetic btn-primary-glow btn-sm">
                  <CheckCircle2 size={15} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          SUBMIT WEEKLY PROGRESS MODAL WITH AI ANALYSIS (Per Section 18)
          ============================================================ */}
      {isWeeklyModalOpen && (
        <div className="modal-backdrop-overlay" onClick={handleCloseWeeklyModal}>
          <div className="aesthetic-modal-card" style={{ maxWidth: '620px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseWeeklyModal}>
              <X size={16} />
            </button>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
              {editingWeekly ? `Edit Week ${editingWeekly.weekNumber} Progress` : `Submit Week ${nextWeekNumber} Progress`}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {editingWeekly
                ? `Update your progress details for Week #${editingWeekly.weekNumber}. Editing is permitted only before faculty feedback is given.`
                : `Enter your progress details for Week #${nextWeekNumber}.`}
            </p>

            <form onSubmit={handleWeeklySubmit}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Cumulative Percentage (0-100)% *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  placeholder="e.g. 45"
                  value={weeklyForm.progressPct}
                  onChange={(e) => setWeeklyForm({ ...weeklyForm, progressPct: e.target.value })}
                  className="aesthetic-input"
                  style={{ paddingLeft: '0.85rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Work Completed This Week *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Summary of work completed this week..."
                  value={weeklyForm.workCompleted}
                  onChange={(e) => setWeeklyForm({ ...weeklyForm, workCompleted: e.target.value })}
                  className="aesthetic-input"
                  style={{ padding: '0.5rem 0.85rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Challenges Faced</label>
                <textarea
                  rows="2"
                  placeholder="Any roadblocks or challenges encountered..."
                  value={weeklyForm.problemsFaced}
                  onChange={(e) => setWeeklyForm({ ...weeklyForm, problemsFaced: e.target.value })}
                  className="aesthetic-input"
                  style={{ padding: '0.5rem 0.85rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Next Week Plan *</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Planned work and deliverables for next week..."
                  value={weeklyForm.nextWeekPlan}
                  onChange={(e) => setWeeklyForm({ ...weeklyForm, nextWeekPlan: e.target.value })}
                  className="aesthetic-input"
                  style={{ padding: '0.5rem 0.85rem', resize: 'vertical' }}
                ></textarea>
              </div>

              {/* AI Report Analysis Section */}
              {weeklyAnalysis && (
                <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#818CF8', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Sparkles size={14} /> AI Report Analysis
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    <strong>Summary:</strong> {weeklyAnalysis.summary}
                  </div>
                  {weeklyAnalysis.detectedBlockers?.length > 0 && (
                    <div style={{ fontSize: '0.82rem', color: '#F87171', marginBottom: '0.35rem' }}>
                      <strong>Potential Blocker:</strong> {weeklyAnalysis.detectedBlockers.join(', ')}
                    </div>
                  )}
                  {weeklyAnalysis.clarityImprovements && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <strong>Clarity Tip:</strong> {weeklyAnalysis.clarityImprovements}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-aesthetic btn-glass-secondary btn-sm"
                  onClick={handleAnalyzeWeeklyDraft}
                  disabled={isAnalyzingWeekly}
                >
                  {isAnalyzingWeekly ? (
                    <ProjIntelSpinner size="xs" inline label="Analyzing Draft..." />
                  ) : (
                    <>
                      <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                      <span>Analyze with AI</span>
                    </>
                  )}
                </button>

                <button type="submit" className="btn-aesthetic btn-primary-glow btn-sm">
                  {editingWeekly ? <CheckCircle2 size={15} /> : <Send size={15} />}
                  <span>{editingWeekly ? 'Save Changes' : 'Submit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Milestone Modal */}
      {isAddMilestoneModalOpen && (
        <div className="modal-backdrop-overlay" onClick={() => setIsAddMilestoneModalOpen(false)}>
          <div className="aesthetic-modal-card" style={{ maxWidth: '480px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsAddMilestoneModalOpen(false)}>
              <X size={16} />
            </button>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={18} style={{ color: 'var(--primary)' }} />
              Add Custom Project Milestone
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Define a new milestone stage with targeted deadline for your project roadmap.
            </p>

            <form onSubmit={handleSaveAddMilestone}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Milestone Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Model Fine-Tuning & Hyperparameter Sweep"
                  value={milestoneFormData.title}
                  onChange={(e) => setMilestoneFormData({ ...milestoneFormData, title: e.target.value })}
                  className="aesthetic-input"
                  style={{ paddingLeft: '0.85rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Description / Deliverable Goal</label>
                <textarea
                  rows="2"
                  placeholder="Key outputs expected upon milestone completion..."
                  value={milestoneFormData.description}
                  onChange={(e) => setMilestoneFormData({ ...milestoneFormData, description: e.target.value })}
                  className="aesthetic-input"
                  style={{ padding: '0.5rem 0.85rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    value={milestoneFormData.startDate}
                    onChange={(e) => setMilestoneFormData({ ...milestoneFormData, startDate: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Deadline *</label>
                  <input
                    type="date"
                    required
                    min={todayDateStr}
                    value={milestoneFormData.dueDate}
                    onChange={(e) => setMilestoneFormData({ ...milestoneFormData, dueDate: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsAddMilestoneModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-aesthetic btn-primary-glow btn-sm">
                  <CheckCircle2 size={15} />
                  <span>Create Milestone</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Milestone Modal */}
      {isEditMilestoneModalOpen && selectedMilestoneForEdit && (
        <div className="modal-backdrop-overlay" onClick={() => setIsEditMilestoneModalOpen(false)}>
          <div className="aesthetic-modal-card" style={{ maxWidth: '480px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsEditMilestoneModalOpen(false)}>
              <X size={16} />
            </button>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Edit3 size={18} style={{ color: 'var(--primary)' }} />
              Edit Stage {selectedMilestoneForEdit.number}: {selectedMilestoneForEdit.title}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Modify milestone title, description, or target deadline.
            </p>

            <form onSubmit={handleSaveEditMilestone}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Milestone Title *</label>
                <input
                  type="text"
                  required
                  value={milestoneFormData.title}
                  onChange={(e) => setMilestoneFormData({ ...milestoneFormData, title: e.target.value })}
                  className="aesthetic-input"
                  style={{ paddingLeft: '0.85rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Description / Scope</label>
                <textarea
                  rows="2"
                  value={milestoneFormData.description}
                  onChange={(e) => setMilestoneFormData({ ...milestoneFormData, description: e.target.value })}
                  className="aesthetic-input"
                  style={{ padding: '0.5rem 0.85rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    value={milestoneFormData.startDate}
                    onChange={(e) => setMilestoneFormData({ ...milestoneFormData, startDate: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Deadline *</label>
                  <input
                    type="date"
                    required
                    min={todayDateStr}
                    value={milestoneFormData.dueDate}
                    onChange={(e) => setMilestoneFormData({ ...milestoneFormData, dueDate: e.target.value })}
                    className="aesthetic-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={() => {
                    const toDelete = selectedMilestoneForEdit;
                    setIsEditMilestoneModalOpen(false);
                    handleConfirmDeleteMilestone(toDelete);
                  }}
                  title="Remove this milestone stage from project"
                >
                  <Trash2 size={13} />
                  <span>Delete Milestone</span>
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setIsEditMilestoneModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-aesthetic btn-primary-glow btn-sm">
                    <CheckCircle2 size={15} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        project={project}
        user={user}
        onUploadSuccess={handleDocUploadSuccess}
      />

      {/* Floating or Header-connected AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        userRole="STUDENT"
        context={project}
        initialPrompt={assistantPrompt}
      />
    </div>
  );
};

export default StudentDashboard;
