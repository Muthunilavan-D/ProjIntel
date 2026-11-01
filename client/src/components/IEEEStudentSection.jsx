import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  ExternalLink,
  Download,
  Save,
  AlertCircle,
  Sparkles,
  FileCheck,
  History,
  ChevronRight,
  ShieldCheck,
  Building,
  RefreshCw,
  Eye
} from 'lucide-react';
import ProjIntelSpinner from './ProjIntelSpinner';
import DocumentPreviewModal, { downloadFileDirectly } from './DocumentPreviewModal';
import { getIeeeDetails, updateIeeeDetails, uploadIeeeDraft, uploadIeeeProof } from '../services/projectService';

/** Helper to verify a document object has an actual uploaded file on the server */
const hasValidFile = (fileObj) => {
  return Boolean(
    fileObj &&
    typeof fileObj === 'object' &&
    fileObj.filePath &&
    typeof fileObj.filePath === 'string' &&
    fileObj.filePath.trim().length > 0 &&
    fileObj.filePath.trim() !== '#'
  );
};

/**
 * IEEEStudentSection - "IEEE Details" Component
 * Exclusively accessible for Final Year (Year 4) Students.
 * Features:
 * - IEEE paper upload (.docx / .pdf) maintaining the last 2 drafts (latest & previous)
 * - 5 Details:
 *   1. Title of the IEEE paper
 *   2. Name of the IEEE conference & date (optional)
 *   3. Paper submitted or not + submission proof document
 *   4. Paper accepted or not + acceptance proof document
 *   5. Paper published or not + publishment proof document
 */
const IEEEStudentSection = ({
  project,
  user,
  onUpdateProject,
  isViewOnly = false
}) => {
  const projectId = project?._id || project?.id;

  // Local state for IEEE fields
  const [paperTitle, setPaperTitle] = useState('');
  const [conferenceName, setConferenceName] = useState('');
  const [conferenceDate, setConferenceDate] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const [latestDraft, setLatestDraft] = useState(null);
  const [previousDraft, setPreviousDraft] = useState(null);

  const [submissionProof, setSubmissionProof] = useState(null);
  const [acceptanceProof, setAcceptanceProof] = useState(null);
  const [publicationProof, setPublicationProof] = useState(null);

  // Loading and feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingDraft, setIsUploadingDraft] = useState(false);
  const [uploadingProofType, setUploadingProofType] = useState(null); // 'submission' | 'acceptance' | 'publication'
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [previewDocModal, setPreviewDocModal] = useState({ isOpen: false, doc: null, title: '' });

  const handleOpenPreview = (doc, title) => {
    if (!doc) return;
    setPreviewDocModal({ isOpen: true, doc, title });
  };

  // File input refs
  const draftInputRef = useRef(null);
  const submissionProofInputRef = useRef(null);
  const acceptanceProofInputRef = useRef(null);
  const publicationProofInputRef = useRef(null);

  // Editing and synchronization refs to guard against polling overwriting active user input
  const isEditingRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const lastProjectIdRef = useRef(null);

  // Sync state from project prop (guarded against overwriting active user edits)
  useEffect(() => {
    if (project?.ieeeDetails) {
      const currentId = project._id || project.id;
      const isNewProject = lastProjectIdRef.current !== currentId;
      lastProjectIdRef.current = currentId;

      const details = project.ieeeDetails;

      // Only overwrite text fields if project changed or user is not actively editing
      if (isNewProject || !isEditingRef.current) {
        setPaperTitle(details.paperTitle || '');
        setConferenceName(details.conferenceName || '');
        setConferenceDate(details.conferenceDate ? details.conferenceDate.split('T')[0] : '');
        setIsSubmitted(!!details.isSubmitted);
        setIsAccepted(!!details.isAccepted);
        setIsPublished(!!details.isPublished);
      }

      // Always keep drafts and proofs synchronized (only when a valid file is actually uploaded)
      setLatestDraft(hasValidFile(details.latestDraft) ? details.latestDraft : null);
      setPreviousDraft(hasValidFile(details.previousDraft) ? details.previousDraft : null);

      setSubmissionProof(hasValidFile(details.submissionProof) ? details.submissionProof : null);
      setAcceptanceProof(hasValidFile(details.acceptanceProof) ? details.acceptanceProof : null);
      setPublicationProof(hasValidFile(details.publicationProof) ? details.publicationProof : null);
    }
  }, [project]);

  // On mount or when projectId changes, fetch fresh IEEE details from backend
  useEffect(() => {
    if (!projectId) return;
    let isCancelled = false;

    getIeeeDetails(projectId)
      .then(res => {
        if (!isCancelled && res && res.success && res.data) {
          const details = res.data;
          setPaperTitle(details.paperTitle || '');
          setConferenceName(details.conferenceName || '');
          setConferenceDate(details.conferenceDate ? details.conferenceDate.split('T')[0] : '');
          setIsSubmitted(!!details.isSubmitted);
          setIsAccepted(!!details.isAccepted);
          setIsPublished(!!details.isPublished);

          setLatestDraft(hasValidFile(details.latestDraft) ? details.latestDraft : null);
          setPreviousDraft(hasValidFile(details.previousDraft) ? details.previousDraft : null);

          setSubmissionProof(hasValidFile(details.submissionProof) ? details.submissionProof : null);
          setAcceptanceProof(hasValidFile(details.acceptanceProof) ? details.acceptanceProof : null);
          setPublicationProof(hasValidFile(details.publicationProof) ? details.publicationProof : null);

          if (onUpdateProject && project) {
            onUpdateProject({
              ...project,
              ieeeDetails: details
            }, { silent: true, skipApi: true });
          }
        }
      })
      .catch(err => {
        console.warn('Could not load fresh IEEE details:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Background auto-save helper
  const saveFieldsInBackground = async (overrideValues = {}) => {
    if (isViewOnly || !projectId) return;
    const payload = {
      paperTitle: (overrideValues.paperTitle !== undefined ? overrideValues.paperTitle : paperTitle).trim(),
      conferenceName: (overrideValues.conferenceName !== undefined ? overrideValues.conferenceName : conferenceName).trim(),
      conferenceDate: overrideValues.conferenceDate !== undefined ? overrideValues.conferenceDate : conferenceDate,
      isSubmitted: overrideValues.isSubmitted !== undefined ? overrideValues.isSubmitted : isSubmitted,
      isAccepted: overrideValues.isAccepted !== undefined ? overrideValues.isAccepted : isAccepted,
      isPublished: overrideValues.isPublished !== undefined ? overrideValues.isPublished : isPublished
    };

    try {
      const res = await updateIeeeDetails(projectId, payload);
      if (res?.success && res?.data) {
        if (onUpdateProject && project) {
          onUpdateProject({
            ...project,
            ieeeDetails: res.data
          }, { silent: true, skipApi: true });
        }
      }
    } catch (err) {
      console.warn('Background auto-save failed:', err);
    }
  };

  // Immediate toggle status handler with instant persistence to avoid polling reversion
  const handleToggleStatus = async (field, value) => {
    if (isViewOnly || !projectId) return;

    if (field === 'isSubmitted') setIsSubmitted(value);
    if (field === 'isAccepted') setIsAccepted(value);
    if (field === 'isPublished') setIsPublished(value);

    const updatedPayload = {
      paperTitle: paperTitle.trim(),
      conferenceName: conferenceName.trim(),
      conferenceDate: conferenceDate || '',
      isSubmitted: field === 'isSubmitted' ? value : isSubmitted,
      isAccepted: field === 'isAccepted' ? value : isAccepted,
      isPublished: field === 'isPublished' ? value : isPublished
    };

    // Persist immediately to server
    try {
      const res = await updateIeeeDetails(projectId, updatedPayload);
      if (res?.success && res?.data) {
        if (onUpdateProject && project) {
          onUpdateProject({
            ...project,
            ieeeDetails: res.data
          }, { silent: true, skipApi: true });
        }
      }
    } catch (err) {
      console.warn('Auto-save toggle status failed:', err);
    }
  };

  // Debounced input handler for text fields (updates local state smoothly while typing without triggering toasts)
  const handleTextChange = (field, val) => {
    isEditingRef.current = true;
    if (field === 'paperTitle') setPaperTitle(val);
    if (field === 'conferenceName') setConferenceName(val);
    if (field === 'conferenceDate') setConferenceDate(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveFieldsInBackground({
        paperTitle: field === 'paperTitle' ? val : paperTitle,
        conferenceName: field === 'conferenceName' ? val : conferenceName,
        conferenceDate: field === 'conferenceDate' ? val : conferenceDate
      });
    }, 1200);
  };

  const handleInputBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    saveFieldsInBackground();
    setTimeout(() => {
      isEditingRef.current = false;
    }, 500);
  };

  // Dismiss notifications automatically
  useEffect(() => {
    if (saveSuccessMessage) {
      const timer = setTimeout(() => setSaveSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessMessage]);

  // Handle saving text fields and toggles
  const handleSaveDetails = async (e) => {
    if (e) e.preventDefault();
    if (isViewOnly || !projectId) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    const payload = {
      paperTitle: paperTitle.trim(),
      conferenceName: conferenceName.trim(),
      conferenceDate: conferenceDate || '',
      isSubmitted,
      isAccepted,
      isPublished
    };

    try {
      const res = await updateIeeeDetails(projectId, payload);
      if (res && res.success) {
        setSaveSuccessMessage('Details saved.');
        if (onUpdateProject && project) {
          onUpdateProject({
            ...project,
            ieeeDetails: res.data
          });
        }
      } else {
        throw new Error(res?.error || 'Failed to save IEEE details.');
      }
    } catch (err) {
      console.warn('updateIeeeDetails error, updating local state:', err);
      const updatedIeee = {
        ...(project?.ieeeDetails || {}),
        ...payload,
        latestDraft,
        previousDraft,
        submissionProof,
        acceptanceProof,
        publicationProof,
        updatedAt: new Date().toISOString()
      };
      if (onUpdateProject && project) {
        onUpdateProject({
          ...project,
          ieeeDetails: updatedIeee
        });
      }
      setErrorMessage(err.message || 'Failed to save IEEE details.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle uploading paper draft (.docx or .pdf)
  const handleDraftFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate extension
    const allowed = ['.pdf', '.docx', '.doc'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setErrorMessage('Invalid file type for IEEE draft. Only DOCX and PDF documents are allowed.');
      if (draftInputRef.current) draftInputRef.current.value = '';
      return;
    }

    setIsUploadingDraft(true);
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await uploadIeeeDraft(projectId, formData);
      if (res && res.success) {
        setLatestDraft(hasValidFile(res.data.latestDraft) ? res.data.latestDraft : null);
        setPreviousDraft(hasValidFile(res.data.previousDraft) ? res.data.previousDraft : null);
        setSaveSuccessMessage('Draft uploaded.');
        if (onUpdateProject && project) {
          onUpdateProject({
            ...project,
            ieeeDetails: res.data
          });
        }
      } else {
        throw new Error(res?.error || 'Failed to upload draft.');
      }
    } catch (err) {
      console.error('uploadIeeeDraft failed:', err);
      setErrorMessage(err.message || 'Failed to upload draft.');
    } finally {
      setIsUploadingDraft(false);
      if (draftInputRef.current) draftInputRef.current.value = '';
    }
  };

  // Handle uploading proof document
  const handleProofFileSelected = async (e, proofType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProofType(proofType);
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('proofType', proofType);

    try {
      const res = await uploadIeeeProof(projectId, formData);
      if (res && res.success) {
        const d = res.data;
        if (proofType === 'submission') {
          setSubmissionProof(hasValidFile(d.submissionProof) ? d.submissionProof : null);
          setIsSubmitted(true);
        } else if (proofType === 'acceptance') {
          setAcceptanceProof(hasValidFile(d.acceptanceProof) ? d.acceptanceProof : null);
          setIsAccepted(true);
        } else if (proofType === 'publication') {
          setPublicationProof(hasValidFile(d.publicationProof) ? d.publicationProof : null);
          setIsPublished(true);
        }
        setSaveSuccessMessage('Proof uploaded.');
        if (onUpdateProject && project) {
          onUpdateProject({ ...project, ieeeDetails: d });
        }
      } else {
        throw new Error(res?.error || 'Failed to upload proof document.');
      }
    } catch (err) {
      console.error('uploadIeeeProof failed:', err);
      setErrorMessage(err.message || 'Failed to upload proof document.');
    } finally {
      setUploadingProofType(null);
      if (proofType === 'submission' && submissionProofInputRef.current) submissionProofInputRef.current.value = '';
      if (proofType === 'acceptance' && acceptanceProofInputRef.current) acceptanceProofInputRef.current.value = '';
      if (proofType === 'publication' && publicationProofInputRef.current) publicationProofInputRef.current.value = '';
    }
  };

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

  return (
    <div className="ieee-student-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Exclusive Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.12) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem 1.75rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(99, 102, 241, 0.12)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-pill)', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#818cf8', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Sparkles size={12} />
              <span>Final Year Exclusive • IEEE Research Pipeline</span>
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              IEEE Details &amp; Publication Tracker
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.865rem', marginTop: '0.35rem', maxWidth: '780px', lineHeight: '1.5' }}>
              Upload and manage your IEEE conference research paper drafts (maintaining the last 2 versions), record submission progress, and attach single proof documents for submission, acceptance, and publication.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-aesthetic btn-primary-glow btn-sm"
              onClick={handleSaveDetails}
              disabled={isSaving || isViewOnly}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
            >
              {isSaving ? <ProjIntelSpinner size="xs" inline label="Saving..." /> : (
                <>
                  <Save size={14} />
                  <span>Save IEEE Details</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {saveSuccessMessage && (
          <div style={{ marginTop: '1rem', padding: '0.65rem 0.95rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#10B981', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} />
            <span>{saveSuccessMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div style={{ marginTop: '1rem', padding: '0.65rem 0.95rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#EF4444', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Grid: 2 Columns (Card 1: Drafts Management | Card 2: 5 Detail Fields) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>

        {/* ============================================================== */}
        {/* CARD 1: IEEE PAPER DRAFTS (LAST 2 DRAFTS RETAINED)             */}
        {/* ============================================================== */}
        <div className="aesthetic-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <FileText size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  IEEE Paper Drafts
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  DOCX or PDF format • Automatically preserves last 2 drafts
                </span>
              </div>
            </div>

            {/* Hidden Input for Draft Upload */}
            <input
              type="file"
              ref={draftInputRef}
              accept=".pdf,.docx,.doc"
              onChange={handleDraftFileSelected}
              style={{ display: 'none' }}
              disabled={isUploadingDraft || isViewOnly}
            />

            <button
              type="button"
              className="btn-aesthetic btn-glass-secondary btn-sm"
              onClick={() => draftInputRef.current?.click()}
              disabled={isUploadingDraft || isViewOnly}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              title="Upload new draft (replaces previous and becomes latest)"
            >
              {isUploadingDraft ? <ProjIntelSpinner size="xs" inline label="Uploading..." /> : (
                <>
                  <UploadCloud size={14} />
                  <span>{latestDraft ? 'Update / Re-upload' : 'Upload Paper'}</span>
                </>
              )}
            </button>
          </div>

          {/* Draft Retention Explanation Notice */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 0.95rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            fontSize: '0.785rem',
            color: 'var(--text-muted)',
            lineHeight: '1.45'
          }}>
            <History size={16} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Two-Version Roll-Forward Mechanism:</strong> Whenever you make changes and re-upload your manuscript, the current latest draft automatically moves to <strong>Previous Draft</strong>, and your newly uploaded file becomes the <strong>Latest Draft</strong>.
            </div>
          </div>

          {/* DRAFT 1: LATEST DRAFT */}
          <div style={{
            background: hasValidFile(latestDraft) ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${hasValidFile(latestDraft) ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: hasValidFile(latestDraft) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                  color: hasValidFile(latestDraft) ? '#34d399' : 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}>
                  {hasValidFile(latestDraft) ? `Draft v${latestDraft.version || 2} (Latest)` : 'Latest Draft'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Active Working Copy
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(latestDraft, 'Latest IEEE Paper Draft')}
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
                    className="btn-aesthetic btn-glass-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Download draft to computer directly"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.25rem 0.5rem', color: 'var(--text-dim)', fontSize: '0.825rem' }}>
                <UploadCloud size={24} style={{ margin: '0 auto 0.4rem', opacity: 0.5, display: 'block' }} />
                <span>No IEEE paper draft uploaded yet. Click <strong>Upload Paper</strong> above.</span>
              </div>
            )}
          </div>

          {/* DRAFT 2: PREVIOUS DRAFT */}
          <div style={{
            background: hasValidFile(previousDraft) ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.01)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1.1rem',
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
                  {hasValidFile(previousDraft) ? `Draft v${previousDraft.version || 1} (Previous)` : 'Previous Draft'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Prior Revision Archive
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
                    onClick={() => handleOpenPreview(previousDraft, 'Previous IEEE Draft (v1)')}
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
                    title="Download previous draft to computer directly"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0.5rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                <span>No prior draft in archive. When you re-upload your manuscript, the previous version will be preserved here.</span>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* CARD 2: 5 IMPORTANT IEEE DETAILS & PROOF DOCUMENTS             */}
        {/* ============================================================== */}
        <div className="aesthetic-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
              <Building size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Conference &amp; Publication Details
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                5 Key Fields: Paper Title, Conference, Submission, Acceptance, Publication
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* PART 1: Title of the IEEE paper */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                1. Title of the IEEE Paper <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={paperTitle}
                onChange={(e) => handleTextChange('paperTitle', e.target.value)}
                onBlur={handleInputBlur}
                placeholder="Enter complete IEEE paper title..."
                className="aesthetic-input"
                style={{ width: '100%', fontSize: '0.875rem' }}
                disabled={isViewOnly}
                required
              />
            </div>

            {/* PART 2: Name of the IEEE conference and date (optional) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  2. Name of IEEE Conference <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={conferenceName}
                  onChange={(e) => handleTextChange('conferenceName', e.target.value)}
                  onBlur={handleInputBlur}
                  placeholder="e.g. IEEE ICACCS 2027"
                  className="aesthetic-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                  disabled={isViewOnly}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  Conference Date <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="date"
                  value={conferenceDate}
                  onChange={(e) => handleTextChange('conferenceDate', e.target.value)}
                  onBlur={handleInputBlur}
                  className="aesthetic-input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                  disabled={isViewOnly}
                />
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }} />

            {/* PART 3: Paper submitted or not (if yes submission proof document) */}
            <div style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.9rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  3. Paper Submitted to Conference?
                </span>

                <div className="ieee-toggle-pill-group" role="group" aria-label="3. Paper Submitted to Conference?">
                  <button
                    type="button"
                    className={`ieee-toggle-pill-btn ${isSubmitted ? 'is-active-yes' : ''}`}
                    onClick={() => handleToggleStatus('isSubmitted', true)}
                    disabled={isViewOnly}
                    title="Mark as Yes (Paper submitted to conference)"
                  >
                    <CheckCircle2 size={13} />
                    <span>YES</span>
                  </button>
                  <button
                    type="button"
                    className={`ieee-toggle-pill-btn ${!isSubmitted ? 'is-active-no' : ''}`}
                    onClick={() => handleToggleStatus('isSubmitted', false)}
                    disabled={isViewOnly}
                    title="Mark as No"
                  >
                    <XCircle size={13} />
                    <span>NO</span>
                  </button>
                </div>
              </div>

              {/* Submission Proof Document Slot */}
              {isSubmitted && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <FileCheck size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.785rem', fontWeight: 600, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {submissionProof ? (submissionProof.originalName || submissionProof.fileName) : 'No submission proof attached'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {submissionProof ? `Attached: ${formatDate(submissionProof.uploadedAt)} (${submissionProof.fileSize || 'Standard'})` : 'Attach EasyChair / CMT acknowledgement (1 file only)'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="file"
                      ref={submissionProofInputRef}
                      accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                      onChange={(e) => handleProofFileSelected(e, 'submission')}
                      style={{ display: 'none' }}
                      disabled={uploadingProofType === 'submission' || isViewOnly}
                    />

                    {hasValidFile(submissionProof) && (
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(submissionProof, 'Conference Submission Proof')}
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        title="View conference submission receipt/proof"
                      >
                        <Eye size={12} />
                        <span>View Proof</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-aesthetic btn-glass-secondary btn-sm"
                      onClick={() => submissionProofInputRef.current?.click()}
                      disabled={uploadingProofType === 'submission' || isViewOnly}
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      {uploadingProofType === 'submission' ? (
                        <ProjIntelSpinner size="xs" inline label="Uploading..." />
                      ) : (
                        <>
                          <UploadCloud size={12} />
                          <span>{submissionProof ? 'Replace' : 'Attach Proof'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PART 4: Paper accepted or not (if yes acceptance proof document) */}
            <div style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.9rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  4. Paper Accepted by Review Committee?
                </span>

                <div className="ieee-toggle-pill-group" role="group" aria-label="4. Paper Accepted by Review Committee?">
                  <button
                    type="button"
                    className={`ieee-toggle-pill-btn ${isAccepted ? 'is-active-yes' : ''}`}
                    onClick={() => handleToggleStatus('isAccepted', true)}
                    disabled={isViewOnly}
                    title="Mark as Yes (Paper accepted by review committee)"
                  >
                    <CheckCircle2 size={13} />
                    <span>YES</span>
                  </button>
                  <button
                    type="button"
                    className={`ieee-toggle-pill-btn ${!isAccepted ? 'is-active-no' : ''}`}
                    onClick={() => handleToggleStatus('isAccepted', false)}
                    disabled={isViewOnly}
                    title="Mark as No"
                  >
                    <XCircle size={13} />
                    <span>NO</span>
                  </button>
                </div>
              </div>

              {/* Acceptance Proof Document Slot */}
              {isAccepted && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <ShieldCheck size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.785rem', fontWeight: 600, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {acceptanceProof ? (acceptanceProof.originalName || acceptanceProof.fileName) : 'No acceptance letter attached'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {acceptanceProof ? `Attached: ${formatDate(acceptanceProof.uploadedAt)} (${acceptanceProof.fileSize || 'Standard'})` : 'Attach official acceptance notification letter (1 file only)'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="file"
                      ref={acceptanceProofInputRef}
                      accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                      onChange={(e) => handleProofFileSelected(e, 'acceptance')}
                      style={{ display: 'none' }}
                      disabled={uploadingProofType === 'acceptance' || isViewOnly}
                    />

                    {hasValidFile(acceptanceProof) && (
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(acceptanceProof, 'Conference Acceptance Proof')}
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        title="View conference acceptance notification/letter"
                      >
                        <Eye size={12} />
                        <span>View Proof</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-aesthetic btn-glass-secondary btn-sm"
                      onClick={() => acceptanceProofInputRef.current?.click()}
                      disabled={uploadingProofType === 'acceptance' || isViewOnly}
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      {uploadingProofType === 'acceptance' ? (
                        <ProjIntelSpinner size="xs" inline label="Uploading..." />
                      ) : (
                        <>
                          <UploadCloud size={12} />
                          <span>{acceptanceProof ? 'Replace' : 'Attach Proof'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PART 5: Paper published or not (if yes publishment proof document) */}
            <div style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.9rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  5. Paper Published in IEEE Proceedings / Xplore?
                </span>

                <div className="ieee-toggle-pill-group" role="group" aria-label="5. Paper Published in IEEE Proceedings / Xplore?">
                  <button
                    type="button"
                    className={`ieee-toggle-pill-btn ${isPublished ? 'is-active-yes' : ''}`}
                    onClick={() => handleToggleStatus('isPublished', true)}
                    disabled={isViewOnly}
                    title="Mark as Yes (Published in IEEE Proceedings / Xplore)"
                  >
                    <CheckCircle2 size={13} />
                    <span>YES</span>
                  </button>
                  <button
                    type="button"
                    className={`ieee-toggle-pill-btn ${!isPublished ? 'is-active-no' : ''}`}
                    onClick={() => handleToggleStatus('isPublished', false)}
                    disabled={isViewOnly}
                    title="Mark as No"
                  >
                    <XCircle size={13} />
                    <span>NO</span>
                  </button>
                </div>
              </div>

              {/* Publishment Proof Document Slot */}
              {isPublished && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(6, 182, 212, 0.06)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <Sparkles size={16} style={{ color: '#06b6d4', flexShrink: 0 }} />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.785rem', fontWeight: 600, color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {publicationProof ? (publicationProof.originalName || publicationProof.fileName) : 'No publication certificate attached'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {publicationProof ? `Attached: ${formatDate(publicationProof.uploadedAt)} (${publicationProof.fileSize || 'Standard'})` : 'Attach IEEE publication certificate or proceedings snapshot (1 file only)'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="file"
                      ref={publicationProofInputRef}
                      accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                      onChange={(e) => handleProofFileSelected(e, 'publication')}
                      style={{ display: 'none' }}
                      disabled={uploadingProofType === 'publication' || isViewOnly}
                    />

                    {hasValidFile(publicationProof) && (
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(publicationProof, 'IEEE Publication Certificate')}
                        className="btn-aesthetic btn-glass-secondary btn-sm"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        title="View publication certificate or published paper link"
                      >
                        <Eye size={12} />
                        <span>View Certificate</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-aesthetic btn-glass-secondary btn-sm"
                      onClick={() => publicationProofInputRef.current?.click()}
                      disabled={uploadingProofType === 'publication' || isViewOnly}
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      {uploadingProofType === 'publication' ? (
                        <ProjIntelSpinner size="xs" inline label="Uploading..." />
                      ) : (
                        <>
                          <UploadCloud size={12} />
                          <span>{publicationProof ? 'Replace' : 'Attach Proof'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </form>
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

export default IEEEStudentSection;
