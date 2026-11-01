import React, { useState, useMemo } from 'react';
import {
  FileText,
  ExternalLink,
  Download,
  CheckCircle2,
  Clock,
  Calendar,
  Award,
  Sparkles,
  History,
  FileCheck,
  ShieldCheck,
  Building,
  Users,
  Info,
  ChevronRight,
  Eye
} from 'lucide-react';
import DocumentPreviewModal, { downloadFileDirectly } from './DocumentPreviewModal';

/**
 * IEEEGuideSection - "IEEE Status" Section on Guide Dashboard
 * Strictly informative oversight for faculty guides.
 * Displays:
 * - IEEE paper title
 * - Conference name & date
 * - Latest 2 drafts (Latest and Previous) with download links
 * - Verification status & proof documents for:
 *   1. Submission
 *   2. Acceptance
 *   3. Publication
 * NO grading, NO rubric, NO evaluation inputs.
 */
const IEEEGuideSection = ({
  projects = [],
  currentUser
}) => {
  // Helper to identify final-year projects
  const isFinalYear = (p) => {
    if (!p) return false;
    // Check batch (e.g. 2023-2027 in 2026-2027 is 4th year)
    const batch = p.batch || '';
    if (batch.includes('2027') || batch.includes('2023-2027')) return true;
    // Check team members
    if (Array.isArray(p.teamMembers)) {
      if (p.teamMembers.some(m => m?.yearOfStudy === 4 || m?.year === 4 || m?.yearOfStudy === '4' || m?.year === '4')) {
        return true;
      }
    }
    // Fallback: if project has ieeeDetails populated, treat as eligible
    if (p.ieeeDetails?.paperTitle || p.ieeeDetails?.latestDraft) return true;
    return false;
  };

  // Filter to final-year projects, or fallback to all assigned projects if none match
  const eligibleProjects = useMemo(() => {
    const finalYearOnly = (projects || []).filter(isFinalYear);
    return finalYearOnly.length > 0 ? finalYearOnly : (projects || []);
  }, [projects]);

  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    return eligibleProjects[0]?._id || eligibleProjects[0]?.id || null;
  });
  const [previewDocModal, setPreviewDocModal] = useState({ isOpen: false, doc: null, title: '' });

  const handleOpenPreview = (doc, title) => {
    if (!doc) return;
    setPreviewDocModal({ isOpen: true, doc, title });
  };

  // Selected project object
  const selectedProject = useMemo(() => {
    return eligibleProjects.find(p => (p._id || p.id) === selectedProjectId) || eligibleProjects[0] || null;
  }, [eligibleProjects, selectedProjectId]);

  const hasValidFile = (fileObj) => {
    if (!fileObj || typeof fileObj !== 'object') return false;
    const path = (fileObj.filePath || fileObj.url || fileObj.path || '').trim();
    const name = (fileObj.fileName || fileObj.originalName || fileObj.name || '').trim();
    return Boolean((path.length > 0 && path !== '#') || name.length > 0);
  };

  const normalizeFileObj = (fileObj, defaultFolder = 'ieee') => {
    if (!hasValidFile(fileObj)) return null;
    const fileName = (fileObj.fileName || fileObj.originalName || fileObj.name || '').trim();
    const rawPath = (fileObj.filePath || fileObj.url || fileObj.path || '').trim();
    const filePath = (rawPath && rawPath !== '#') ? rawPath : `/uploads/${defaultFolder}/${fileName}`;
    return {
      ...fileObj,
      fileName: fileName || (filePath ? filePath.split(/[/\\]/).pop() : ''),
      filePath,
      originalName: fileObj.originalName || fileObj.name || fileName
    };
  };

  const ieee = selectedProject?.ieeeDetails || {};
  const latestDraft = normalizeFileObj(ieee.latestDraft);
  const previousDraft = normalizeFileObj(ieee.previousDraft);
  const submissionProof = normalizeFileObj(ieee.submissionProof);
  const acceptanceProof = normalizeFileObj(ieee.acceptanceProof);
  const publicationProof = normalizeFileObj(ieee.publicationProof);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (!selectedProject) {
    return (
      <div className="aesthetic-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <Award size={36} style={{ color: 'var(--text-dim)', margin: '0 auto 0.75rem', display: 'block' }} />
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>No Final Year Projects Assigned</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '480px', margin: '0.35rem auto 0' }}>
          The IEEE Status section is exclusive to final-year academic teams. When final-year projects are assigned to your guidance, their IEEE publication tracking will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="ieee-guide-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Informative Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.12) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem 1.75rem',
        boxShadow: '0 8px 30px rgba(99, 102, 241, 0.12)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-pill)', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#818cf8', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Info size={12} />
              <span>Faculty Supervisory Oversight • Informative Only</span>
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              IEEE Conference &amp; Publication Status
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.865rem', marginTop: '0.35rem', maxWidth: '820px', lineHeight: '1.5' }}>
              Keep yourself continuously updated with the research and publication progress of your final-year teams. Inspect manuscript drafts, conference deadlines, and attached proof documents. Under institutional guidelines, this section is strictly informative and requires no rubric evaluation or marks entry.
            </p>
          </div>

          {/* Project Selector if faculty has multiple teams */}
          {eligibleProjects.length > 1 && (
            <div style={{ minWidth: '240px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Select Team / Project:
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="aesthetic-input"
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                {eligibleProjects.map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {p.title || 'Untitled Project'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Selected Team Overview Strip */}
      <div style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Users size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {selectedProject.title}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Lead: <strong>{selectedProject.leadName || 'Student'}</strong> • Batch: <strong>{selectedProject.batch || '2023-2027'}</strong> • Dept: <strong>{selectedProject.department?.name || selectedProject.dept || 'Computer Science & Engineering'}</strong>
            </div>
          </div>
        </div>

        {/* Quick Publication Pipeline Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.72rem',
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            background: ieee.isSubmitted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
            color: ieee.isSubmitted ? '#10B981' : 'var(--text-muted)',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            {ieee.isSubmitted ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            Submitted: {ieee.isSubmitted ? 'YES' : 'NO'}
          </span>

          <span style={{
            fontSize: '0.72rem',
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            background: ieee.isAccepted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
            color: ieee.isAccepted ? '#10B981' : 'var(--text-muted)',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            {ieee.isAccepted ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            Accepted: {ieee.isAccepted ? 'YES' : 'NO'}
          </span>

          <span style={{
            fontSize: '0.72rem',
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            background: ieee.isPublished ? 'rgba(6, 182, 212, 0.15)' : 'rgba(148, 163, 184, 0.15)',
            color: ieee.isPublished ? '#06b6d4' : 'var(--text-muted)',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            {ieee.isPublished ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            Published: {ieee.isPublished ? 'YES' : 'NO'}
          </span>
        </div>
      </div>

      {/* Main Grid: Card 1 (Paper & Conference) + Card 2 (Last 2 Drafts) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

        {/* ============================================================== */}
        {/* CARD 1: IEEE PAPER DETAILS & CONFERENCE INFORMATION             */}
        {/* ============================================================== */}
        <div className="aesthetic-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Building size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Research Title &amp; Target Conference
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Authoritative paper details submitted by the project team
              </span>
            </div>
          </div>

          {/* Paper Title Display */}
          <div style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem'
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#818cf8', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.35rem' }}>
              IEEE Paper Title
            </div>
            <div style={{ fontSize: '0.985rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: '1.45' }}>
              {ieee.paperTitle || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Pending submission by team</span>}
            </div>
          </div>

          {/* Conference Name & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
            <div style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.9rem'
            }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                IEEE Conference Name
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {ieee.conferenceName || <span style={{ color: 'var(--text-dim)' }}>Not specified yet</span>}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.9rem'
            }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                Conference Date
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={14} style={{ color: '#06b6d4' }} />
                <span>{ieee.conferenceDate ? formatDate(ieee.conferenceDate) : 'Date TBD'}</span>
              </div>
            </div>
          </div>

          {/* Pipeline Verification Milestones & Proof Documents */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.785rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Milestone Proof Verification
            </div>

            {/* 1. Submission Status & Proof */}
            <div style={{
              background: ieee.isSubmitted ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${ieee.isSubmitted ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: ieee.isSubmitted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ieee.isSubmitted ? '#10B981' : 'var(--text-muted)' }}>
                  {ieee.isSubmitted ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    1. Paper Submission
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Status: {ieee.isSubmitted ? <strong style={{ color: '#10B981' }}>Submitted to Conference</strong> : 'Pending Submission'}
                  </div>
                </div>
              </div>

              {hasValidFile(submissionProof) ? (
                <button
                  type="button"
                  onClick={() => handleOpenPreview(submissionProof, 'Conference Submission Proof')}
                  className="btn-aesthetic btn-glass-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                  title="View conference submission receipt/proof"
                >
                  <Eye size={12} />
                  <span>View Proof Doc</span>
                </button>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  No proof document
                </span>
              )}
            </div>

            {/* 2. Acceptance Status & Proof */}
            <div style={{
              background: ieee.isAccepted ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${ieee.isAccepted ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: ieee.isAccepted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ieee.isAccepted ? '#10B981' : 'var(--text-muted)' }}>
                  {ieee.isAccepted ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    2. Paper Acceptance
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Status: {ieee.isAccepted ? <strong style={{ color: '#10B981' }}>Officially Accepted</strong> : 'Under Peer Review'}
                  </div>
                </div>
              </div>

              {hasValidFile(acceptanceProof) ? (
                <button
                  type="button"
                  onClick={() => handleOpenPreview(acceptanceProof, 'Conference Acceptance Proof')}
                  className="btn-aesthetic btn-glass-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                  title="View conference acceptance notification/letter"
                >
                  <Eye size={12} />
                  <span>View Proof Doc</span>
                </button>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  No proof document
                </span>
              )}
            </div>

            {/* 3. Publication Status & Proof */}
            <div style={{
              background: ieee.isPublished ? 'rgba(6, 182, 212, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${ieee.isPublished ? 'rgba(6, 182, 212, 0.25)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: ieee.isPublished ? 'rgba(6, 182, 212, 0.2)' : 'rgba(148, 163, 184, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ieee.isPublished ? '#06b6d4' : 'var(--text-muted)' }}>
                  {ieee.isPublished ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    3. Publication &amp; Proceedings
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Status: {ieee.isPublished ? <strong style={{ color: '#06b6d4' }}>Published in IEEE</strong> : 'Pending Publication'}
                  </div>
                </div>
              </div>

              {hasValidFile(publicationProof) ? (
                <button
                  type="button"
                  onClick={() => handleOpenPreview(publicationProof, 'IEEE Publication Certificate')}
                  className="btn-aesthetic btn-glass-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                  title="View publication certificate or proceedings"
                >
                  <Eye size={12} />
                  <span>View Proof Doc</span>
                </button>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  No proof document
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CARD 2: IEEE MANUSCRIPT DRAFTS REPOSITORY (LAST 2 VERSIONS)   */}
        {/* ============================================================== */}
        <div className="aesthetic-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
              <History size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Manuscript Drafts (Last 2 Retained)
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Inspect the team's working draft and previous revision
              </span>
            </div>
          </div>

          {/* DRAFT 1: LATEST WORKING DRAFT */}
          <div style={{
            background: latestDraft ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${latestDraft ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: latestDraft ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                  color: latestDraft ? '#34d399' : 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}>
                  {latestDraft ? `Draft v${latestDraft.version || 2} (Latest)` : 'Latest Draft'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Active Team Manuscript
                </span>
              </div>

              {hasValidFile(latestDraft) && latestDraft.uploadedAt && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={11} /> {formatDate(latestDraft.uploadedAt)}
                </span>
              )}
            </div>

            {hasValidFile(latestDraft) ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
                    <FileCheck size={20} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={latestDraft.originalName || latestDraft.fileName}>
                      {latestDraft.originalName || latestDraft.fileName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Size: {latestDraft.fileSize || 'Standard'} • Format: {String(latestDraft.fileName || '').split('.').pop().toUpperCase()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(latestDraft, 'Latest IEEE Draft Manuscript')}
                    className="btn-aesthetic btn-glass-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Preview manuscript inside application"
                  >
                    <Eye size={13} />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFileDirectly(latestDraft)}
                    className="btn-aesthetic btn-primary-glow btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Download latest paper directly"
                  >
                    <Download size={13} />
                    <span>Download Paper</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.25rem 0.5rem', color: 'var(--text-dim)', fontSize: '0.825rem' }}>
                <span>The team has not uploaded an IEEE paper draft yet.</span>
              </div>
            )}
          </div>

          {/* DRAFT 2: PREVIOUS ARCHIVED DRAFT */}
          <div style={{
            background: previousDraft ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.01)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(148, 163, 184, 0.15)',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}>
                  {previousDraft ? `Draft v${previousDraft.version || 1} (Previous)` : 'Previous Draft'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Prior Revision Snapshot
                </span>
              </div>

              {hasValidFile(previousDraft) && previousDraft.uploadedAt && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={11} /> {formatDate(previousDraft.uploadedAt)}
                </span>
              )}
            </div>

            {hasValidFile(previousDraft) ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(148, 163, 184, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <FileText size={20} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={previousDraft.originalName || previousDraft.fileName}>
                      {previousDraft.originalName || previousDraft.fileName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Size: {previousDraft.fileSize || 'Standard'} • Format: {String(previousDraft.fileName || '').split('.').pop().toUpperCase()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(previousDraft, 'Previous IEEE Draft Snapshot')}
                    className="btn-aesthetic btn-glass-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Preview previous manuscript inside application"
                  >
                    <Eye size={13} />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFileDirectly(previousDraft)}
                    className="btn-aesthetic btn-glass-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Download previous draft directly"
                  >
                    <Download size={13} />
                    <span>Download Draft</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0.5rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                <span>No previous version recorded yet. When the student team updates their manuscript, the prior draft will be archived here.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-App Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewDocModal.isOpen}
        onClose={() => setPreviewDocModal({ isOpen: false, doc: null, title: '' })}
        document={previewDocModal.doc}
        title={previewDocModal.title}
      />
    </div>
  );
};

export default IEEEGuideSection;
