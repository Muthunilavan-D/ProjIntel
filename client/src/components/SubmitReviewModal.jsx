import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Presentation, 
  FileArchive,
  Send,
  Calendar,
  Lock,
  Globe,
  ExternalLink,
  Target,
  ListChecks,
  AlertCircle
} from 'lucide-react';
import { uploadReviewDeliverableFile } from '../services/documentService';
import { submitReviewDeliverable } from '../services/reviewService';
import ProjIntelSpinner from './ProjIntelSpinner';

const getWindowInfo = (scheduledDate, deadline) => {
  if (!scheduledDate) return { isOpen: true, isBefore: false, isAfter: false };
  const d = new Date(scheduledDate);
  const windowStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 0, 0, 0, 0);
  let windowEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  if (deadline) {
    const dl = new Date(deadline);
    if (dl > windowEnd) windowEnd = dl;
  }
  const now = new Date();
  return {
    isOpen: now >= windowStart && now <= windowEnd,
    isBefore: now < windowStart,
    isAfter: now > windowEnd,
    windowStart,
    windowEnd
  };
};

const SubmitReviewModal = ({ 
  isOpen, 
  onClose, 
  review, 
  project, 
  studentUser, 
  onSubmitSuccess 
}) => {
  if (!isOpen || !review) return null;

  // Resolve existing submission strictly for this project team
  const pId = String(project?._id || project?.id || '').trim();
  const uId = String(studentUser?._id || studentUser?.id || '').trim();
  const uReg = String(studentUser?.regNo || '').trim().toLowerCase();

  const existingSub = (Array.isArray(review.submissions)
    ? review.submissions.find(s => {
        if (!s) return false;
        const subPId = String(s.project?._id || s.project?.id || s.project || '').trim();
        if (pId && subPId && subPId === pId) return true;
        const subUId = String(s.submittedBy?._id || s.submittedBy?.id || s.submittedBy || '').trim();
        if (uId && subUId && subUId === uId) return true;
        const subReg = String(s.submittedBy?.regNo || '').trim().toLowerCase();
        if (uReg && subReg && subReg === uReg) return true;
        if (project?.title && s.project?.title && s.project.title.toLowerCase().trim() === project.title.toLowerCase().trim()) return true;
        return false;
      })
    : null) || (
      (review.project && String(review.project?._id || review.project) === pId) ? review.submission : null
    ) || null;

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState(
    existingSub?.fileName || `${project?.title ? project.title.split(' ')[0] : 'Team'}_${(review.reviewType || 'Review').replace(/\s+/g, '_')}_Report.pdf`
  );
  const [docType, setDocType] = useState(existingSub?.documentType || 'PDF');
  const [fileSize, setFileSize] = useState(existingSub?.fileSize || '3.5 MB');
  const [notes, setNotes] = useState(existingSub?.notes || '');
  
  // Specific institutional review requirements
  const [progressSummary, setProgressSummary] = useState(
    existingSub?.progressSummary || ''
  );
  const [presentationUrl, setPresentationUrl] = useState(
    existingSub?.presentationUrl || ''
  );
  const [demoUrl, setDemoUrl] = useState(
    existingSub?.demoUrl || ''
  );
  const [achievementsText, setAchievementsText] = useState(
    Array.isArray(existingSub?.keyAchievements) 
      ? existingSub.keyAchievements.join('\n') 
      : (existingSub?.keyAchievements || '')
  );
  const [roadblocks, setRoadblocks] = useState(
    existingSub?.roadblocks || ''
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const windowInfo = review.windowInfo || getWindowInfo(review.scheduledDate, review.deadline);
  const isPastDeadline = review.deadline && new Date() > new Date(review.deadline);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSetFile(e.target.files[0]);
    }
  };

  const handleSetFile = (file) => {
    setSelectedFile(file);
    setFileName(file.name);
    const ext = file.name.split('.').pop().toUpperCase();
    if (['PPT', 'PPTX'].includes(ext)) setDocType('PPTX');
    else if (['ZIP', 'RAR', 'TAR', 'GZ'].includes(ext)) setDocType('ZIP');
    else setDocType('PDF');

    const formattedSize = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${(file.size / 1024).toFixed(1)} KB`;
    setFileSize(formattedSize);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!windowInfo.isOpen) {
      setError(
        windowInfo.isBefore
          ? `Submission portal is closed. It will open on ${new Date(windowInfo.windowStart).toLocaleDateString()} at 12:00 AM (the day before the review).`
          : `Submission window has ended for this review cycle.`
      );
      return;
    }

    if (!progressSummary.trim()) {
      setError('Please provide a description of progress and work completed since the previous review.');
      return;
    }

    if (!selectedFile && !existingSub && !presentationUrl.trim() && !fileName.trim()) {
      setError('Please upload a deliverable document or presentation file.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const achievementsList = achievementsText
      .split('\n')
      .map(a => a.replace(/^[•\-\*]\s*/, '').trim())
      .filter(Boolean);

    const metadata = {
      projectId: project?._id || project?.id,
      studentId: studentUser?._id || studentUser?.id,
      documentType: docType,
      notes: notes.trim(),
      progressSummary: progressSummary.trim(),
      presentationUrl: presentationUrl.trim(),
      demoUrl: demoUrl.trim(),
      keyAchievements: achievementsList,
      roadblocks: roadblocks.trim()
    };

    try {
      let resultData = null;

      if (selectedFile) {
        // Upload multipart file to backend
        const res = await uploadReviewDeliverableFile(review._id || review.id, selectedFile, metadata);
        if (res && res.success) {
          resultData = res.data;
        } else {
          throw new Error(res?.error || 'Failed to upload review file');
        }
      } else {
        // Submit review metadata / progress report without re-uploading file
        const payload = {
          ...metadata,
          fileName: existingSub?.fileName || fileName.trim(),
          filePath: existingSub?.filePath || `/uploads/reviews/${fileName.trim()}`,
          fileUrl: existingSub?.fileUrl || '',
          fileSize: existingSub?.fileSize || fileSize,
          submissionTime: new Date().toISOString(),
          status: isPastDeadline ? 'LATE' : 'SUBMITTED'
        };
        const res = await submitReviewDeliverable(review._id || review.id, payload);
        if (res && res.success) {
          resultData = res.data;
        } else {
          throw new Error(res?.error || 'Failed to submit review progress');
        }
      }

      if (onSubmitSuccess) {
        await onSubmitSuccess(review._id || review.id, resultData);
      }
      onClose();
    } catch (err) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit review progress report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocIcon = (type) => {
    if (type === 'PPTX' || type === 'PPT') return <Presentation size={18} color="#F59E0B" />;
    if (type === 'ZIP') return <FileArchive size={18} color="#8B5CF6" />;
    return <FileText size={18} color="#EF4444" />;
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 30, 0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '20px'
      }}
    >
      <div 
        className="modal-container" 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg, #131b2e)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          color: 'var(--text-primary, #f8fafc)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Upload size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {existingSub ? 'Update Review Deliverable & Progress' : 'Submit Review Deliverables & Progress'}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                {review.title} • {review.reviewType || 'Milestone Review'}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Window Banner */}
        <div style={{
          padding: '12px 24px',
          background: windowInfo.isOpen 
            ? 'rgba(16, 185, 129, 0.12)' 
            : windowInfo.isBefore 
            ? 'rgba(245, 158, 11, 0.12)' 
            : 'rgba(239, 68, 68, 0.12)',
          borderBottom: `1px solid ${windowInfo.isOpen ? 'rgba(16, 185, 129, 0.25)' : windowInfo.isBefore ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {windowInfo.isOpen ? (
              <CheckCircle2 size={16} color="#34d399" />
            ) : windowInfo.isBefore ? (
              <Lock size={16} color="#fbbf24" />
            ) : (
              <AlertTriangle size={16} color="#f87171" />
            )}
            <span style={{ fontWeight: 600, color: windowInfo.isOpen ? '#34d399' : windowInfo.isBefore ? '#fbbf24' : '#f87171' }}>
              {windowInfo.isOpen
                ? 'Submission Window Active (Allowed from day before until end of review day)'
                : windowInfo.isBefore
                ? `Submission Locked: Opens on ${new Date(windowInfo.windowStart).toLocaleDateString()} at 12:00 AM (Day before review)`
                : 'Submission Window Closed: Review date deadline has expired'}
            </span>
          </div>
          <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '11px' }}>
            Review: {new Date(review.scheduledDate).toLocaleDateString()}
          </span>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              color: '#f87171',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Review Instructions if any */}
          {review.instructions && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
              borderRadius: '10px',
              fontSize: '12px',
              color: 'var(--text-secondary, #cbd5e1)',
              marginBottom: '16px'
            }}>
              <strong style={{ color: 'var(--text-primary, #f8fafc)', display: 'block', marginBottom: '2px' }}>
                Instructions from Department / Guide:
              </strong>
              {review.instructions}
            </div>
          )}

          {/* 1. Progress & Work Done Description (Mandatory as per institutional flow) */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <ListChecks size={15} color="#60a5fa" />
              PROGRESS & WORK COMPLETED SINCE LAST REVIEW <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={4}
              required
              disabled={!windowInfo.isOpen}
              placeholder="Detail the modules developed, milestones achieved, algorithms built, and integration performed since the previous review..."
              value={progressSummary}
              onChange={(e) => setProgressSummary(e.target.value)}
              className="aesthetic-input"
              style={{ width: '100%', padding: '10px 14px', fontSize: '13px', resize: 'vertical' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', display: 'block' }}>
              Your faculty guide will review this progress summary when assigning rubric marks.
            </span>
          </div>

          {/* 2. Drag & Drop File Area */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <FileText size={15} color="#34d399" />
              UPLOAD REPORT / SUPPORTING DOCUMENT (PDF / DOCX)
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => windowInfo.isOpen && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? '#3b82f6' : selectedFile ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
                background: isDragging 
                  ? 'rgba(59, 130, 246, 0.1)' 
                  : selectedFile 
                    ? 'rgba(16, 185, 129, 0.04)' 
                    : 'rgba(0, 0, 0, 0.2)',
                borderRadius: '12px',
                padding: selectedFile ? '14px 18px' : '20px 16px',
                textAlign: 'center',
                cursor: windowInfo.isOpen ? 'pointer' : 'not-allowed',
                opacity: windowInfo.isOpen ? 1 : 0.6,
                transition: 'all 0.2s ease'
              }}
            >
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={!windowInfo.isOpen}
                style={{ display: 'none' }}
                accept=".pdf,.ppt,.pptx,.zip,.doc,.docx"
              />

              {selectedFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {getDocIcon(docType)}
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc', wordBreak: 'break-all' }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, marginTop: '2px' }}>
                        {fileSize} • File ready for review evaluation
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : existingSub?.fileName ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa' }}>
                      Current file: {existingSub.fileName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                      Click to upload a new replacement version (Optional)
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>Already Uploaded</span>
                </div>
              ) : (
                <div>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px'
                  }}>
                    <Upload size={18} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    Click to browse or drag & drop deliverable
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                    PDF, PPTX, or ZIP (Max: 50MB)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Presentation Slides & Prototype Demo URLs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Presentation Slide Link (Google Slides / Canva / OneDrive)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  disabled={!windowInfo.isOpen}
                  placeholder="https://docs.google.com/presentation/d/..."
                  value={presentationUrl}
                  onChange={(e) => setPresentationUrl(e.target.value)}
                  className="aesthetic-input"
                  style={{ width: '100%', padding: '9px 12px 9px 32px', fontSize: '12px' }}
                />
                <Presentation size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#fbbf24' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Live Prototype / GitHub Repo Link
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  disabled={!windowInfo.isOpen}
                  placeholder="https://github.com/... or https://..."
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  className="aesthetic-input"
                  style={{ width: '100%', padding: '9px 12px 9px 32px', fontSize: '12px' }}
                />
                <Globe size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#34d399' }} />
              </div>
            </div>
          </div>

          {/* 4. Key Achievements & Roadblocks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Key Completed Deliverables (One per line)
              </label>
              <textarea
                rows={3}
                disabled={!windowInfo.isOpen}
                placeholder="• System Architecture finalized&#10;• Database schema deployed&#10;• Authentication API tested"
                value={achievementsText}
                onChange={(e) => setAchievementsText(e.target.value)}
                className="aesthetic-input"
                style={{ width: '100%', padding: '8px 12px', fontSize: '12px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Challenges / Roadblocks Encountered
              </label>
              <textarea
                rows={3}
                disabled={!windowInfo.isOpen}
                placeholder="Mention any blockers, dependency delays, or hardware issues faced..."
                value={roadblocks}
                onChange={(e) => setRoadblocks(e.target.value)}
                className="aesthetic-input"
                style={{ width: '100%', padding: '8px 12px', fontSize: '12px', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* 5. Additional Notes for Faculty Guide */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
              Submission Notes / Remarks for Faculty Guide
            </label>
            <input
              type="text"
              disabled={!windowInfo.isOpen}
              placeholder="e.g. Prototype demo requires camera access; slide deck covers chapters 1-4."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="aesthetic-input"
              style={{ width: '100%', padding: '8px 12px', fontSize: '12px' }}
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <button
            type="button"
            className="btn-aesthetic btn-glass-secondary btn-sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="btn-aesthetic btn-primary-glow btn-sm"
            disabled={isSubmitting || !windowInfo.isOpen}
            style={{
              minWidth: '180px',
              opacity: windowInfo.isOpen ? 1 : 0.5,
              cursor: windowInfo.isOpen ? 'pointer' : 'not-allowed'
            }}
          >
            {isSubmitting ? (
              <ProjIntelSpinner size="xs" inline label="Submitting Deliverable..." />
            ) : !windowInfo.isOpen ? (
              <>
                <Lock size={15} />
                <span>Submission Window Closed</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>{existingSub ? 'Update Submission' : 'Submit Review Deliverable'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmitReviewModal;
