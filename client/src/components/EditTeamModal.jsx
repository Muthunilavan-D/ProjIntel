import React, { useState, useEffect } from 'react';
import ProjIntelSpinner from './ProjIntelSpinner';
import { 
  X, 
  Edit3, 
  Save, 
  CheckCircle2, 
  Layers, 
  BookOpen, 
  Users, 
  Code, 
  Building, 
  Target,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { analyzeProjectSimilarity } from '../services/aiService';

const EditTeamModal = ({ isOpen, onClose, team, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    dept: 'Computer Science & Engineering',
    domain: 'Artificial Intelligence & Machine Learning',
    problemStatement: '',
    objectives: '',
    abstract: '',
    technologies: '',
    teamMembers: ''
  });

  const [isEvaluatingSimilarity, setIsEvaluatingSimilarity] = useState(false);
  const [similarityResult, setSimilarityResult] = useState(null);
  const [similarityError, setSimilarityError] = useState(null);

  useEffect(() => {
    if (team) {
      setFormData({
        title: team.title || '',
        dept: team.dept || (team.department?.name || 'Computer Science & Engineering'),
        domain: team.domain || 'Artificial Intelligence & Machine Learning',
        problemStatement: team.problemStatement || '',
        objectives: team.objectives || '',
        abstract: team.abstract || team.description || '',
        technologies: team.technologies || team.techStack || '',
        teamMembers: Array.isArray(team.teamMembers) 
          ? team.teamMembers.map(m => typeof m === 'object' && m ? (m.name || m.regNo || m._id) : String(m)).join(', ') 
          : (Array.isArray(team.members) ? team.members.map(m => typeof m === 'object' && m ? (m.name || m.regNo || m._id) : String(m)).join(', ') : (team.teamMembers || team.members || ''))
      });
      setSimilarityResult(null);
      setSimilarityError(null);
      setIsEvaluatingSimilarity(false);
    }
  }, [team, isOpen]);

  const handleEvaluateSimilarity = async () => {
    if (!formData.title.trim()) {
      setSimilarityError('Please enter a Project Title before evaluating similarity.');
      return;
    }
    if (!formData.abstract.trim() && !formData.problemStatement.trim()) {
      setSimilarityError('Please provide an Abstract or Problem Statement to evaluate conceptual similarity.');
      return;
    }

    setSimilarityError(null);
    setIsEvaluatingSimilarity(true);

    try {
      const payload = {
        _id: team?._id || team?.id,
        id: team?.id || team?._id,
        title: formData.title.trim(),
        domain: formData.domain,
        technologies: formData.technologies,
        problemStatement: formData.problemStatement.trim(),
        abstract: formData.abstract.trim(),
        description: formData.abstract.trim(),
        objectives: formData.objectives,
        dept: formData.dept,
        department: team?.department?._id || team?.department || formData.dept,
        batch: team?.batch || '2023-2027',
        academicYear: team?.academicYear || '2026-2027'
      };

      const res = await analyzeProjectSimilarity(payload);
      if (res && res.success) {
        setSimilarityResult(res);
      } else {
        setSimilarityError(res?.error || 'AI similarity check could not be completed. Please try again.');
      }
    } catch (err) {
      console.error('Similarity check error:', err);
      setSimilarityError('Network error while evaluating similarity. Please verify your connection.');
    } finally {
      setIsEvaluatingSimilarity(false);
    }
  };

  if (!isOpen || !team) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedMembers = formData.teamMembers
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    onSave({
      ...team,
      title: formData.title,
      dept: formData.dept,
      domain: formData.domain,
      problemStatement: formData.problemStatement,
      objectives: formData.objectives,
      abstract: formData.abstract,
      description: formData.abstract,
      technologies: formData.technologies,
      techStack: formData.technologies,
      teamMembers: updatedMembers.length > 0 ? updatedMembers : team.teamMembers,
      members: updatedMembers.length > 0 ? updatedMembers : team.members,
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    onClose();
  };

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div 
        className="aesthetic-modal-card" 
        style={{ maxWidth: '620px', maxHeight: 'calc(100vh - 2.5rem)', overflowY: 'auto', padding: '1.75rem' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="brand-icon" style={{ background: 'var(--gradient-primary)' }}>
            <Edit3 size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Update Project Proposal Details</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Alterations will immediately sync to the faculty guide and department portal.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Project Title *</label>
            <div className="input-wrapper">
              <BookOpen className="input-icon" size={16} />
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="aesthetic-input"
                placeholder="Enter project title"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Department</label>
              <div className="input-wrapper">
                <Building className="input-icon" size={16} />
                <select
                  value={formData.dept}
                  onChange={(e) => setFormData({ ...formData, dept: e.target.value })}
                  className="aesthetic-input"
                  style={{ width: '100%', height: '42px', minHeight: '42px', paddingLeft: '2.5rem', paddingRight: '2.2rem' }}
                >
                  <option value="Computer Science & Engineering">CSE</option>
                  <option value="Information Technology">IT</option>
                  <option value="Artificial Intelligence & Data Science">AI & DS</option>
                  <option value="Electronics & Communication">ECE</option>
                  <option value="Electrical & Electronics">EEE</option>
                  <option value="Mechanical Engineering">Mechanical</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Project Domain</label>
              <div className="input-wrapper">
                <Layers className="input-icon" size={16} />
                <input
                  type="text"
                  required
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="aesthetic-input"
                  placeholder="e.g. Artificial Intelligence"
                  style={{ width: '100%', height: '42px', minHeight: '42px', paddingLeft: '2.5rem' }}
                />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Technologies & Frameworks</label>
            <div className="input-wrapper">
              <Code className="input-icon" size={16} />
              <input
                type="text"
                required
                value={formData.technologies}
                onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                className="aesthetic-input"
                placeholder="e.g. React, Node.js, Express, MongoDB"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Problem Statement</label>
            <textarea
              rows="2"
              required
              value={formData.problemStatement}
              onChange={(e) => setFormData({ ...formData, problemStatement: e.target.value })}
              className="aesthetic-input"
              style={{ padding: '0.55rem 0.85rem', resize: 'vertical' }}
              placeholder="What core problem is solved?"
            ></textarea>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Key Objectives</label>
            <textarea
              rows="2"
              required
              value={formData.objectives}
              onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
              className="aesthetic-input"
              style={{ padding: '0.55rem 0.85rem', resize: 'vertical' }}
              placeholder="List project objectives..."
            ></textarea>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Team Members (Comma Separated)</label>
            <div className="input-wrapper">
              <Users className="input-icon" size={16} />
              <input
                type="text"
                required
                value={formData.teamMembers}
                onChange={(e) => setFormData({ ...formData, teamMembers: e.target.value })}
                className="aesthetic-input"
                placeholder="e.g. Muthunilavan D, Student Name"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Abstract / Project Summary</label>
            <textarea
              rows="2"
              required
              value={formData.abstract}
              onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
              className="aesthetic-input"
              style={{ padding: '0.55rem 0.85rem', resize: 'vertical' }}
              placeholder="Describe methodology and deliverables..."
            ></textarea>
          </div>

          {/* AI Novelty & Similarity Evaluation Card */}
          <div style={{
            marginBottom: '1rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                  <span>AI Similarity & Novelty Checker</span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Verify proposal uniqueness against other projects in <strong>{formData.dept} ({team?.batch || '2023-2027'})</strong>.
                </p>
              </div>

              <button
                type="button"
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={handleEvaluateSimilarity}
                disabled={isEvaluatingSimilarity}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.45rem 0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                  background: isEvaluatingSimilarity ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.18)',
                  color: '#818CF8'
                }}
                title="Scan database for conceptually similar projects within your department & cohort"
              >
                {isEvaluatingSimilarity ? (
                    <ProjIntelSpinner size="xs" inline label="Analyzing Repository..." />
                  ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Evaluate Similarity</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {similarityError && (
              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.75rem'
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{similarityError}</span>
              </div>
            )}

            {/* Similarity Result Card */}
            {similarityResult && (
              <div style={{
                borderRadius: '10px',
                padding: '0.9rem',
                background: similarityResult.isSafe ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${similarityResult.isSafe ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                marginTop: '0.75rem'
              }}>
                {similarityResult.isSafe ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#10B981', fontWeight: 700, fontSize: '0.88rem' }}>
                        <CheckCircle2 size={16} />
                        <span>Safe Signal: High Novelty Confirmed</span>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#10B981',
                        fontWeight: 700,
                        border: '1px solid rgba(16, 185, 129, 0.4)'
                      }}>
                        {similarityResult.maxSimilarityPct}% Overlap • Safe to Propose ✓
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                      {similarityResult.recommendation || `No similar projects found in ${formData.dept} for batch ${team?.batch || '2023-2027'}. Your proposed idea is novel!`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.45rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#F59E0B', fontWeight: 700, fontSize: '0.88rem' }}>
                        <AlertTriangle size={16} />
                        <span>Advisory Warning: Conceptual Similarity Detected</span>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        fontWeight: 700,
                        border: '1px solid rgba(245, 158, 11, 0.4)'
                      }}>
                        {similarityResult.maxSimilarityPct}% Similarity • Review Advised
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      Similar existing project(s) found in <strong>{formData.dept} ({team?.batch || '2023-2027'})</strong>:
                    </div>

                    {/* Similar Projects List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.65rem' }}>
                      {(similarityResult.comparisons || [])
                        .filter(c => c.similarityPct >= 35)
                        .slice(0, 3)
                        .map((comp, cIdx) => (
                          <div key={comp.projectId || cIdx} style={{
                            background: 'rgba(0, 0, 0, 0.25)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '6px',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.78rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                              <span style={{ fontWeight: 700, color: '#fbbf24' }}>{comp.title}</span>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: comp.similarityPct >= 65 ? '#ef4444' : '#fbbf24',
                                flexShrink: 0
                              }}>
                                {comp.similarityPct}% match
                              </span>
                            </div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                              {comp.overlapSummary}
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Guidance / Recommendation */}
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45, fontStyle: 'italic', borderTop: '1px solid rgba(245, 158, 11, 0.2)', paddingTop: '0.45rem' }}>
                      💡 <strong>Guidance:</strong> {similarityResult.recommendation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-aesthetic btn-primary-glow"
            style={{ width: '100%', padding: '0.7rem' }}
          >
            <Save size={16} />
            <span>Save & Reflect Alterations</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditTeamModal;
