import React, { useState, useMemo } from 'react';
import ProjIntelSpinner from './ProjIntelSpinner';
import { getFileUrl } from '../services/api';
import { 
  Calendar, 
  Clock, 
  Upload, 
  FileText, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Lock,
  Presentation, 
  ExternalLink,
  ChevronRight,
  Eye,
  FileCheck,
  RefreshCw,
  Globe,
  ListChecks,
  ShieldCheck,
  Edit3
} from 'lucide-react';
import SubmitReviewModal from './SubmitReviewModal';
import ReviewEvaluationModal from './ReviewEvaluationModal';

const computeWindowStatus = (scheduledDate, deadline) => {
  if (!scheduledDate) {
    return { isOpen: true, isBefore: false, isAfter: false };
  }
  const revDate = new Date(scheduledDate);
  // Day before review at 00:00:00.000
  const windowStart = new Date(revDate.getFullYear(), revDate.getMonth(), revDate.getDate() - 1, 0, 0, 0, 0);
  // Review day at 23:59:59.999 (or deadline if deadline is after)
  let windowEnd = new Date(revDate.getFullYear(), revDate.getMonth(), revDate.getDate(), 23, 59, 59, 999);
  if (deadline) {
    const dl = new Date(deadline);
    if (dl > windowEnd) windowEnd = dl;
  }

  const now = new Date();
  const isOpen = now >= windowStart && now <= windowEnd;
  const isBefore = now < windowStart;
  const isAfter = now > windowEnd;

  return {
    isOpen,
    isBefore,
    isAfter,
    windowStart,
    windowEnd
  };
};

const StudentReviewSection = ({ 
  reviews = [], 
  project, 
  studentUser, 
  isCompleted = false,
  isViewOnly = false,
  onSubmitReviewDeliverable,
  onRefreshReviews
}) => {
  const isApproved = ['APPROVED', 'Approved', 'IN_PROGRESS', 'COMPLETED'].includes(project?.status);
  const isLocked = isCompleted || isViewOnly;

  const [selectedReviewForSubmit, setSelectedReviewForSubmit] = useState(null);
  const [selectedReviewForView, setSelectedReviewForView] = useState(null);
  const [selectedSubmissionForView, setSelectedSubmissionForView] = useState(null);
  const [selectedEvaluationForView, setSelectedEvaluationForView] = useState(null);
  const [isSyncingReviews, setIsSyncingReviews] = useState(false);

  if (!isApproved) {
    return (
      <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.28)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <Lock size={30} />
        </div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
          Reviews Locked
        </h3>
        <p style={{ maxWidth: '520px', margin: '0 auto', fontSize: '0.875rem', lineHeight: '1.6' }}>
          Milestone reviews and deliverable submissions are accessible only after your project proposal is approved by your assigned faculty guide.
        </p>
      </div>
    );
  }

  const handleSyncClick = async () => {
    if (!onRefreshReviews || isSyncingReviews) return;
    setIsSyncingReviews(true);
    try {
      await onRefreshReviews();
    } finally {
      setIsSyncingReviews(false);
    }
  };

  const pId = String(project?._id || project?.id || '').trim();
  const uId = String(studentUser?._id || studentUser?.id || '').trim();
  const uReg = String(studentUser?.regNo || '').trim().toLowerCase();

  // Helper to strictly isolate and extract only this team's submission
  const getProjectSubmission = (r) => {
    if (!r) return null;
    if (Array.isArray(r.submissions)) {
      const found = r.submissions.find(s => {
        if (!s) return false;
        const subPId = String(s.project?._id || s.project?.id || s.project || '').trim();
        if (pId && subPId && subPId === pId) return true;
        
        const subUId = String(s.submittedBy?._id || s.submittedBy?.id || s.submittedBy || '').trim();
        if (uId && subUId && subUId === uId) return true;

        const subReg = String(s.submittedBy?.regNo || '').trim().toLowerCase();
        if (uReg && subReg && subReg === uReg) return true;

        if (project?.title && s.project?.title && s.project.title.toLowerCase().trim() === project.title.toLowerCase().trim()) return true;

        return false;
      });
      if (found) return found;
    }

    if (r.submission) {
      const subPId = String(r.submission.project?._id || r.submission.project?.id || r.submission.project || '').trim();
      if (pId && subPId && subPId === pId) return r.submission;
      if (r.project && String(r.project._id || r.project) === pId) return r.submission;
    }

    return null;
  };

  // Helper to strictly isolate and extract only this team's faculty evaluation
  const getProjectEvaluation = (r) => {
    if (!r) return null;
    if (Array.isArray(r.evaluations)) {
      const found = r.evaluations.find(e => {
        if (!e) return false;
        const evalPId = String(e.project?._id || e.project?.id || e.project || '').trim();
        if (pId && evalPId && evalPId === pId) {
          return e.evaluationType === 'FACULTY' || !e.evaluationType;
        }
        return false;
      });
      if (found) return found;
    }

    if (r.officialEvaluation) {
      const evalPId = String(r.officialEvaluation.project?._id || r.officialEvaluation.project?.id || r.officialEvaluation.project || '').trim();
      if (pId && evalPId && evalPId === pId) return r.officialEvaluation;
      if (r.project && String(r.project._id || r.project) === pId) return r.officialEvaluation;
    }

    return null;
  };

  // Filter reviews specifically for this student's project and cohort (Department + Year of Study)
  const projectReviews = reviews.filter(r => {
    const revPId = String(r.project?._id || r.project?.id || r.project || r.projectId || '');

    // 1. Direct project match
    if (pId && revPId && revPId === pId) return true;

    // 2. Department & Year of Study cohort match
    const studentDeptId = String(studentUser?.department?._id || studentUser?.department || project?.department?._id || project?.department || '').trim();
    const studentDeptName = (studentUser?.department?.name || studentUser?.dept || project?.department?.name || project?.dept || '').toLowerCase().trim();
    const studentYear = Number(studentUser?.yearOfStudy || studentUser?.year || 4);

    const revDeptId = String(r.department?._id || r.department || '').trim();
    const revDeptName = (r.department?.name || r.department?.code || '').toLowerCase().trim();
    const revYear = Number(r.yearOfStudy || 4);

    const matchesDept = !revDeptId || revDeptId === studentDeptId || (revDeptName && studentDeptName && studentDeptName.includes(revDeptName));
    const matchesYear = !r.yearOfStudy || revYear === studentYear;

    if (!revPId && matchesDept && matchesYear) return true;

    return !revPId && !revDeptId;
  });

  const completedCount = projectReviews.filter(r => Boolean(getProjectEvaluation(r))).length;
  
  // Pending submissions: only reviews that are active/open and haven't passed the deadline
  const pendingCount = projectReviews.filter(r => {
    const sub = getProjectSubmission(r);
    const ev = getProjectEvaluation(r);
    if (sub || ev) return false;
    const window = computeWindowStatus(r.scheduledDate, r.submissionDeadline || r.deadline);
    if (window.isAfter || r.status === 'COMPLETED' || r.status === 'CANCELLED') {
      return false;
    }
    return true;
  }).length;

  // Missed / Closed reviews: deadline passed without submission or evaluation
  const missedCount = projectReviews.filter(r => {
    const sub = getProjectSubmission(r);
    const ev = getProjectEvaluation(r);
    if (sub || ev) return false;
    const window = computeWindowStatus(r.scheduledDate, r.submissionDeadline || r.deadline);
    return window.isAfter || r.status === 'COMPLETED';
  }).length;

  // Sorted reviews: Active and latest reviews stay on top
  const sortedReviews = React.useMemo(() => {
    return [...projectReviews].sort((a, b) => {
      const evalA = Boolean(getProjectEvaluation(a));
      const evalB = Boolean(getProjectEvaluation(b));
      const winA = a.windowInfo || computeWindowStatus(a.scheduledDate, a.submissionDeadline || a.deadline);
      const winB = b.windowInfo || computeWindowStatus(b.scheduledDate, b.submissionDeadline || b.deadline);

      // Tier 1: Active reviews (window open and NOT evaluated yet)
      const isActiveA = winA.isOpen && !evalA;
      const isActiveB = winB.isOpen && !evalB;
      if (isActiveA && !isActiveB) return -1;
      if (!isActiveA && isActiveB) return 1;

      // Tier 2: Upcoming reviews (scheduled date in future and NOT evaluated yet)
      const isUpcomingA = winA.isBefore && !evalA;
      const isUpcomingB = winB.isBefore && !evalB;
      if (isUpcomingA && !isUpcomingB && (evalB || winB.isAfter)) return -1;
      if (!isUpcomingA && isUpcomingB && (evalA || winA.isAfter)) return 1;

      // Tier 3 or equal: Latest scheduledDate on top (descending order)
      const dateA = new Date(a.scheduledDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.scheduledDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [projectReviews, pId, uId, uReg]);

  return (
    <div className="student-review-section">
      {/* Institutional Review Governance Banner */}
      <div style={{
        padding: '14px 18px',
        borderRadius: '12px',
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <ShieldCheck size={20} color="#60a5fa" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
          <strong style={{ color: '#93c5fd' }}>Centralized Institutional Review Governance: </strong>
          All reviews are scheduled and monitored exclusively by the Academic Administration. Deliverable uploads, presentation links, and progress reporting become available strictly <strong>from 12:00 AM the day before the review until 11:59 PM of the review day</strong>. Your assigned faculty guide assesses submissions and assigns/modifies marks.
        </div>
      </div>

      {/* Top Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          padding: '18px 20px',
          borderRadius: '14px',
          background: 'var(--card-bg, #131b2e)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, letterSpacing: '0.5px' }}>
              TOTAL REVIEWS
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
              {projectReviews.length}
            </div>
          </div>
        </div>

        <div style={{
          padding: '18px 20px',
          borderRadius: '14px',
          background: 'var(--card-bg, #131b2e)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: pendingCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(148, 163, 184, 0.1)',
            color: pendingCount > 0 ? '#fbbf24' : 'var(--text-muted, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, letterSpacing: '0.5px' }}>
              PENDING SUBMISSIONS
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: pendingCount > 0 ? '#fbbf24' : 'var(--text-primary, #f8fafc)' }}>
              {pendingCount}
            </div>
          </div>
        </div>

        <div style={{
          padding: '18px 20px',
          borderRadius: '14px',
          background: 'var(--card-bg, #131b2e)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Award size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, letterSpacing: '0.5px' }}>
              EVALUATED & GRADED
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#34d399' }}>
              {completedCount}
            </div>
          </div>
        </div>

        {missedCount > 0 && (
          <div style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'var(--card-bg, #131b2e)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#f87171', fontWeight: 600, letterSpacing: '0.5px' }}>
                CLOSED / MISSED
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#f87171' }}>
                {missedCount}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reviews Header with Sync action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Scheduled Milestone Reviews
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
            Official dates, submission portal status, progress reporting, and faculty evaluation marks.
          </p>
        </div>

        {onRefreshReviews && (
          <button
            onClick={handleSyncClick}
            disabled={isSyncingReviews}
            className="btn-aesthetic btn-glass-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
          >
            {isSyncingReviews ? <ProjIntelSpinner size="xs" inline /> : <RefreshCw size={13} />}
            <span>{isSyncingReviews ? 'Refreshing...' : 'Sync Reviews'}</span>
          </button>
        )}
      </div>

      {/* Reviews List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {sortedReviews.length === 0 ? (
          <div style={{
            padding: '48px 24px',
            borderRadius: '16px',
            background: 'var(--card-bg, #131b2e)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            textAlign: 'center'
          }}>
            <Calendar size={48} style={{ color: 'var(--text-muted, #94a3b8)', opacity: 0.5, margin: '0 auto 16px' }} />
            <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>No Reviews Scheduled for Your Batch</h4>
            <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '14px' }}>
              Academic administration will schedule official milestone reviews for your department and year of study here.
            </p>
          </div>
        ) : (
          sortedReviews.map((rev) => {
            // Find team-specific submission and evaluation
            const teamSub = getProjectSubmission(rev);
            const teamEval = getProjectEvaluation(rev);

            const hasSubmission = Boolean(teamSub);
            const isReviewed = Boolean(teamEval) || rev.status === 'COMPLETED';
            const isLate = teamSub?.status === 'LATE';

            // Window calculation
            const win = rev.windowInfo || computeWindowStatus(rev.scheduledDate, rev.deadline);

            return (
              <div 
                key={rev._id || rev.id}
                style={{
                  borderRadius: '16px',
                  background: 'var(--card-bg, #131b2e)',
                  border: isReviewed 
                    ? '1px solid rgba(16, 185, 129, 0.35)' 
                    : hasSubmission 
                    ? '1px solid rgba(59, 130, 246, 0.35)' 
                    : '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                  padding: '24px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Status Indicator Stripe */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: isReviewed 
                    ? 'linear-gradient(90deg, #10b981, #059669)' 
                    : hasSubmission 
                    ? 'linear-gradient(90deg, #3b82f6, #2563eb)' 
                    : win.isOpen 
                    ? 'linear-gradient(90deg, #10b981, #3b82f6)' 
                    : 'linear-gradient(90deg, #f59e0b, #d97706)'
                }} />

                {/* Header Row */}
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
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-secondary, #cbd5e1)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {rev.reviewType || 'Milestone Review'}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-muted, #94a3b8)'
                      }}>
                        Max Marks: {rev.maxMarks || 50}
                      </span>
                      {rev.department && (
                        <span style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.04)'
                        }}>
                          Dept: {rev.department?.name || rev.department?.code || 'Engineering'}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                      {rev.title}
                    </h3>
                  </div>

                  {/* Submission Window Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {isReviewed && teamEval ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                        fontSize: '12px',
                        fontWeight: 700
                      }}>
                        <ShieldCheck size={14} />
                        EVALUATION FINALIZED (Graded)
                      </div>
                    ) : win.isOpen ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                        fontSize: '12px',
                        fontWeight: 700
                      }}>
                        <CheckCircle2 size={14} />
                        PORTAL OPEN (Submissions Accepted)
                      </div>
                    ) : win.isBefore ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#fbbf24',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        <Lock size={14} />
                        Opens {new Date(win.windowStart).toLocaleDateString([], { month: 'short', day: 'numeric' })} (Day Before Review)
                      </div>
                    ) : (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        <Lock size={14} />
                        Portal Closed
                      </div>
                    )}
                  </div>
                </div>

                {/* Date & Mode Info Box */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
                  marginBottom: '18px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Review Date
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} style={{ color: '#60a5fa' }} />
                      {new Date(rev.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Submission Deadline
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', color: win.isAfter && !hasSubmission ? '#f87171' : 'var(--text-primary, #f8fafc)' }}>
                      <Clock size={14} style={{ color: win.isAfter && !hasSubmission ? '#f87171' : '#fbbf24' }} />
                      {new Date(win.windowEnd || rev.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Evaluation Mode
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: '#10B981' }}>
                      🌐 {rev.venue || 'Online / Remote'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Required Deliverables
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: '#a855f7' }}>
                      Progress Report, {rev.requiredDocType || 'PDF / PPTX'}
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                {rev.instructions && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '18px', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Instructions: </strong>
                    {rev.instructions}
                  </div>
                )}

                {/* 1. If Team Has Been Evaluated */}
                {isReviewed && teamEval && (
                  <div style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Award size={16} /> Faculty Guide Official Evaluation Recorded
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                        {teamEval.marks} / {teamEval.maxMarks || rev.maxMarks || 50} Marks
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          padding: '2px 10px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.25)',
                          color: '#34d399',
                          marginLeft: '10px'
                        }}>
                          Grade: {teamEval.grade || 'A+'}
                        </span>
                      </div>
                      {teamEval.comments && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #cbd5e1)', marginTop: '4px', fontStyle: 'italic' }}>
                          "{teamEval.comments}"
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                        * Note: Marks can be revised or updated by your faculty guide.
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedReviewForView(rev);
                        setSelectedSubmissionForView(teamSub);
                        setSelectedEvaluationForView(teamEval);
                      }}
                      className="btn-aesthetic btn-sm"
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 16px'
                      }}
                    >
                      <Eye size={15} /> View Full Evaluation & Rubric
                    </button>
                  </div>
                )}

                {/* 2. Submission Details & Progress Report Preview */}
                {hasSubmission ? (
                  <div style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#60a5fa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <FileCheck size={20} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                            {teamSub.fileName || 'Review Deliverable Uploaded'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                            Submitted on {new Date(teamSub.submissionTime).toLocaleString()} • {teamSub.fileSize || '3.5 MB'} • Status: <span style={{ color: isLate ? '#fbbf24' : '#34d399', fontWeight: 600 }}>{teamSub.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* Resubmit / Edit allowed only when window is open, project not certified, and faculty has not graded evaluation yet */}
                      {win.isOpen && !isLocked && !teamEval ? (
                        <button
                          onClick={() => setSelectedReviewForSubmit(rev)}
                          className="btn-aesthetic btn-glass-secondary btn-sm"
                          style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Edit3 size={13} />
                          Update / Resubmit
                        </button>
                      ) : teamEval ? (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <ShieldCheck size={13} />
                          Submission Finalized (Marks Graded)
                        </span>
                      ) : null}
                    </div>

                    {/* Progress Report Summary */}
                    {teamSub.progressSummary && (
                      <div style={{
                        marginTop: '14px',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ListChecks size={13} />
                          Submitted Progress Report (Work Since Last Review)
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {teamSub.progressSummary}
                        </div>
                      </div>
                    )}

                    {/* Presentation & Demo Links */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                      {teamSub.presentationUrl && (
                        <a
                          href={teamSub.presentationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#fbbf24',
                            fontSize: '12px',
                            fontWeight: 600,
                            textDecoration: 'none'
                          }}
                        >
                          <Presentation size={14} />
                          Slide Deck Link
                          <ExternalLink size={12} />
                        </a>
                      )}

                      {teamSub.demoUrl && (
                        <a
                          href={teamSub.demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#34d399',
                            fontSize: '12px',
                            fontWeight: 600,
                            textDecoration: 'none'
                          }}
                        >
                          <Globe size={14} />
                          Prototype / GitHub
                          <ExternalLink size={12} />
                        </a>
                      )}

                      {teamSub.filePath && (
                        <a
                          href={getFileUrl(teamSub.filePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            color: '#60a5fa',
                            fontSize: '12px',
                            fontWeight: 600,
                            textDecoration: 'none'
                          }}
                        >
                          <FileText size={14} />
                          Download Report ({teamSub.fileName})
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  /* No submission yet */
                  <div style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed var(--border, rgba(255, 255, 255, 0.15))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                        No deliverables or progress report submitted yet.
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                        {win.isOpen
                          ? 'The submission window is currently open. Upload your progress report and presentation slides.'
                          : win.isBefore
                          ? `The submission portal unlocks on ${new Date(win.windowStart).toLocaleDateString([], { month: 'short', day: 'numeric' })} at 12:00 AM (Day before the review).`
                          : 'The submission window for this review date has ended.'}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!isLocked && win.isOpen && !teamEval) {
                          setSelectedReviewForSubmit(rev);
                        }
                      }}
                      disabled={!win.isOpen || isLocked || Boolean(teamEval)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        background: (win.isOpen && !isLocked && !teamEval)
                          ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                          : 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        color: (win.isOpen && !isLocked && !teamEval) ? '#fff' : 'var(--text-muted, #94a3b8)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: (win.isOpen && !isLocked && !teamEval) ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: (win.isOpen && !isLocked && !teamEval) ? 1 : 0.6
                      }}
                    >
                      {teamEval ? (
                        <>
                          <ShieldCheck size={15} /> Evaluated & Graded (Submission Finalized)
                        </>
                      ) : isLocked ? (
                        <>
                          <Lock size={15} /> Project Certified (View Only)
                        </>
                      ) : win.isOpen ? (
                        <>
                          <Upload size={15} /> Upload & Submit Deliverables
                        </>
                      ) : win.isBefore ? (
                        <>
                          <Lock size={15} /> Opens Day Before Review
                        </>
                      ) : (
                        <>
                          <Lock size={15} /> Submission Window Closed
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Submit Review Deliverable Modal */}
      {selectedReviewForSubmit && (
        <SubmitReviewModal
          isOpen={Boolean(selectedReviewForSubmit)}
          onClose={() => setSelectedReviewForSubmit(null)}
          review={selectedReviewForSubmit}
          project={project}
          studentUser={studentUser}
          onSubmitSuccess={async (revId, result) => {
            if (onSubmitReviewDeliverable) {
              await onSubmitReviewDeliverable(revId, result);
            }
            if (onRefreshReviews) {
              await onRefreshReviews();
            }
          }}
        />
      )}

      {/* View Evaluation Report Modal */}
      {selectedReviewForView && (
        <ReviewEvaluationModal
          isOpen={Boolean(selectedReviewForView)}
          onClose={() => {
            setSelectedReviewForView(null);
            setSelectedSubmissionForView(null);
            setSelectedEvaluationForView(null);
          }}
          mode="view"
          review={selectedReviewForView}
          submission={selectedSubmissionForView}
          evaluation={selectedEvaluationForView}
        />
      )}
    </div>
  );
};

export default StudentReviewSection;
