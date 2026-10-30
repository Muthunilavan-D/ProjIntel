import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  FileText, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Sparkles, 
  Edit3, 
  Eye, 
  FileCheck, 
  Download,
  Filter,
  Layers,
  ExternalLink,
  RefreshCw,
  Presentation,
  Check,
  Shield,
  Users
} from 'lucide-react';
import ReviewEvaluationModal from './ReviewEvaluationModal';
import ProjIntelSpinner from './ProjIntelSpinner';
import { evaluateReviewWithAI } from '../services/aiService';

const GuideReviewSection = ({
  reviews = [],
  assignedProjects = [],
  currentGuideId = 'FACCSE05',
  currentGuideName = 'Dr. S. Kavitha',
  onSaveOfficialEvaluation,
  onRefreshReviews
}) => {
  const [filterState, setFilterState] = useState('ALL'); // 'ALL' | 'PENDING_EVAL' | 'COMPLETED'
  const [isSyncingReviews, setIsSyncingReviews] = useState(false);
  const [aiLoadingKey, setAiLoadingKey] = useState(null);

  const handleSyncClick = async () => {
    if (!onRefreshReviews || isSyncingReviews) return;
    setIsSyncingReviews(true);
    try {
      await onRefreshReviews();
    } finally {
      setIsSyncingReviews(false);
    }
  };

  // Modal state for evaluation (Grading, AI Assistant, View)
  const [evaluationModalConfig, setEvaluationModalConfig] = useState({
    isOpen: false,
    mode: 'grade', // 'grade' | 'ai_suggestion' | 'view'
    review: null,
    project: null,
    submission: null,
    evaluation: null,
    aiSuggestion: null
  });

  // Helper to compute submission window status:
  // Open strictly from 00:00:00 of the day before the review until 23:59:59 of review day.
  const getWindowStatus = (rev) => {
    if (rev.windowInfo) return rev.windowInfo;
    const now = new Date();
    const revDate = new Date(rev.scheduledDate || Date.now());
    const windowStart = new Date(revDate.getFullYear(), revDate.getMonth(), revDate.getDate() - 1, 0, 0, 0, 0);
    const windowEnd = new Date(revDate.getFullYear(), revDate.getMonth(), revDate.getDate(), 23, 59, 59, 999);
    if (rev.deadline) {
      const deadDate = new Date(rev.deadline);
      if (deadDate > windowEnd) windowEnd.setTime(deadDate.getTime());
    }
    const isOpen = now >= windowStart && now <= windowEnd;
    const isBefore = now < windowStart;
    const isAfter = now > windowEnd;
    return {
      isOpen,
      isBefore,
      isAfter,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      status: isBefore ? 'BEFORE_WINDOW' : isAfter ? 'WINDOW_CLOSED' : 'WINDOW_ACTIVE'
    };
  };

  // Helper to match supervised projects for a cohort review
  const getProjectsForReview = (rev) => {
    // 1. Direct project attached to review
    if (rev.project) {
      const pId = String(rev.project._id || rev.project.id || rev.project);
      const direct = assignedProjects.filter(p => String(p._id || p.id) === pId);
      if (direct.length > 0) return direct;
    }

    // 2. Department & Year of Study cohort match
    const revDeptId = String(rev.department?._id || rev.department || '').trim();
    const revDeptName = (rev.department?.name || rev.department?.code || '').toLowerCase().trim();
    const revYear = Number(rev.yearOfStudy || 4);

    return assignedProjects.filter(p => {
      const pDeptId = String(p.department?._id || p.department || '').trim();
      const pDeptName = (p.department?.name || p.department?.code || p.dept || '').toLowerCase().trim();
      const matchesDept = !revDeptId || revDeptId === pDeptId || (revDeptName && pDeptName && pDeptName.includes(revDeptName));
      const pYear = Number(p.yearOfStudy || p.year || 4);
      const matchesYear = !rev.yearOfStudy || revYear === pYear;
      const revBatch = rev.batch || '';
      const pBatch = p.batch || '';
      const matchesBatch = !revBatch || !pBatch || revBatch === pBatch;
      return matchesDept && matchesYear && matchesBatch;
    });
  };

  // Helper to find submission for a specific project under a review
  const getProjectSubmission = (rev, proj) => {
    const pId = String(proj._id || proj.id);
    if (rev.submissions && Array.isArray(rev.submissions)) {
      const found = rev.submissions.find(s => 
        String(s.project?._id || s.project?.id || s.project) === pId
      );
      if (found) return found;
    }
    if (rev.submission && String(rev.submission.project?._id || rev.submission.project) === pId) {
      return rev.submission;
    }
    return null;
  };

  // Helper to find evaluation for a specific project under a review
  const getProjectEvaluation = (rev, proj) => {
    const pId = String(proj._id || proj.id);
    if (rev.evaluations && Array.isArray(rev.evaluations)) {
      const found = rev.evaluations.find(e => 
        String(e.project?._id || e.project?.id || e.project) === pId && e.evaluationType === 'FACULTY'
      );
      if (found) return found;
    }
    if (rev.officialEvaluation && (!rev.officialEvaluation.project || String(rev.officialEvaluation.project?._id || rev.officialEvaluation.project) === pId)) {
      return rev.officialEvaluation;
    }
    return null;
  };

  const getProjectAiEvaluation = (rev, proj) => {
    const pId = String(proj._id || proj.id);
    if (rev.evaluations && Array.isArray(rev.evaluations)) {
      const found = rev.evaluations.find(e => 
        String(e.project?._id || e.project?.id || e.project) === pId && e.evaluationType === 'AI_SUGGESTED'
      );
      if (found) return found;
    }
    return rev.aiSuggestedEvaluation || null;
  };

  // Filter reviews based on team evaluation status
  const filteredReviews = reviews.filter(rev => {
    const teams = getProjectsForReview(rev);
    const anyEvaluated = teams.some(t => Boolean(getProjectEvaluation(rev, t)));
    const anyPending = teams.some(t => !getProjectEvaluation(rev, t));

    if (filterState === 'PENDING_EVAL') {
      return anyPending;
    }
    if (filterState === 'COMPLETED') {
      return anyEvaluated;
    }
    return true;
  });

  const totalNeedsEvalCount = reviews.reduce((acc, rev) => {
    const teams = getProjectsForReview(rev);
    const pending = teams.filter(t => !getProjectEvaluation(rev, t)).length;
    return acc + pending;
  }, 0);

  const totalCompletedGradedCount = reviews.reduce((acc, rev) => {
    const teams = getProjectsForReview(rev);
    const completed = teams.filter(t => Boolean(getProjectEvaluation(rev, t))).length;
    return acc + completed;
  }, 0);

  // Handlers
  const handleRunAiEvaluation = async (rev, proj, submission) => {
    if (!submission) {
      alert('Cannot run AI evaluation: No deliverable has been submitted by this student team yet.');
      return;
    }

    const key = `${rev._id || rev.id}_${proj._id || proj.id}`;
    setAiLoadingKey(key);

    try {
      const res = await evaluateReviewWithAI(rev, submission, proj);
      if (res && res.success) {
        const aiData = res.data || res;
        setEvaluationModalConfig({
          isOpen: true,
          mode: 'ai_suggestion',
          review: rev,
          project: proj,
          submission: submission,
          evaluation: getProjectEvaluation(rev, proj),
          aiSuggestion: aiData
        });
      } else {
        alert(res?.error || 'AI Evaluation service unavailable. Please check server connection.');
      }
    } catch (err) {
      console.error('Error running AI review evaluation:', err);
      alert('Failed to generate AI evaluation.');
    } finally {
      setAiLoadingKey(null);
    }
  };

  const handleOpenGradeModal = (rev, proj, submission, initialAiData = null) => {
    setEvaluationModalConfig({
      isOpen: true,
      mode: 'grade',
      review: rev,
      project: proj,
      submission: submission,
      evaluation: getProjectEvaluation(rev, proj),
      aiSuggestion: initialAiData || getProjectAiEvaluation(rev, proj)
    });
  };

  const handleOpenViewModal = (rev, proj, submission) => {
    setEvaluationModalConfig({
      isOpen: true,
      mode: 'view',
      review: rev,
      project: proj,
      submission: submission,
      evaluation: getProjectEvaluation(rev, proj),
      aiSuggestion: getProjectAiEvaluation(rev, proj)
    });
  };

  const handleApplyAiToGrading = (aiData) => {
    setEvaluationModalConfig(prev => ({
      ...prev,
      mode: 'grade',
      aiSuggestion: aiData
    }));
  };

  return (
    <div className="guide-review-section">
      {/* Top Header & Institutional Authority Notice */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="hero-pill-badge" style={{ margin: 0, padding: '0.2rem 0.65rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
              <Shield size={13} /> Institutional Reviews & Evaluation
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Scheduled exclusively by Academic Admin
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
            Project Milestone Reviews & Evaluations
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted, #94a3b8)' }}>
            Inspect student progress reports and deliverables, run AI evaluations, and assign or modify official marks for your assigned teams.
          </p>
        </div>

        <button
          onClick={handleSyncClick}
          disabled={isSyncingReviews}
          className="btn-aesthetic btn-glass-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px' }}
        >
          {isSyncingReviews ? <ProjIntelSpinner size="xs" inline /> : <RefreshCw size={14} />}
          <span>{isSyncingReviews ? 'Syncing...' : 'Sync Reviews'}</span>
        </button>
      </div>

      {/* Filter Tabs & Needs Evaluation Counter */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '10px',
          padding: '4px',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))'
        }}>
          <button
            onClick={() => setFilterState('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              border: 'none',
              background: filterState === 'ALL' ? 'var(--card-bg, #1e293b)' : 'transparent',
              color: filterState === 'ALL' ? 'var(--text-primary, #f8fafc)' : 'var(--text-muted, #94a3b8)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            All Reviews ({reviews.length})
          </button>
          <button
            onClick={() => setFilterState('PENDING_EVAL')}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              border: 'none',
              background: filterState === 'PENDING_EVAL' ? 'var(--card-bg, #1e293b)' : 'transparent',
              color: filterState === 'PENDING_EVAL' ? '#60a5fa' : 'var(--text-muted, #94a3b8)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Needs Grading ({totalNeedsEvalCount})
          </button>
          <button
            onClick={() => setFilterState('COMPLETED')}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              border: 'none',
              background: filterState === 'COMPLETED' ? 'var(--card-bg, #1e293b)' : 'transparent',
              color: filterState === 'COMPLETED' ? '#34d399' : 'var(--text-muted, #94a3b8)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Completed & Graded ({totalCompletedGradedCount})
          </button>
        </div>
      </div>

      {/* Reviews Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredReviews.length === 0 ? (
          <div style={{
            padding: '48px 24px',
            borderRadius: '16px',
            background: 'var(--card-bg, #131b2e)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            textAlign: 'center'
          }}>
            <Calendar size={48} style={{ color: 'var(--text-muted, #94a3b8)', opacity: 0.5, margin: '0 auto 16px' }} />
            <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>No Reviews Match This Filter</h4>
            <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '14px' }}>
              Academic reviews scheduled by the Central Admin for your department and batch will appear here automatically.
            </p>
          </div>
        ) : (
          filteredReviews.map((rev) => {
            const windowInfo = getWindowStatus(rev);
            const allTeams = getProjectsForReview(rev);
            const supervisedTeams = allTeams.filter(proj => {
              const isGraded = Boolean(getProjectEvaluation(rev, proj));
              if (filterState === 'COMPLETED') return isGraded;
              if (filterState === 'PENDING_EVAL') return !isGraded;
              return true;
            });

            return (
              <div 
                key={rev._id || rev.id}
                style={{
                  borderRadius: '16px',
                  background: 'var(--card-bg, #131b2e)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                  padding: '24px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Header Info */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        textTransform: 'uppercase'
                      }}>
                        {rev.reviewType || 'Milestone Review'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Target: <strong>{rev.department?.name || rev.department?.code || 'Department'} • Year {rev.yearOfStudy || 4}</strong>
                      </span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                      {rev.title}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-secondary, #cbd5e1)'
                    }}>
                      Max: {rev.maxMarks || 50} Marks
                    </span>

                    {/* Window Badge */}
                    {windowInfo.isOpen ? (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#34d399',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <CheckCircle2 size={12} /> Student Submission Window Active
                      </span>
                    ) : windowInfo.isBefore ? (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        color: '#818cf8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Clock size={12} /> Opens Day Before Review
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <AlertCircle size={12} /> Submission Window Closed
                      </span>
                    )}
                  </div>
                </div>

                {/* Review Metadata Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                  marginBottom: '18px',
                  fontSize: '12px'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted, #94a3b8)', display: 'block' }}>SCHEDULED REVIEW:</span>
                    <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>
                      {new Date(rev.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted, #94a3b8)', display: 'block' }}>REVIEW MODE:</span>
                    <strong style={{ color: '#10B981' }}>
                      🌐 {rev.venue || 'Online / Remote'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted, #94a3b8)', display: 'block' }}>SUBMISSION WINDOW:</span>
                    <strong style={{ color: '#818cf8' }}>
                      {new Date(windowInfo.windowStart).toLocaleDateString()} to {new Date(windowInfo.windowEnd).toLocaleDateString()}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted, #94a3b8)', display: 'block' }}>REQUIRED FORMAT:</span>
                    <strong style={{ color: '#a855f7' }}>
                      {rev.requiredDocType || 'PDF / PPTX'}
                    </strong>
                  </div>
                </div>

                {/* Section Title for Supervised Teams */}
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} style={{ color: 'var(--primary)' }} />
                    Assigned Supervised Project Teams ({supervisedTeams.length})
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Faculty can evaluate each team and modify marks at any time
                  </span>
                </div>

                {/* Teams List */}
                {supervisedTeams.length === 0 ? (
                  <div style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                    No project teams currently under your supervision match this review's department and batch.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {supervisedTeams.map((proj) => {
                      const submission = getProjectSubmission(rev, proj);
                      const evaluation = getProjectEvaluation(rev, proj);
                      const isAiLoading = aiLoadingKey === `${rev._id || rev.id}_${proj._id || proj.id}`;

                      return (
                        <div
                          key={proj._id || proj.id}
                          style={{
                            padding: '16px 18px',
                            borderRadius: '12px',
                            background: evaluation ? 'rgba(16, 185, 129, 0.04)' : submission ? 'rgba(99, 102, 241, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                            border: evaluation ? '1px solid rgba(16, 185, 129, 0.25)' : submission ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '14px'
                          }}
                        >
                          {/* Left: Project & Submission Info */}
                          <div style={{ flex: 1, minWidth: '280px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                {proj.title}
                              </strong>
                              {evaluation && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(16, 185, 129, 0.2)',
                                  color: '#34d399'
                                }}>
                                  Graded: {evaluation.marks} / {rev.maxMarks || 50} ({evaluation.grade})
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                              Lead: <strong style={{ color: 'var(--text-main)' }}>{proj.leadName || 'Student'}</strong> {proj.leadRegNo && `(${proj.leadRegNo})`}
                              {(() => {
                                const allM = Array.isArray(proj.rawTeamMembers) && proj.rawTeamMembers.length > 0
                                  ? proj.rawTeamMembers
                                  : (Array.isArray(proj.teamMembers) ? proj.teamMembers : []);
                                const lName = proj.leadName || '';
                                const lReg = proj.leadRegNo || '';
                                const peers = allM.filter((m, idx) => {
                                  const mName = typeof m === 'object' ? (m.name || m.student?.name) : String(m);
                                  const mReg = typeof m === 'object' ? (m.regNo || m.student?.regNo) : '';
                                  if (lReg && mReg && mReg === lReg) return false;
                                  if (lName && mName && mName.toLowerCase().trim() === lName.toLowerCase().trim()) return false;
                                  return idx > 0;
                                });
                                if (peers.length === 0) return <span> • Solo</span>;
                                return <span> • +{peers.length} {peers.length === 1 ? 'Member' : 'Members'}</span>;
                              })()}
                            </div>

                            {/* Progress Report Preview if submitted */}
                            {submission ? (
                              <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', marginTop: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: submission.progressSummary ? '6px' : '0' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#60a5fa', fontWeight: 600 }}>
                                    <FileText size={13} /> {submission.fileName}
                                  </span>
                                  {submission.presentationUrl && (
                                    <a 
                                      href={submission.presentationUrl} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#a855f7', textDecoration: 'none', fontWeight: 600 }}
                                    >
                                      <Presentation size={13} /> Slide Deck <ExternalLink size={11} />
                                    </a>
                                  )}
                                  {submission.demoUrl && (
                                    <a 
                                      href={submission.demoUrl} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', textDecoration: 'none', fontWeight: 600 }}
                                    >
                                      <ExternalLink size={13} /> Demo / Code Repo
                                    </a>
                                  )}
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    Submitted {new Date(submission.submissionTime).toLocaleDateString()}
                                  </span>
                                </div>

                                {submission.progressSummary && (
                                  <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary, #cbd5e1)', fontStyle: 'italic', borderTop: '1px dashed rgba(255, 255, 255, 0.08)', paddingTop: '4px' }}>
                                    <strong>Progress from last review:</strong> "{submission.progressSummary}"
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.775rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                <Clock size={12} /> Awaiting student progress report & deliverable submission
                              </div>
                            )}
                          </div>

                          {/* Right: Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {/* AI Evaluation Button */}
                            {submission && (
                              <button
                                onClick={() => handleRunAiEvaluation(rev, proj, submission)}
                                disabled={isAiLoading}
                                className="btn-aesthetic btn-glass-secondary btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.775rem',
                                  padding: '6px 12px',
                                  color: '#a855f7',
                                  borderColor: 'rgba(168, 85, 247, 0.3)'
                                }}
                                title="Run Groq AI evaluation on student deliverable and progress"
                              >
                                {isAiLoading ? (
                                  <ProjIntelSpinner size="xs" inline label="AI Scoring..." />
                                ) : (
                                  <>
                                    <Sparkles size={13} />
                                    <span>AI Assist</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* View / Grade / Modify Marks */}
                            {evaluation ? (
                              <>
                                <button
                                  onClick={() => handleOpenViewModal(rev, proj, submission)}
                                  className="btn-aesthetic btn-glass-secondary btn-sm"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.775rem', padding: '6px 12px' }}
                                >
                                  <Eye size={13} /> View Feedback
                                </button>
                                <button
                                  onClick={() => handleOpenGradeModal(rev, proj, submission)}
                                  className="btn-aesthetic btn-primary-glow btn-sm"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.775rem',
                                    padding: '6px 12px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                  }}
                                  title="Modify or revise marks for this team"
                                >
                                  <Edit3 size={13} /> Modify Marks
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleOpenGradeModal(rev, proj, submission)}
                                className="btn-aesthetic btn-primary-glow btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.775rem', padding: '6px 14px' }}
                              >
                                <Award size={14} /> Grade Team & Award Marks
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Official Evaluation & AI Modal */}
      {evaluationModalConfig.isOpen && (
        <ReviewEvaluationModal
          isOpen={evaluationModalConfig.isOpen}
          onClose={() => setEvaluationModalConfig({ ...evaluationModalConfig, isOpen: false })}
          mode={evaluationModalConfig.mode}
          review={evaluationModalConfig.review}
          project={evaluationModalConfig.project}
          submission={evaluationModalConfig.submission}
          evaluation={evaluationModalConfig.evaluation}
          aiSuggestion={evaluationModalConfig.aiSuggestion}
          onSaveOfficialEvaluation={async (reviewId, payload) => {
            if (onSaveOfficialEvaluation) {
              await onSaveOfficialEvaluation(reviewId, {
                ...payload,
                projectId: evaluationModalConfig.project?._id || evaluationModalConfig.project?.id || payload.projectId
              });
            }
            if (onRefreshReviews) await onRefreshReviews();
          }}
          onApplyAiToGrading={handleApplyAiToGrading}
        />
      )}
    </div>
  );
};

export default GuideReviewSection;
