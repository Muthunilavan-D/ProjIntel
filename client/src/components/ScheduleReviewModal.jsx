import React, { useState } from 'react';
import ProjIntelSpinner from './ProjIntelSpinner';
import { 
  X, 
  Calendar, 
  Clock, 
  BookOpen, 
  Plus, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Sparkles
} from 'lucide-react';

const ScheduleReviewModal = ({
  isOpen,
  onClose,
  assignedProjects = [],
  currentGuideId,
  currentGuideName,
  onScheduleSuccess
}) => {
  if (!isOpen) return null;

  const [selectedProjectId, setSelectedProjectId] = useState(
    assignedProjects[0]?._id || assignedProjects[0]?.id || ''
  );
  const [reviewTitle, setReviewTitle] = useState('Review 1: SRS & System Architecture');
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
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  };

  const initialDateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatDateToLocalInput(d);
  })();

  const [reviewType, setReviewType] = useState('System Architecture');
  const [scheduledDate, setScheduledDate] = useState(initialDateStr);
  const [deadline, setDeadline] = useState(getOneDayPrior(initialDateStr));
  const [instructions, setInstructions] = useState(
    'Submit presentation slides (PPT/PPTX) and technical SRS report (PDF). Ensure architecture UML diagrams and schema definitions are detailed.'
  );
  const [requiredDocType, setRequiredDocType] = useState('PDF');
  const [maxMarks, setMaxMarks] = useState(50);
  const [rubricCriteria, setRubricCriteria] = useState([
    { name: 'Problem Statement & Scope Rigor', maxScore: 10 },
    { name: 'System Architecture & Database Design', maxScore: 15 },
    { name: 'Implementation & Prototype Progress', maxScore: 15 },
    { name: 'Presentation & Q&A Discussion', maxScore: 10 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleScheduledDateChange = (val) => {
    setScheduledDate(val);
    setDeadline(getOneDayPrior(val));
  };

  const handleAddCriterion = () => {
    setRubricCriteria([...rubricCriteria, { name: 'Technical Depth & Code Quality', maxScore: 10 }]);
  };

  const handleRemoveCriterion = (index) => {
    if (rubricCriteria.length <= 1) return;
    setRubricCriteria(rubricCriteria.filter((_, i) => i !== index));
  };

  const handleCriterionChange = (index, field, value) => {
    const updated = [...rubricCriteria];
    updated[index][field] = field === 'maxScore' ? Number(value) : value;
    setRubricCriteria(updated);

    // Auto update maxMarks
    if (field === 'maxScore') {
      const sum = updated.reduce((acc, curr) => acc + (Number(curr.maxScore) || 0), 0);
      setMaxMarks(sum);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Please select a target project.');
      return;
    }
    if (!reviewTitle.trim() || !scheduledDate || !deadline) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const reviewPayload = {
      projectId: selectedProjectId,
      guideId: currentGuideId || 'FAC-102',
      title: reviewTitle.trim(),
      reviewType: reviewType,
      scheduledDate: new Date(scheduledDate).toISOString(),
      deadline: new Date(deadline).toISOString(),
      instructions: instructions.trim(),
      requiredDocType: requiredDocType,
      maxMarks: Number(maxMarks) || 50,
      rubricCriteria: rubricCriteria
    };

    try {
      if (onScheduleSuccess) {
        await onScheduleSuccess(reviewPayload);
      }
      onClose();
    } catch (err) {
      console.error('Failed to schedule review:', err);
      setError(err.message || 'Error scheduling review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 15, 30, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1050,
      padding: '20px'
    }}>
      <div className="modal-container" style={{
        background: 'var(--card-bg, #0f172a)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        color: 'var(--text-primary, #f8fafc)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
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
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Calendar size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Schedule Milestone Review</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                Set review parameters, deadlines, and evaluation rubric
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="schedule-review-form" onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Target Project Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Target Project / Team <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              {assignedProjects.length === 0 && (
                <option value="">No approved projects available</option>
              )}
              {assignedProjects.map(p => (
                <option key={p._id || p.id} value={p._id || p.id}>
                  {p.title} ({p.leadName || p.dept || 'Team'})
                </option>
              ))}
            </select>
          </div>

          {/* Review Title & Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Review Title <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="e.g. Review 1: SRS & System Architecture"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Review Stage / Type
              </label>
              <select
                value={reviewType}
                onChange={(e) => {
                  setReviewType(e.target.value);
                  setReviewTitle(`${e.target.value} Review`);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#1e293b',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Synopsis">Review 0: Synopsis</option>
                <option value="System Architecture">Review 1: Architecture</option>
                <option value="Mid-Term Progress">Review 2: Mid-Term Demo</option>
                <option value="Final Viva & Demo">Review 3: Final Viva</option>
                <option value="Special Review">Special / Remedial Review</option>
              </select>
            </div>
          </div>

          {/* Dates Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Review Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="date"
                min={getMinScheduledDate()}
                value={scheduledDate}
                onChange={(e) => handleScheduledDateChange(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#1e293b',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Assumed for the entire day</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Submission Deadline <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="date"
                value={deadline}
                disabled
                readOnly
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  color: '#94a3b8',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  cursor: 'not-allowed'
                }}
              />
              <span style={{ fontSize: '11px', color: '#10B981' }}>Auto-set to 1 day prior to review</span>
            </div>
          </div>

          {/* Doc Format & Max Marks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Required Deliverable Format
              </label>
              <select
                value={requiredDocType}
                onChange={(e) => setRequiredDocType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#1e293b',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="PDF">PDF (SRS / Technical Report)</option>
                <option value="PPTX">PPTX (Presentation Slides)</option>
                <option value="ZIP">ZIP (Full Codebase / Schematics)</option>
                <option value="ALL">ALL / Any Format</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Maximum Marks
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={maxMarks}
                placeholder="100"
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val === '') setMaxMarks('');
                  else {
                    const num = parseInt(val, 10);
                    if (num <= 100) setMaxMarks(num);
                  }
                }}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Strictly numeric (Max 100 marks)</span>
            </div>
          </div>

          {/* Instructions */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Instructions & Deliverable Requirements
            </label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Enter instructions for the students..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                color: '#fff',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Rubric Criteria Builder */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>
                Evaluation Rubric Criteria ({rubricCriteria.length})
              </label>
              <button
                type="button"
                onClick={handleAddCriterion}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#818cf8',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={12} /> Add Criterion
              </button>
            </div>

            <div style={{
              borderRadius: '10px',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
              overflow: 'hidden'
            }}>
              {rubricCriteria.map((rc, idx) => (
                <div key={idx} style={{
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  borderBottom: idx < rubricCriteria.length - 1 ? '1px solid var(--border, rgba(255, 255, 255, 0.06))' : 'none',
                  background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                }}>
                  <input
                    type="text"
                    value={rc.name}
                    onChange={(e) => handleCriterionChange(idx, 'name', e.target.value)}
                    placeholder="Criterion name..."
                    required
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                      color: '#fff',
                      fontSize: '13px'
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={rc.maxScore}
                      onChange={(e) => handleCriterionChange(idx, 'maxScore', e.target.value)}
                      required
                      style={{
                        width: '55px',
                        padding: '8px 6px',
                        textAlign: 'center',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>marks</span>
                  </div>
                  {rubricCriteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCriterion(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
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
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-secondary, #cbd5e1)',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="schedule-review-form"
            disabled={isSubmitting}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSubmitting ? (
              <>
                <ProjIntelSpinner size="xs" inline label="Scheduling..." />
              </>
            ) : (
              <>
                <Calendar size={16} />
                Confirm & Schedule Review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleReviewModal;
