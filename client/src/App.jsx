import React, { useEffect, useState, useCallback } from 'react';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import StudentDashboard from './components/StudentDashboard';
import GuideDashboard from './components/GuideDashboard';
import AdminDashboard from './components/AdminDashboard';
import GuidelinesPage from './components/GuidelinesPage';
import LoginModal from './components/LoginModal';
import NewProjectModal from './components/NewProjectModal';
import TeamFormationWorkspace from './components/TeamFormationWorkspace';
import ProjIntelSpinner from './components/ProjIntelSpinner';
import { CheckCircle2, AlertCircle, Award, FileText, History, ArrowLeft, Lock, GraduationCap } from 'lucide-react';
import { scheduleNewReview, updateReview as apiUpdateReview, deleteReview as apiDeleteReview, submitReviewDeliverable, submitOfficialEvaluation, fetchAllReviews } from './services/reviewService';
import { getMe, clearToken, getStoredToken, saveToken, verifyEmailToken } from './services/authService';
import { getProjects, createProject as apiCreateProject, updateProject as apiUpdateProject, submitProposal as apiSubmitProposal, approveProject as apiApproveProject, requestRevision as apiRequestRevision, rejectProject as apiRejectProject, assignGuide as apiAssignGuide, addComment as apiAddComment, completeProject as apiCompleteProject, reopenProject as apiReopenProject } from './services/projectService';
import { getMilestones, createMilestone as apiCreateMilestone, updateMilestone as apiUpdateMilestone, deleteMilestone as apiDeleteMilestone, verifyMilestone as apiVerifyMilestone, unverifyMilestone as apiUnverifyMilestone } from './services/milestoneService';
import { getTasks, createTask as apiCreateTask, updateTask as apiUpdateTask, deleteTask as apiDeleteTask } from './services/taskService';
import { getWeeklyProgress, submitWeeklyProgress as apiSubmitWeekly, updateWeeklyProgress as apiUpdateWeekly, gradeWeeklyReport as apiGradeWeekly } from './services/progressService';
import { getNotifications, markAllRead as apiMarkAllRead } from './services/notificationService';
import { createStudent as apiCreateStudent, updateStudent as apiUpdateStudent, deleteStudent as apiDeleteStudent, createFaculty as apiCreateFaculty, updateFaculty as apiUpdateFaculty, deleteFaculty as apiDeleteFaculty, getDepartments as apiGetDepartments } from './services/userService';
import { getSystemSettings, updateSystemSettings as apiUpdateSystemSettings } from './services/settingService';
import { fetchProjectDocuments } from './services/documentService';
import { getMyTeam, getPendingInvitations } from './services/teamService';
import { clientMockProjects, clientMockReviews, clientMockNotifications } from './mockData';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';


function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('projintel_theme') || 'dark');
  const [activeView, setActiveView] = useState('landing');

  // Live data from MongoDB
  const [projectsList, setProjectsList] = useState([]);
  const [reviewsList, setReviewsList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadingElapsed, setLoadingElapsed] = useState(0);

  useEffect(() => {
    let timer;
    if (dataLoading) {
      setLoadingElapsed(0);
      timer = setInterval(() => setLoadingElapsed(prev => prev + 1), 1000);
    } else {
      setLoadingElapsed(0);
    }
    return () => clearInterval(timer);
  }, [dataLoading]);
  const [systemSettings, setSystemSettings] = useState({
    currentAcademicYear: '2026-2027',
    availableBatches: ['2023-2027', '2024-2028', '2025-2029', '2026-2030']
  });

  // Authenticated User & Modals State
  const [user, setUser] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginModalInitialRole, setLoginModalInitialRole] = useState(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [sessionRestoring, setSessionRestoring] = useState(true);
  const [selectedArchiveProjectId, setSelectedArchiveProjectId] = useState(null);
  const [initialResetParams, setInitialResetParams] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('projintel_theme', theme);
  }, [theme]);

  // Load all projects, reviews, and notifications from live backend
  const loadAllData = useCallback(async (loggedUser, isSilent = false) => {
    if (!loggedUser) return;
    if (!isSilent) setDataLoading(true);
    const safetyFallbackTimer = setTimeout(() => {
      clearTimeout(safetyFallbackTimer);
      if (!isSilent) setDataLoading(false);
    }, 45000);
    try {
      try {
        const sRes = await getSystemSettings();
        if (sRes && sRes.success && sRes.data) {
          setSystemSettings(sRes.data);
        }
      } catch (sErr) {}

      const filters = {};
      const isFaculty = ['FACULTY', 'Faculty', 'GUIDE', 'Guide'].includes(String(loggedUser.role || '').trim());
      if (isFaculty) {
        filters.guideId = loggedUser._id || loggedUser.id || loggedUser.facultyId;
      }
      const res = await getProjects(filters);
      if (res.success && Array.isArray(res.data)) {
        // Normalize: attach milestones/tasks/weeklyUpdates/documents per project
        const enriched = await Promise.all(res.data.map(async (proj) => {
          try {
            const [mRes, tRes, wRes, dRes] = await Promise.all([
              getMilestones(proj._id),
              getTasks(proj._id),
              getWeeklyProgress(proj._id),
              fetchProjectDocuments(proj._id)
            ]);
            const parsedMilestones = mRes.success ? mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 })) : [];
            const avgProgress = parsedMilestones.length > 0
              ? Math.round(parsedMilestones.reduce((acc, m) => acc + (m.progress || 0), 0) / parsedMilestones.length)
              : (proj.progress || 0);

            return {
              ...proj,
              id: proj._id,
              progress: avgProgress,
              milestones: parsedMilestones,
              tasks: tRes.success ? tRes.data.map(t => ({ ...t, id: t._id, milestoneId: t.milestone })) : [],
              weeklyUpdates: wRes.success ? wRes.data.map(w => ({ 
                ...w, 
                id: w._id,
                progressPct: w.progressPercentage ?? w.progressPct ?? 0,
                score: w.facultyScore,
                feedback: w.facultyFeedback
              })) : [],
              documents: (dRes && dRes.success && Array.isArray(dRes.data)) 
                ? dRes.data.map(d => ({ ...d, id: d._id })) 
                : [],
              comments: proj.comments || [],
              guideName: proj.guide?.name || proj.guideName || null,
              guideId: proj.guide?._id || proj.guide?.facultyId || proj.guide?.staffId || proj.guideId || null,
              dept: proj.department?.name || proj.dept || 'Computer Science & Engineering',
              leadName: proj.teamMembers?.[0]?.name || proj.leadName || 'Student Lead',
              regNo: proj.teamMembers?.[0]?.regNo || proj.regNo || '',
              leadEmail: proj.teamMembers?.[0]?.email || proj.leadEmail || proj.email || '',
              leadRegNo: proj.teamMembers?.[0]?.regNo || proj.leadRegNo || proj.regNo || '',
              teamMembers: proj.teamMembers?.map(m => m.name || m) || [],
              rawTeamMembers: proj.teamMembers || [],
              finalGrade: proj.finalGrade || 'A+',
              finalScore: proj.finalScore ?? null,
              finalSignOffNotes: proj.finalSignOffNotes || '',
              finalSignedByGuide: !!proj.finalSignedByGuide,
              completedDate: proj.completedDate || null,
              academicYear: proj.academicYear || '2026-2027',
              batch: proj.batch || '2023-2027'
            };
          } catch {
            return { 
              ...proj, 
              id: proj._id, 
              leadName: proj.teamMembers?.[0]?.name || proj.leadName || 'Student Lead',
              regNo: proj.teamMembers?.[0]?.regNo || proj.regNo || '',
              leadEmail: proj.teamMembers?.[0]?.email || proj.leadEmail || proj.email || '',
              leadRegNo: proj.teamMembers?.[0]?.regNo || proj.leadRegNo || proj.regNo || '',
              dept: proj.department?.name || proj.dept || 'Computer Science & Engineering',
              rawTeamMembers: proj.teamMembers || [],
              teamMembers: proj.teamMembers?.map(m => m.name || m) || [],
              finalGrade: proj.finalGrade || 'A+',
              finalScore: proj.finalScore ?? null,
              finalSignOffNotes: proj.finalSignOffNotes || '',
              finalSignedByGuide: !!proj.finalSignedByGuide,
              completedDate: proj.completedDate || null,
              academicYear: proj.academicYear || '2026-2027',
              batch: proj.batch || '2023-2027',
              milestones: [], 
              tasks: [], 
              weeklyUpdates: [], 
              documents: [], 
              comments: [] 
            };
          }
        }));
        setProjectsList(enriched);
      } else if (!loggedUser) {
        setProjectsList(clientMockProjects);
      } else {
        setProjectsList([]);
      }

      // Fetch reviews
      try {
        const revRes = await fetchAllReviews();
        if (revRes && revRes.success && Array.isArray(revRes.data)) {
          setReviewsList(revRes.data.map(r => ({ ...r, id: r._id || r.id })));
        } else if (!loggedUser) {
          setReviewsList(clientMockReviews);
        } else {
          setReviewsList([]);
        }
      } catch (e) {
        if (!loggedUser) setReviewsList(clientMockReviews);
        else setReviewsList([]);
      }

      // Fetch notifications
      try {
        const uid = loggedUser?._id || loggedUser?.id;
        if (uid) {
          const notifRes = await getNotifications(uid);
          if (notifRes && notifRes.success && Array.isArray(notifRes.data)) {
            setNotifications(notifRes.data);
          } else {
            setNotifications([]);
          }
        } else if (!loggedUser) {
          setNotifications(clientMockNotifications);
        } else {
          setNotifications([]);
        }
      } catch (e) {
        if (!loggedUser) setNotifications(clientMockNotifications);
        else setNotifications([]);
      }

      // Fetch departments
      try {
        const deptRes = await apiGetDepartments();
        if (deptRes && deptRes.success && Array.isArray(deptRes.data)) {
          setDepartmentsList(deptRes.data);
        }
      } catch (e) {
        console.warn('Failed to load departments:', e);
      }

      // Fetch student team workspace data
      const isStudentRole = ['STUDENT', 'Student'].includes(String(loggedUser.role || '').trim());
      if (isStudentRole) {
        try {
          const uid = loggedUser?._id || loggedUser?.id;
          const [teamRes, invRes] = await Promise.all([
            getMyTeam(uid),
            getPendingInvitations(uid)
          ]);
          if (teamRes && teamRes.success) {
            setMyTeam(teamRes.data || null);
          } else {
            setMyTeam(null);
          }
          if (invRes && invRes.success && Array.isArray(invRes.data)) {
            setPendingInvitations(invRes.data);
          } else {
            setPendingInvitations([]);
          }
        } catch (tErr) {
          console.warn('loadAllData team error:', tErr);
          setMyTeam(null);
          setPendingInvitations([]);
        }
      }
    } catch (err) {
      console.warn('loadAllData network error:', err);
      setMyTeam(null);
      setPendingInvitations([]);
      if (!loggedUser) {
        setProjectsList(clientMockProjects);
        setReviewsList(clientMockReviews);
        setNotifications(clientMockNotifications);
      } else {
        setProjectsList([]);
        setReviewsList([]);
        setNotifications([]);
      }
    } finally {
      if (!isSilent) setDataLoading(false);
    }
  }, []);

  // Broadcast cross-tab synchronization trigger
  const notifyCrossTabSync = useCallback(() => {
    try {
      localStorage.setItem('projintel_sync_event', Date.now().toString());
    } catch (e) {}
  }, []);

  // Multi-tab synchronization listener: instantly updates other open tabs when an action occurs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'projintel_sync_event' && user) {
        loadAllData(user, true);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [user, loadAllData]);

  // Window Focus & Visibility sync (re-fetches when user switches back to this tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) {
        loadAllData(user, true);
      }
    };
    const handleFocus = () => {
      if (user) loadAllData(user, true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, loadAllData]);

  // Background auto-refresh polling (every 10 seconds while tab is active to ensure instant sync)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadAllData(user, true);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [user, loadAllData]);

  // Restore session from stored JWT on page load
  useEffect(() => {
    const token = getStoredToken();
    if (!token) { setSessionRestoring(false); return; }
    getMe()
      .then(res => {
        if (res.success && res.user) {
          const u = res.user;
          const userData = {
            ...u,
            role: u.role === 'STUDENT' ? 'Student' : u.role === 'FACULTY' ? 'Faculty' : 'Admin',
          };
          setUser(userData);
          setActiveView('dashboard');
          loadAllData(userData);
        } else {
          clearToken();
        }
      })
      .catch(() => clearToken())
      .finally(() => setSessionRestoring(false));
  }, [loadAllData]);


  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

    // Check for email verification or password reset tokens in URL query params on mount
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const verifyToken = urlParams.get('verifyEmailToken');
      const resetToken = urlParams.get('resetToken');
      const emailParam = urlParams.get('email');

      if (verifyToken) {
        verifyEmailToken(verifyToken)
          .then(res => {
            if (res && res.success) {
              showToast(res.message || 'Administrator email successfully verified!');
              if (res.token && res.user) {
                saveToken(res.token);
                const normalized = {
                  ...res.user,
                  role: 'Admin'
                };
                setUser(normalized);
                setActiveView('dashboard');
                loadAllData(normalized);
              }
            } else {
              showToast(res?.error || 'Email verification link is invalid or expired.');
            }
          })
          .catch(err => {
            showToast(err?.message || 'Failed to verify email token.');
          })
          .finally(() => {
            window.history.replaceState({}, document.title, window.location.pathname);
          });
      } else if (resetToken) {
        setInitialResetParams({
          token: resetToken,
          email: emailParam || ''
        });
        setIsLoginOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.warn('Error processing URL params:', e);
    }
  }, [loadAllData]);

  const handleOpenLogin = (role = null) => {
    if (typeof role === 'string') {
      setLoginModalInitialRole(role);
    } else {
      setLoginModalInitialRole(null);
    }
    setIsLoginOpen(true);
  };

  const handleLoginSuccess = (userData) => {
    const normalizedUser = {
      ...userData,
      role: ['FACULTY', 'Faculty', 'GUIDE', 'Guide'].includes(String(userData.role || '').trim())
        ? 'Faculty'
        : ['ADMIN', 'Admin'].includes(String(userData.role || '').trim())
        ? 'Admin'
        : 'Student'
    };
    setUser(normalizedUser);
    setActiveView('dashboard');
    loadAllData(normalizedUser);
    showToast(`Welcome back ${normalizedUser.name}! Logged into ${normalizedUser.role} Portal.`);
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setMyTeam(null);
    setPendingInvitations([]);
    setProjectsList([]);
    setReviewsList([]);
    setNotifications([]);
    setActiveView('landing');
    showToast('Signed out of session securely.');
  };


  // Project Lifecycle Handlers — all wired to real API
  const handleCreateProject = async (projectPayload, actionType) => {
    if (isPassedOutStudent) {
      showToast('Graduated / passed-out students cannot propose new projects.');
      return;
    }
    try {
      const payloadWithUser = {
        ...projectPayload,
        leadStudentId: user?._id || user?.id,
        leadName: user?.name || projectPayload.leadName,
        regNo: user?.regNo || projectPayload.regNo,
        department: user?.department?._id || user?.department?.name || user?.department || projectPayload.department,
        teamMembers: projectPayload.teamMembers || [user?._id || user?.id || user?.name]
      };
      const res = await apiCreateProject(payloadWithUser);
      if (res.success && res.data) {
        const proj = res.data;
        let initialMilestones = [];
        try {
          const mRes = await getMilestones(proj._id);
          if (mRes.success && Array.isArray(mRes.data)) {
            initialMilestones = mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }));
          }
        } catch (e) {
          console.warn('Could not fetch initial milestones:', e);
        }
        const newProj = {
          ...proj,
          id: proj._id,
          milestones: initialMilestones,
          tasks: [],
          weeklyUpdates: [],
          documents: [],
          comments: [],
          guideName: proj.guide?.name || null,
          guideId: proj.guide?._id || proj.guide?.facultyId || null,
          dept: proj.department?.name || user?.department?.name || user?.dept || 'Computer Science & Engineering',
          leadName: proj.teamMembers?.[0]?.name || user?.name || 'Student Lead',
          regNo: proj.teamMembers?.[0]?.regNo || user?.regNo || '',
          leadRegNo: proj.teamMembers?.[0]?.regNo || user?.regNo || '',
          leadEmail: proj.teamMembers?.[0]?.email || user?.email || '',
          teamMembers: proj.teamMembers?.map(m => m.name || m) || [user?.name],
          rawTeamMembers: proj.teamMembers || [],
          academicYear: proj.academicYear || '2026-2027',
          batch: proj.batch || user?.batch || '2023-2027'
        };
        setProjectsList(prev => [newProj, ...prev.filter(p => p.id !== 'proj_1' && p._id !== 'proj_1')]);
        setUser(u => u ? ({ ...u, projectId: proj._id, project: proj._id }) : u);
        if (myTeam) {
          setMyTeam(prev => prev ? { ...prev, status: 'PROPOSED', project: proj._id } : null);
        }
        if (actionType === 'submit') {
          await handleSubmitProposal(proj._id);
          showToast(`Proposal "${proj.title.substring(0, 28)}..." submitted for Faculty Review!`);
        } else {
          showToast(`Project "${proj.title.substring(0, 28)}..." saved as Draft.`);
        }
        notifyCrossTabSync();
        await loadAllData(user);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleUpdateProject = async (updatedProj, options = {}) => {
    try {
      const id = updatedProj._id || updatedProj.id;
      if (options?.skipApi) {
        setProjectsList(prev => prev.map(p => (p.id === id || p._id === id) ? { ...p, ...updatedProj } : p));
        if (!options?.silent) {
          showToast(`Project "${updatedProj.title?.substring(0, 25) || ''}" saved.`);
        }
        return;
      }
      const res = await apiUpdateProject(id, updatedProj);
      if (res.success) {
        setProjectsList(prev => prev.map(p => (p.id === id || p._id === id) ? { ...p, ...updatedProj } : p));
        if (!options?.silent) {
          showToast(`Project "${updatedProj.title?.substring(0, 25) || ''}" saved.`);
        }
        notifyCrossTabSync();
      }
    } catch (err) {
      // Optimistic update if API fails
      setProjectsList(prev => prev.map(p => (p.id === updatedProj.id) ? updatedProj : p));
    }
  };

  const handleSubmitProposal = async (projectId) => {
    try {
      const res = await apiSubmitProposal(projectId);
      if (res.success) {
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { ...p, status: 'SUBMITTED', submittedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
            : p
        ));
        showToast('Proposal submitted! Placed in Faculty Review Queue.');
        notifyCrossTabSync();
        await loadAllData(user);
      }
    } catch (err) {
      showToast(`Submission error: ${err.message}`);
    }
  };

  const handleApproveProposal = async (projectId, guideName, guideId) => {
    try {
      const res = await apiApproveProject(projectId, { guideName, guideId });
      if (res.success) {
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { ...p, status: 'APPROVED', guideName: guideName || p.guideName, guideId, approvedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
            : p
        ));
        showToast(`Project approved and placed under your supervision!`);
        notifyCrossTabSync();
        await loadAllData(user);
      }
    } catch (err) { showToast(`Error: ${err.message}`); }
  };

  const handleRequestRevision = async (projectId, revisionNotes) => {
    try {
      const res = await apiRequestRevision(projectId, revisionNotes);
      if (res.success) {
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId) ? { ...p, status: 'REVISION_REQUIRED', revisionNotes } : p
        ));
        showToast(`Revision request sent to student team.`);
        notifyCrossTabSync();
        await loadAllData(user);
      }
    } catch (err) { showToast(`Error: ${err.message}`); }
  };

  const handleRejectProposal = async (projectId, reason) => {
    try {
      const res = await apiRejectProject(projectId, reason);
      if (res.success) {
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId) ? { ...p, status: 'REJECTED', revisionNotes: reason } : p
        ));
        showToast(`Project proposal declined.`);
        notifyCrossTabSync();
        await loadAllData(user);
      }
    } catch (err) { showToast(`Error: ${err.message}`); }
  };

  const handleAssignGuide = async (projectId, guideName, guideId) => {
    try {
      const res = await apiAssignGuide(projectId, { guideName, guideId });
      if (res.success) {
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { ...p, ...(res.data || {}), guideName, guideId }
            : p
        ));
        showToast(`Assigned ${guideName} to project team.`);
        notifyCrossTabSync();
        await loadAllData(user);
        return res;
      }
    } catch (err) { showToast(`Error: ${err.message}`); throw err; }
  };

  const handleCompleteProject = async (projectId, payload = {}) => {
    try {
      const safePayload = typeof payload === 'string'
        ? { finalNotes: payload, signOffNotes: payload, finalGrade: 'A+' }
        : {
            finalNotes: payload?.finalNotes || payload?.signOffNotes || '',
            signOffNotes: payload?.signOffNotes || payload?.finalNotes || '',
            finalGrade: payload?.finalGrade || 'A+',
            finalScore: payload?.finalScore !== undefined && payload?.finalScore !== null && payload?.finalScore !== '' ? Number(payload?.finalScore) : null
          };
      const res = await apiCompleteProject(projectId, safePayload);
      if (res.success) {
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { ...p, ...(res.data || {}), status: 'COMPLETED', progress: 100 }
            : p
        ));
        showToast(`Project officially signed off & certified as COMPLETED with Grade ${safePayload.finalGrade}!`);
        notifyCrossTabSync();
        await loadAllData(user);
        return res;
      }
    } catch (err) {
      showToast(`Error completing project: ${err.message}`);
      throw err;
    }
  };

  const handleReopenProject = async (projectId) => {
    try {
      const res = await apiReopenProject(projectId);
      if (res.success) {
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { ...p, ...(res.data || {}), status: 'APPROVED' }
            : p
        ));
        showToast(`Project restored to active status.`);
        notifyCrossTabSync();
        await loadAllData(user);
        return res;
      }
    } catch (err) {
      showToast(`Error reopening project: ${err.message}`);
      throw err;
    }
  };

  const handleUpdateSystemSettings = async (settingsData) => {
    try {
      const res = await apiUpdateSystemSettings(settingsData);
      if (res.success) {
        setSystemSettings(res.data);
        showToast(res.message || 'Institutional academic settings updated.');
        notifyCrossTabSync();
        await loadAllData(user);
        return res;
      }
    } catch (err) {
      showToast(`Error updating academic settings: ${err.message}`);
      throw err;
    }
  };


  // Task Handlers — real API
  const handleAddTask = async (projectId, taskData) => {
    try {
      const res = await apiCreateTask({ ...taskData, project: projectId });
      if (res.success) {
        const task = { ...res.data, id: res.data._id, milestoneId: res.data.milestone };
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { 
                ...p, 
                tasks: [...(p.tasks || []), task],
                status: (p.status === 'APPROVED' ? 'IN_PROGRESS' : p.status)
              }
            : p
        ));

        // Refresh project milestones from backend to update progress bars dynamically
        try {
          const mRes = await getMilestones(projectId);
          if (mRes.success && Array.isArray(mRes.data)) {
            const updatedMs = mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }));
            setProjectsList(prev => prev.map(p =>
              (p.id === projectId || p._id === projectId)
                ? { ...p, milestones: updatedMs }
                : p
            ));
          }
        } catch (msErr) {
          console.warn('Failed to refresh milestones after task add:', msErr);
        }

        showToast(`Task "${task.title}" added!`);
      }
    } catch (err) { showToast(`Error: ${err.message}`); }
  };

  const handleUpdateTaskStatus = async (projectId, taskId, newStatus) => {
    try {
      await apiUpdateTask(taskId, { status: newStatus });
      setProjectsList(prev => prev.map(p =>
        (p.id === projectId || p._id === projectId)
          ? { 
              ...p, 
              status: (p.status === 'APPROVED' ? 'IN_PROGRESS' : p.status),
              tasks: (p.tasks || []).map(t => t.id === taskId || t._id === taskId ? { ...t, status: newStatus } : t) 
            }
          : p
      ));

      // Refresh project milestones from backend to update progress bars dynamically
      try {
        const mRes = await getMilestones(projectId);
        if (mRes.success && Array.isArray(mRes.data)) {
          const updatedMs = mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }));
          const avgProgress = updatedMs.length > 0 
            ? Math.round(updatedMs.reduce((acc, m) => acc + (m.progress || 0), 0) / updatedMs.length)
            : 0;
          setProjectsList(prev => prev.map(p =>
            (p.id === projectId || p._id === projectId)
              ? { ...p, milestones: updatedMs, progress: avgProgress, status: (p.status === 'APPROVED' ? 'IN_PROGRESS' : p.status) }
              : p
          ));
        }
      } catch (msErr) {
        console.warn('Failed to refresh milestones after task update:', msErr);
      }

      showToast(`Task status updated to ${newStatus}.`);
    } catch (err) { showToast(`Error: ${err.message}`); }
  };

  const handleUpdateTask = async (projectId, taskId, updatedFields) => {
    try {
      const res = await apiUpdateTask(taskId, updatedFields);
      if (res.success) {
        const updatedTask = res.data ? { ...res.data, id: res.data._id, milestoneId: res.data.milestone } : null;
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { 
                ...p, 
                tasks: (p.tasks || []).map(t => (t.id === taskId || t._id === taskId) ? { ...t, ...updatedFields, ...(updatedTask || {}) } : t) 
              }
            : p
        ));

        // Refresh project milestones from backend to update progress bars dynamically
        try {
          const mRes = await getMilestones(projectId);
          if (mRes.success && Array.isArray(mRes.data)) {
            const updatedMs = mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }));
            const avgProgress = updatedMs.length > 0 
              ? Math.round(updatedMs.reduce((acc, m) => acc + (m.progress || 0), 0) / updatedMs.length)
              : 0;
            setProjectsList(prev => prev.map(p =>
              (p.id === projectId || p._id === projectId)
                ? { ...p, milestones: updatedMs, progress: avgProgress }
                : p
            ));
          }
        } catch (msErr) {
          console.warn('Failed to refresh milestones after task edit:', msErr);
        }

        showToast('Task updated successfully.');
      }
    } catch (err) {
      showToast(`Error updating task: ${err.message}`);
    }
  };

  const handleDeleteTask = async (projectId, taskId) => {
    try {
      await apiDeleteTask(taskId);
      setProjectsList(prev => prev.map(p =>
        (p.id === projectId || p._id === projectId)
          ? { ...p, tasks: (p.tasks || []).filter(t => t.id !== taskId && t._id !== taskId) }
          : p
      ));
      // Refresh milestones
      try {
        const mRes = await getMilestones(projectId);
        if (mRes.success && Array.isArray(mRes.data)) {
          const updatedMs = mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }));
          const avgProgress = updatedMs.length > 0 
            ? Math.round(updatedMs.reduce((acc, m) => acc + (m.progress || 0), 0) / updatedMs.length)
            : 0;
          setProjectsList(prev => prev.map(p =>
            (p.id === projectId || p._id === projectId)
              ? { ...p, milestones: updatedMs, progress: avgProgress }
              : p
          ));
        }
      } catch (msErr) {
        console.warn('Failed to refresh milestones after task delete:', msErr);
      }
      showToast('Task removed.');
    } catch (err) {
      showToast(`Error deleting task: ${err.message}`);
    }
  };

  // Milestone Handlers — real API
  const handleAddMilestone = async (projectId, milestoneData) => {
    try {
      const res = await apiCreateMilestone({ ...milestoneData, projectId });
      if (res.success && res.data) {
        // Fetch updated milestones for project
        try {
          const mRes = await getMilestones(projectId);
          if (mRes.success && Array.isArray(mRes.data)) {
            const updatedMs = mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }));
            const avgProgress = updatedMs.length > 0 
              ? Math.round(updatedMs.reduce((acc, m) => acc + (m.progress || 0), 0) / updatedMs.length)
              : 0;
            setProjectsList(prev => prev.map(p =>
              (p.id === projectId || p._id === projectId)
                ? { ...p, milestones: updatedMs, progress: avgProgress }
                : p
            ));
          }
        } catch (fetchErr) {
          console.warn('Failed to refresh milestones list after add:', fetchErr);
        }
        showToast(`Milestone "${res.data.title || 'Stage'}" added successfully!`);
      }
    } catch (err) {
      showToast(`Error adding milestone: ${err.message}`);
    }
  };

  const handleUpdateMilestone = async (projectId, milestoneId, updateData) => {
    try {
      const res = await apiUpdateMilestone(milestoneId, updateData);
      if (res.success) {
        const mRes = await getMilestones(projectId);
        if (mRes.success && Array.isArray(mRes.data)) {
          const updatedMs = mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }));
          const avgProgress = updatedMs.length > 0 
            ? Math.round(updatedMs.reduce((acc, m) => acc + (m.progress || 0), 0) / updatedMs.length)
            : 0;
          setProjectsList(prev => prev.map(p =>
            (p.id === projectId || p._id === projectId)
              ? { ...p, milestones: updatedMs, progress: avgProgress }
              : p
          ));
        }
        showToast('Milestone updated successfully.');
      }
    } catch (err) {
      showToast(`Error updating milestone: ${err.message}`);
    }
  };

  const handleDeleteMilestone = async (projectId, milestoneId) => {
    try {
      const res = await apiDeleteMilestone(milestoneId);
      if (res.success) {
        const [mRes, tRes] = await Promise.all([
          getMilestones(projectId),
          getTasks(projectId)
        ]);
        const updatedMs = (mRes.success && Array.isArray(mRes.data))
          ? mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }))
          : [];
        const avgProgress = updatedMs.length > 0 
          ? Math.round(updatedMs.reduce((acc, m) => acc + (m.progress || 0), 0) / updatedMs.length)
          : 0;
        const updatedTasks = (tRes.success && Array.isArray(tRes.data))
          ? tRes.data.map(t => ({ ...t, id: t._id, milestoneId: t.milestone }))
          : [];

        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { ...p, milestones: updatedMs, tasks: updatedTasks, progress: avgProgress }
            : p
        ));
        showToast('Milestone deleted. Remaining stages automatically renumbered.');
      }
    } catch (err) {
      showToast(`Error deleting milestone: ${err.message}`);
    }
  };

  const handleVerifyMilestone = async (projectId, milestoneId, verifyData = {}) => {
    try {
      const res = await apiVerifyMilestone(milestoneId, verifyData);
      if (res.success) {
        const mRes = await getMilestones(projectId);
        if (mRes.success && Array.isArray(mRes.data)) {
          const updatedMs = mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }));
          const avgProgress = updatedMs.length > 0 
            ? Math.round(updatedMs.reduce((acc, m) => acc + (m.progress || 0), 0) / updatedMs.length)
            : 0;
          setProjectsList(prev => prev.map(p =>
            (p.id === projectId || p._id === projectId)
              ? { ...p, milestones: updatedMs, progress: avgProgress }
              : p
          ));
        }
        showToast('Milestone stage verified and signed off by Faculty Guide!');
      }
    } catch (err) {
      showToast(`Error verifying milestone: ${err.message}`);
    }
  };

  const handleUnverifyMilestone = async (projectId, milestoneId) => {
    try {
      const res = await apiUnverifyMilestone(milestoneId);
      if (res.success) {
        const mRes = await getMilestones(projectId);
        if (mRes.success && Array.isArray(mRes.data)) {
          const updatedMs = mRes.data.map(m => ({ ...m, id: m._id, progress: m.completionPercentage ?? 0 }));
          const avgProgress = updatedMs.length > 0 
            ? Math.round(updatedMs.reduce((acc, m) => acc + (m.progress || 0), 0) / updatedMs.length)
            : 0;
          setProjectsList(prev => prev.map(p =>
            (p.id === projectId || p._id === projectId)
              ? { ...p, milestones: updatedMs, progress: avgProgress }
              : p
          ));
        }
        showToast('Milestone verification revoked and status restored.');
      }
    } catch (err) {
      showToast(`Error undoing milestone verification: ${err.message}`);
    }
  };

  // Weekly Progress Handlers — real API
  const handleSubmitWeeklyProgress = async (projectId, weeklyData) => {
    try {
      const res = await apiSubmitWeekly({ ...weeklyData, project: projectId, student: user?._id || user?.id });
      if (res.success) {
        const entry = { ...res.data, id: res.data._id, progressPct: res.data.progressPercentage ?? weeklyData.progressPct ?? 0 };
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { 
                ...p, 
                weeklyUpdates: [entry, ...(p.weeklyUpdates || [])],
                status: (p.status === 'APPROVED' ? 'IN_PROGRESS' : p.status),
                progress: (!p.milestones || p.milestones.length === 0) 
                  ? Math.max(p.progress || 0, Number(entry.progressPct) || 0) 
                  : p.progress
              }
            : p
        ));
        showToast(`Week #${weeklyData.weekNumber} progress submitted!`);
        loadAllData(user).catch(() => {});
      }
    } catch (err) { showToast(`Error: ${err.message}`); }
  };

  const handleUpdateWeeklyProgress = async (projectId, weekId, updatedFields) => {
    try {
      const res = await apiUpdateWeekly(weekId, updatedFields);
      if (res.success) {
        const updatedData = res.data;
        const entryId = updatedData._id || updatedData.id || weekId;
        const newPct = updatedData.progressPercentage ?? updatedFields.progressPct ?? 0;
        setProjectsList(prev => prev.map(p => {
          if (p.id !== projectId && p._id !== projectId) return p;
          const updatedWeekly = (p.weeklyUpdates || []).map(w =>
            (w.id === entryId || w._id === entryId || w.id === weekId || w._id === weekId)
              ? {
                  ...w,
                  ...updatedData,
                  id: entryId,
                  progressPct: newPct,
                  workCompleted: updatedData.workCompleted ?? updatedFields.workCompleted,
                  problemsFaced: updatedData.problemsFaced ?? updatedFields.problemsFaced,
                  nextWeekPlan: updatedData.nextWeekPlan ?? updatedFields.nextWeekPlan
                }
              : w
          );
          return {
            ...p,
            weeklyUpdates: updatedWeekly,
            progress: (!p.milestones || p.milestones.length === 0)
              ? Math.max(p.progress || 0, Number(newPct) || 0)
              : p.progress
          };
        }));
        showToast(`Week #${updatedData.weekNumber || ''} report updated successfully!`);
        loadAllData(user).catch(() => {});
        return true;
      } else {
        showToast(`Error: ${res.error || 'Failed to update report'}`);
        return false;
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      return false;
    }
  };

  const handleGradeWeeklyProgress = async (projectId, weekId, score, feedback) => {
    try {
      await apiGradeWeekly(weekId, { facultyScore: score, facultyFeedback: feedback });
      setProjectsList(prev => prev.map(p =>
        (p.id === projectId || p._id === projectId)
          ? { ...p, weeklyUpdates: (p.weeklyUpdates || []).map(w =>
              (w.id === weekId || w._id === weekId) ? { ...w, facultyScore: score, score: score, facultyFeedback: feedback, feedback: feedback } : w
            )}
          : p
      ));
      showToast('Weekly feedback saved successfully!');
      loadAllData(user).catch(() => {});
    } catch (err) { showToast(`Error: ${err.message}`); }
  };


  // Document Upload Handler (keeps existing real upload service)
  const handleUploadDocument = (projectId, docData) => {
    setProjectsList(prev => prev.map(p =>
      (p.id === projectId || p._id === projectId)
        ? { ...p, documents: [docData, ...(p.documents || [])] }
        : p
    ));
    showToast(`Document "${docData.fileName}" uploaded to project repository.`);
  };

  // Direct Discussion & Guidance Comments Handler
  const handleAddComment = async (projectId, commentData) => {
    try {
      const res = await apiAddComment(projectId, commentData);
      if (res && res.success && Array.isArray(res.data)) {
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { ...p, comments: res.data }
            : p
        ));
      } else {
        const localComment = {
          id: Date.now(),
          ...commentData,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setProjectsList(prev => prev.map(p =>
          (p.id === projectId || p._id === projectId)
            ? { ...p, comments: [...(p.comments || []), localComment] }
            : p
        ));
      }
      showToast('Message sent to project guidance discussion.');
      loadAllData(user).catch(() => {});
    } catch (err) {
      showToast(`Error sending message: ${err.message}`);
    }
  };


  // Review & Evaluation System Handlers
  const handleScheduleReview = async (reviewPayload) => {
    try {
      const res = await scheduleNewReview(reviewPayload);
      if (res && res.success && res.data) {
        const createdRev = { ...res.data, id: res.data._id || res.data.id };
        setReviewsList((prev) => [createdRev, ...prev]);
        showToast(`Review "${createdRev.title}" scheduled successfully!`);
        await loadAllData(user);
        return res;
      } else {
        throw new Error(res?.error || 'Failed to schedule review');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      throw err;
    }
  };

  const handleUpdateReview = async (reviewId, reviewPayload) => {
    try {
      const res = await apiUpdateReview(reviewId, reviewPayload);
      if (res && res.success && res.data) {
        const updatedRev = { ...res.data, id: res.data._id || res.data.id };
        setReviewsList((prev) =>
          prev.map((r) => ((r.id === reviewId || r._id === reviewId) ? updatedRev : r))
        );
        showToast(`Review "${updatedRev.title}" rescheduled successfully!`);
        await loadAllData(user);
        return res;
      } else {
        throw new Error(res?.error || 'Failed to reschedule review');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteReview = async (reviewId) => {
    try {
      const res = await apiDeleteReview(reviewId);
      if (res && res.success) {
        setReviewsList((prev) => prev.filter((r) => r.id !== reviewId && r._id !== reviewId));
        showToast('Review deleted.');
        await loadAllData(user);
        return res;
      } else {
        throw new Error(res?.error || 'Failed to delete review');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      throw err;
    }
  };

  // Student Account Management Handlers
  const handleCreateStudent = async (studentData) => {
    try {
      const res = await apiCreateStudent(studentData);
      if (res && res.success) {
        showToast(`Student account for ${studentData.name} created!`);
        await loadAllData(user);
        return res;
      } else {
        throw new Error(res?.error || 'Failed to create student account');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      throw err;
    }
  };

  const handleUpdateStudent = async (studentId, studentData) => {
    try {
      const res = await apiUpdateStudent(studentId, studentData);
      if (res && res.success) {
        showToast(`Student details updated successfully.`);
        await loadAllData(user);
        return res;
      } else {
        throw new Error(res?.error || 'Failed to update student');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteStudent = async (studentId) => {
    try {
      const res = await apiDeleteStudent(studentId);
      if (res && res.success) {
        showToast('Student account deleted.');
        await loadAllData(user);
        return res;
      } else {
        throw new Error(res?.error || 'Failed to delete student');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      throw err;
    }
  };

  // Faculty Account Management Handlers
  const handleCreateFaculty = async (facultyData) => {
    try {
      const res = await apiCreateFaculty(facultyData);
      if (res && res.success) {
        showToast(`Faculty account for ${facultyData.name} created!`);
        await loadAllData(user);
        return res;
      } else {
        throw new Error(res?.error || 'Failed to create faculty account');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      throw err;
    }
  };

  const handleUpdateFaculty = async (facultyId, facultyData) => {
    try {
      const res = await apiUpdateFaculty(facultyId, facultyData);
      if (res && res.success) {
        showToast(`Faculty details updated successfully.`);
        await loadAllData(user);
        return res;
      } else {
        throw new Error(res?.error || 'Failed to update faculty');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteFaculty = async (facultyId) => {
    try {
      const res = await apiDeleteFaculty(facultyId);
      if (res && res.success) {
        showToast('Faculty account deleted.');
        await loadAllData(user);
        return res;
      } else {
        throw new Error(res?.error || 'Failed to delete faculty');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
      throw err;
    }
  };

  const handleSubmitReviewDeliverable = async (reviewId, submissionPayload) => {
    const targetProjectId = String(submissionPayload.projectId || activeStudentProject?._id || activeStudentProject?.id || '');
    const newSub = {
      ...submissionPayload,
      id: submissionPayload.id || `sub-${Date.now()}`,
      project: targetProjectId,
      submissionTime: submissionPayload.submissionTime || new Date().toISOString(),
      status: 'SUBMITTED'
    };

    setReviewsList((prev) =>
      prev.map((r) => {
        if (r.id === reviewId || r._id === reviewId) {
          const currentSubs = Array.isArray(r.submissions) ? r.submissions : [];
          const updatedSubs = [
            ...currentSubs.filter(s => String(s.project?._id || s.project || '') !== targetProjectId),
            newSub
          ];
          return {
            ...r,
            submissions: updatedSubs
          };
        }
        return r;
      })
    );
    showToast(`Review deliverable "${newSub.fileName}" submitted successfully!`);

    try {
      const res = await submitReviewDeliverable(reviewId, {
        ...submissionPayload,
        projectId: targetProjectId
      });
      if (res && res.success && res.data) {
        const savedSub = res.data;
        setReviewsList((prev) =>
          prev.map((r) => {
            if (r.id === reviewId || r._id === reviewId) {
              const currentSubs = Array.isArray(r.submissions) ? r.submissions : [];
              const updatedSubs = [
                ...currentSubs.filter(s => String(s.project?._id || s.project || '') !== targetProjectId),
                savedSub
              ];
              return {
                ...r,
                submissions: updatedSubs
              };
            }
            return r;
          })
        );
      }
      await loadAllData(user);
    } catch (err) {
      console.warn('Backend sync failed, submission retained locally:', err);
    }
  };

  const handleSaveOfficialEvaluation = async (reviewId, evaluationPayload) => {
    const targetProjectId = String(evaluationPayload.projectId || '');
    const fullEval = {
      ...evaluationPayload,
      project: targetProjectId,
      evaluationType: 'FACULTY',
      evaluatedTime: evaluationPayload.evaluatedTime || new Date().toISOString()
    };

    setReviewsList((prev) =>
      prev.map((r) => {
        if (r.id === reviewId || r._id === reviewId) {
          const currentEvals = Array.isArray(r.evaluations) ? r.evaluations : [];
          const updatedEvals = [
            ...currentEvals.filter(e => String(e.project?._id || e.project || '') !== targetProjectId || e.evaluationType !== 'FACULTY'),
            fullEval
          ];
          return {
            ...r,
            evaluations: updatedEvals
          };
        }
        return r;
      })
    );
    showToast(`Official Grade ${fullEval.grade} (${fullEval.marks}/${fullEval.maxMarks}) submitted successfully!`);

    try {
      const res = await submitOfficialEvaluation(reviewId, evaluationPayload);
      if (res && res.success && res.data) {
        const savedEval = res.data;
        setReviewsList((prev) =>
          prev.map((r) => {
            if (r.id === reviewId || r._id === reviewId) {
              const currentEvals = Array.isArray(r.evaluations) ? r.evaluations : [];
              const updatedEvals = [
                ...currentEvals.filter(e => String(e.project?._id || e.project || '') !== targetProjectId || e.evaluationType !== 'FACULTY'),
                savedEval
              ];
              return {
                ...r,
                evaluations: updatedEvals
              };
            }
            return r;
          })
        );
      }
      await loadAllData(user);
    } catch (err) {
      console.warn('Backend sync failed, evaluation retained locally:', err);
    }
  };

  // Normalize user role case-insensitively
  const userRole = user ? (
    ['FACULTY', 'GUIDE'].includes(String(user.role || '').toUpperCase().trim())
      ? 'Faculty'
      : String(user.role || '').toUpperCase().trim() === 'ADMIN'
      ? 'Admin'
      : 'Student'
  ) : null;

  // Current institutional academic year
  const currentAcademicYear = systemSettings?.currentAcademicYear || '2026-2027';

  // Helper: check if a project belongs to the given student
  const isStudentInProject = (p, u) => {
    if (!p || !u) return false;
    if (p._id === 'proj_1' || p.id === 'proj_1') return false;

    const uId = String(u._id || u.id || '');
    const uEmail = String(u.email || '').toLowerCase().trim();
    const uReg = String(u.regNo || '').trim();
    const uName = String(u.name || '').trim();
    const userProjId = String(u.project?._id || u.project || u.projectId || '');

    // Match by user.project ID
    if (userProjId && (String(p._id) === userProjId || String(p.id) === userProjId)) return true;

    // Match by myTeam.project ID
    const teamProjId = String(myTeam?.project?._id || myTeam?.project || '');
    if (teamProjId && (String(p._id) === teamProjId || String(p.id) === teamProjId)) return true;

    // Match by lead name or regNo
    if (uName && p.leadName && p.leadName.toLowerCase() === uName.toLowerCase()) return true;
    if (uReg && p.regNo && p.regNo === uReg) return true;

    // Match by team members (strings or objects)
    if (Array.isArray(p.teamMembers)) {
      if (p.teamMembers.some(m => {
        if (!m) return false;
        if (typeof m === 'string') {
          return m === uId || m.toLowerCase() === uName.toLowerCase() || m.toLowerCase() === uEmail || m === uReg;
        }
        const memId = String(m._id || m.id || '');
        const memEmail = String(m.email || '').toLowerCase().trim();
        const memReg = String(m.regNo || '').trim();
        const memName = String(m.name || '').toLowerCase().trim();
        return (uId && memId === uId) || (uEmail && memEmail === uEmail) || (uReg && memReg === uReg) || (uName && memName === uName.toLowerCase());
      })) return true;
    }

    if (Array.isArray(p.rawTeamMembers)) {
      if (p.rawTeamMembers.some(m => {
        if (!m) return false;
        const memId = String(m._id || m.id || '');
        const memEmail = String(m.email || '').toLowerCase().trim();
        const memReg = String(m.regNo || '').trim();
        const memName = String(m.name || '').toLowerCase().trim();
        return (uId && memId === uId) || (uEmail && memEmail === uEmail) || (uReg && memReg === uReg) || (uName && memName === uName.toLowerCase());
      })) return true;
    }

    return false;
  };

  // Find all projects belonging to this student across all academic years
  const studentAllProjects = user && userRole === 'Student'
    ? projectsList.filter(p => isStudentInProject(p, user))
    : [];

  // Project belonging specifically to the active academic year
  const studentCurrentYearProject = studentAllProjects.find(
    p => (p.academicYear || '2026-2027') === currentAcademicYear
  ) || null;

  // Previous completed/archived projects from earlier academic years
  const studentPastProjects = studentAllProjects.filter(
    p => (p.academicYear || '2026-2027') !== currentAcademicYear
  );

  // Helper to determine if a student is passed out / graduated
  const isPassedOutStudent = user && userRole === 'Student' && (
    user.isPassedOut === true ||
    user.academicStatus === 'PASSED_OUT' ||
    (user.yearOfStudy && user.yearOfStudy > 4) ||
    (user.batch && (() => {
      const curStart = parseInt(currentAcademicYear.split('-')[0], 10);
      const batchParts = user.batch.split('-');
      const batchEnd = parseInt(batchParts[1], 10);
      return !isNaN(curStart) && !isNaN(batchEnd) && curStart >= batchEnd;
    })())
  );

  // Active project to display in student workspace (either archive view or current cycle)
  let activeStudentProject = null;
  let isViewingArchive = false;
  if (selectedArchiveProjectId) {
    const matchedArchive = studentAllProjects.find(
      p => String(p._id || p.id) === String(selectedArchiveProjectId)
    );
    if (matchedArchive) {
      activeStudentProject = matchedArchive;
      isViewingArchive = true;
    }
  }
  if (!activeStudentProject) {
    activeStudentProject = isPassedOutStudent ? null : studentCurrentYearProject;
    isViewingArchive = isPassedOutStudent;
  }

  if (sessionRestoring) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <ProjIntelSpinner size="xl" label="Restoring session..." />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app-main-layout">
        {/* Floating Translucent Pill Navbar */}
        <Navbar
          isSyncing={dataLoading}
          activeView={activeView}
          setActiveView={(view) => {
            if (!user && view === 'dashboard') {
              handleOpenLogin();
              return;
            }
            setActiveView(view);
          }}
          theme={theme}
          toggleTheme={toggleTheme}
          user={user}
          onOpenLogin={handleOpenLogin}
          onLogout={handleLogout}
          onUserUpdate={(updatedUser) => {
            const normalized = {
              ...user,
              ...updatedUser,
              role: ['FACULTY', 'Faculty', 'GUIDE', 'Guide'].includes(String(updatedUser.role || user?.role || '').trim())
                ? 'Faculty'
                : ['ADMIN', 'Admin'].includes(String(updatedUser.role || user?.role || '').trim())
                ? 'Admin'
                : 'Student'
            };
            setUser(normalized);
            loadAllData(normalized);
            showToast(`Profile updated: Institutional email verified as ${normalized.email}`);
          }}
        />

        {/* Main Content View */}
        <main>
          {/* Unauthenticated: show Landing or Guidelines */}
          {!user && activeView !== 'guidelines' && (
            <LandingPage 
              onOpenLogin={handleOpenLogin} 
            />
          )}

          {!user && activeView === 'guidelines' && (
            <GuidelinesPage />
          )}

          {/* Authenticated User */}
          {user && (
            <>
              {activeView === 'guidelines' && (
                <GuidelinesPage />
              )}

              {activeView !== 'guidelines' && (
                <>
                  {dataLoading && projectsList.length === 0 && userRole !== "Student" ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
                      <ProjIntelSpinner size="xl" label="Loading project workspace from MongoDB Atlas..." />
                    </div>
                  ) : (
                    <>
                      {userRole === 'Student' && (
                        activeStudentProject ? (
                          <StudentDashboard
                            project={activeStudentProject}
                            user={user}
                            reviews={reviewsList}
                            isViewingArchive={isViewingArchive}
                            pastProjects={studentPastProjects}
                            currentYearProject={studentCurrentYearProject}
                            currentAcademicYear={currentAcademicYear}
                            onSelectArchiveProject={(projId) => setSelectedArchiveProjectId(projId)}
                            onReturnToCurrentCycle={() => setSelectedArchiveProjectId(null)}
                            onUpdateProject={handleUpdateProject}
                            onSubmitProposal={handleSubmitProposal}
                            onOpenNewProject={() => setIsNewProjectOpen(true)}
                            onAddTask={handleAddTask}
                            onUpdateTask={handleUpdateTask}
                            onUpdateTaskStatus={handleUpdateTaskStatus}
                            onDeleteTask={handleDeleteTask}
                            onAddMilestone={handleAddMilestone}
                            onUpdateMilestone={handleUpdateMilestone}
                            onDeleteMilestone={handleDeleteMilestone}
                            onSubmitWeeklyProgress={handleSubmitWeeklyProgress}
                            onUpdateWeeklyProgress={handleUpdateWeeklyProgress}
                            onUploadDocument={handleUploadDocument}
                            onSubmitReviewDeliverable={handleSubmitReviewDeliverable}
                            onAddComment={handleAddComment}
                            onRefreshAllData={() => loadAllData(user)}
                          />
                        ) : (
                          <div>
                            {isPassedOutStudent ? (
                              <div style={{ maxWidth: '1240px', margin: '2rem auto', padding: '0 1.25rem' }}>
                                <div style={{
                                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
                                  border: '1px solid rgba(16, 185, 129, 0.35)',
                                  borderRadius: '16px',
                                  padding: '2.5rem 2rem',
                                  textAlign: 'center',
                                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
                                }}>
                                  <div style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: '50%',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    color: '#10B981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 1.25rem auto'
                                  }}>
                                    <GraduationCap size={36} />
                                  </div>

                                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
                                    🎓 Degree Completed • Batch {user.batch || '2023-2027'} Alumni
                                  </h2>
                                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', maxWidth: '650px', margin: '0 auto 1.5rem auto', lineHeight: 1.6 }}>
                                    You have officially graduated and completed your academic degree program. 
                                    As an alumnus, new project proposals and team formation cycles are closed. All your past project dossiers, final scores, and completion certificates are permanently preserved in read-only archive mode.
                                  </p>

                                  {studentPastProjects.length > 0 ? (
                                    <div>
                                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                                        Archived Project Dossiers ({studentPastProjects.length})
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        {studentPastProjects.map(pastP => (
                                          <button
                                            key={pastP._id || pastP.id}
                                            type="button"
                                            onClick={() => setSelectedArchiveProjectId(pastP._id || pastP.id)}
                                            className="btn-aesthetic btn-glass-secondary"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.2rem', fontSize: '0.85rem', borderRadius: '10px' }}
                                          >
                                            <FileText size={16} color="#10B981" />
                                            <span>AY {pastP.academicYear}: <strong>{pastP.title}</strong></span>
                                            <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem' }}>
                                              {pastP.finalGrade || 'A+'}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                      No completed project archives found on record.
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* If student has completed projects from past academic years, show Archive Quick Access Banner */}
                                {studentPastProjects.length > 0 && (
                                  <div style={{ maxWidth: '1240px', margin: '1rem auto 0 auto', padding: '0 1.25rem' }}>
                                    <div style={{
                                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
                                      border: '1px solid rgba(16, 185, 129, 0.28)',
                                      borderRadius: '12px',
                                      padding: '1rem 1.35rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      flexWrap: 'wrap',
                                      gap: '1rem'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                                          <Award size={22} />
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                            Academic Year {currentAcademicYear} • New Project Cycle Active
                                          </div>
                                          <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                                            Form your team and propose your project for this year. You have {studentPastProjects.length} completed project{studentPastProjects.length > 1 ? 's' : ''} from earlier academic years available in view-only archive.
                                          </div>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                          Past Projects:
                                        </span>
                                        {studentPastProjects.map(pastP => (
                                          <button
                                            key={pastP._id || pastP.id}
                                            type="button"
                                            onClick={() => setSelectedArchiveProjectId(pastP._id || pastP.id)}
                                            className="btn-aesthetic btn-glass-secondary btn-sm"
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.785rem', padding: '0.45rem 0.75rem' }}
                                            title={`View archived project "${pastP.title}" for AY ${pastP.academicYear}`}
                                          >
                                            <FileText size={14} color="#10B981" />
                                            <span>AY {pastP.academicYear}: <strong>{pastP.title}</strong></span>
                                            <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '0.72rem' }}>
                                              {pastP.finalGrade || 'A+'}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <TeamFormationWorkspace
                                  user={user}
                                  currentAcademicYear={currentAcademicYear}
                                  onOpenNewProject={() => setIsNewProjectOpen(true)}
                                  onTeamFormed={(team) => {
                                    setMyTeam(team);
                                  }}
                                  onRefreshUser={() => loadAllData(user)}
                                />
                              </>
                            )}
                          </div>
                        )
                      )}

                      {userRole === 'Faculty' && (
                        <GuideDashboard
                          projectsList={projectsList}
                          reviews={reviewsList}
                          currentUser={user}
                          currentGuideName={user.name || 'Dr. S. Kavitha'}
                          currentGuideId={user._id || user.id || user.facultyId || user.staffId || 'FACCSE05'}
                          systemSettings={systemSettings}
                          onApproveProposal={handleApproveProposal}
                          onRequestRevision={handleRequestRevision}
                          onRejectProposal={handleRejectProposal}
                          onGradeWeeklyProgress={handleGradeWeeklyProgress}
                          onUpdateProject={handleUpdateProject}
                          onCompleteProject={handleCompleteProject}
                          onReopenProject={handleReopenProject}
                          onVerifyMilestone={handleVerifyMilestone}
                          onUnverifyMilestone={handleUnverifyMilestone}
                          onUpdateMilestone={handleUpdateMilestone}
                          onScheduleReview={handleScheduleReview}
                          onSaveOfficialEvaluation={handleSaveOfficialEvaluation}
                          onAddComment={handleAddComment}
                          onRefreshAllData={() => loadAllData(user)}
                        />
                      )}

                      {userRole === 'Admin' && (
                        <AdminDashboard 
                          projectsList={projectsList}
                          reviewsList={reviewsList}
                          departmentsList={departmentsList}
                          systemSettings={systemSettings}
                          onUpdateSystemSettings={handleUpdateSystemSettings}
                          onAssignGuide={handleAssignGuide}
                          onScheduleReview={handleScheduleReview}
                          onUpdateReview={handleUpdateReview}
                          onDeleteReview={handleDeleteReview}
                          onCreateStudent={handleCreateStudent}
                          onUpdateStudent={handleUpdateStudent}
                          onDeleteStudent={handleDeleteStudent}
                          onCreateFaculty={handleCreateFaculty}
                          onUpdateFaculty={handleUpdateFaculty}
                          onDeleteFaculty={handleDeleteFaculty}
                          onRefreshAllData={() => loadAllData(user)}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>

        {/* Institutional Sign In Modal */}
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => {
            setIsLoginOpen(false);
            setLoginModalInitialRole(null);
            setInitialResetParams(null);
          }}
          onLoginSuccess={handleLoginSuccess}
          initialRole={loginModalInitialRole}
          initialResetParams={initialResetParams}
        />

        {/* Create New Project Proposal Modal */}
        <NewProjectModal
          isOpen={isNewProjectOpen}
          onClose={() => setIsNewProjectOpen(false)}
          onCreateProject={handleCreateProject}
          user={user}
          team={myTeam}
        />

        {/* Global Live Sync Indicator */}
        {dataLoading && (
          <div 
            className="projintel-live-sync-indicator"
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 9999,
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              backdropFilter: 'blur(12px)',
              borderRadius: '9999px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(99, 102, 241, 0.3)',
              pointerEvents: 'none',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <ProjIntelSpinner size="xs" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main, #f8fafc)', letterSpacing: '0.02em' }}>
              Syncing with MongoDB Atlas...
            </span>
          </div>
        )}

        {/* Toast Alert */}
        {toastMessage && (
          <div className="toast-notification">
            <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{toastMessage}</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
