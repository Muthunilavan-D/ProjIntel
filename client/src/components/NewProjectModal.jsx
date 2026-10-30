import React, { useState, useEffect } from 'react';
import ProjIntelSpinner from './ProjIntelSpinner';
import { 
  X, 
  FolderPlus, 
  Layers, 
  FileText, 
  Code, 
  Users, 
  CheckCircle2, 
  HelpCircle, 
  Target,
  Send,
  Save,
  Sparkles,
  AlertTriangle,
  Info
} from 'lucide-react';
import { analyzeProjectSimilarity } from '../services/aiService';

const NewProjectModal = ({ isOpen, onClose, onCreateProject, user, team }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    problemStatement: '',
    objectives: '',
    domain: 'Artificial Intelligence & Machine Learning',
    technologies: '',
    teamMembers: ''
  });

  const [isEvaluatingSimilarity, setIsEvaluatingSimilarity] = useState(false);
  const [similarityResult, setSimilarityResult] = useState(null);
  const [similarityError, setSimilarityError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        problemStatement: '',
        objectives: '',
        domain: 'Artificial Intelligence & Machine Learning',
        technologies: '',
        teamMembers: ''
      });
      setSimilarityResult(null);
      setSimilarityError(null);
      setIsEvaluatingSimilarity(false);
    }
  }, [isOpen]);

  const handleEvaluateSimilarity = async () => {
    if (!formData.title.trim()) {
      setSimilarityError('Please enter a Project Title before evaluating similarity.');
      return;
    }
    if (!formData.description.trim() && !formData.problemStatement.trim()) {
      setSimilarityError('Please provide an Abstract / Overview or Problem Statement to evaluate conceptual similarity.');
      return;
    }

    setSimilarityError(null);
    setIsEvaluatingSimilarity(true);

    try {
      const payload = {
        title: formData.title.trim(),
        domain: formData.domain,
        technologies: formData.technologies,
        problemStatement: formData.problemStatement.trim(),
        abstract: formData.description.trim(),
        description: formData.description.trim(),
        objectives: formData.objectives,
        dept: user?.department?.name || user?.dept || 'Computer Science & Engineering',
        department: user?.department?._id || user?.department || 'Computer Science & Engineering',
        batch: user?.batch || team?.batch || '2023-2027',
        academicYear: user?.academicYear || '2026-2027'
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

  if (!isOpen) return null;

  const handleSubmit = (actionType) => {
    if (!formData.title.trim()) return;

    let resolvedMembers = [];
    if (team && Array.isArray(team.members) && team.members.length > 0) {
      const accepted = team.members.filter(m => m.status === 'ACCEPTED');
      resolvedMembers = accepted.map(m => m.student?._id || m.student);
      if (team.leader) {
        const leaderId = team.leader?._id || team.leader;
        if (!resolvedMembers.some(id => String(id) === String(leaderId))) {
          resolvedMembers.unshift(leaderId);
        }
      }
    } else {
      const membersArray = formData.teamMembers
        .split(',')
        .map(m => m.trim())
        .filter(m => m.length > 0);
      resolvedMembers = membersArray.length > 0 ? membersArray : [user?._id || user?.id || user?.name || 'Student Lead'];
    }

    const officialLead = team?.leader || user;

    const projectPayload = {
      id: `PROJ-${Date.now().toString().slice(-4)}`,
      title: formData.title,
      description: formData.description,
      problemStatement: formData.problemStatement,
      objectives: formData.objectives,
      domain: formData.domain,
      technologies: formData.technologies,
      teamId: team?._id || null,
      teamMembers: resolvedMembers,
      status: actionType === 'submit' ? 'UNDER_REVIEW' : 'DRAFT',
      submittedDate: actionType === 'submit' ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
      guideName: null,
      guideId: null,
      leadStudentId: officialLead?._id || officialLead?.id || user?._id || user?.id,
      leadName: officialLead?.name || user?.name || 'Student Lead',
      regNo: officialLead?.regNo || user?.regNo || '',
      dept: user?.department?.name || user?.dept || 'Computer Science & Engineering',
      department: user?.department?._id || user?.department?.name || user?.department || user?.dept || 'Computer Science & Engineering',
      email: user?.email || '',
      progress: 0,
      tasks: [],
      weeklyUpdates: [],
      documents: [],
      feedback: []
    };

    onCreateProject(projectPayload, actionType);
    onClose();
  };

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div 
        className="aesthetic-modal-card" 
        style={{ maxWidth: '640px', maxHeight: 'calc(100vh - 2.5rem)', overflowY: 'auto', padding: '1.75rem' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="brand-icon" style={{ background: 'var(--gradient-primary)' }}>
            <FolderPlus size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Create Project Proposal</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
              Define scope, problem statement, objectives, and technology stack.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit('submit'); }}>
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Project Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Autonomous Vision-Guided Health Monitoring System"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="aesthetic-input"
              style={{ width: '100%', height: '42px', minHeight: '42px', paddingLeft: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Project Domain</label>
              <div className="input-wrapper">
                <Layers className="input-icon" size={15} />
                <select
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="aesthetic-input"
                  style={{ width: '100%', height: '42px', minHeight: '42px', paddingLeft: '2.5rem', paddingRight: '2.2rem' }}
                >
                  <option value="Artificial Intelligence & Machine Learning">AI & Machine Learning</option>
                  <option value="Internet of Things & Embedded Systems">IoT & Embedded Systems</option>
                  <option value="Cybersecurity & Blockchain">Cybersecurity & Blockchain</option>
                  <option value="Cloud Computing & DevOps">Cloud & DevOps</option>
                  <option value="Computer Vision & Deep Learning">Computer Vision</option>
                  <option value="Full-Stack Web & Mobile Engineering">Web & Mobile Apps</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Technologies & Frameworks</label>
              <div className="input-wrapper">
                <Code className="input-icon" size={15} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Python, PyTorch, React, Node.js"
                  value={formData.technologies}
                  onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                  className="aesthetic-input"
                  style={{ width: '100%', height: '42px', minHeight: '42px', paddingLeft: '2.5rem' }}
                />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Problem Statement *</label>
            <textarea
              rows="2"
              required
              placeholder="What core real-world engineering challenge or inefficiency does this project solve?"
              value={formData.problemStatement}
              onChange={(e) => setFormData({ ...formData, problemStatement: e.target.value })}
              className="aesthetic-input"
              style={{ padding: '0.6rem 0.85rem', resize: 'vertical' }}
            ></textarea>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Key Objectives *</label>
            <textarea
              rows="2"
              required
              placeholder="List main targets (e.g. 1. Build sensor mesh, 2. Train neural network, 3. Deploy web interface)"
              value={formData.objectives}
              onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
              className="aesthetic-input"
              style={{ padding: '0.6rem 0.85rem', resize: 'vertical' }}
            ></textarea>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Project Abstract / Overview *</label>
            <textarea
              rows="2"
              required
              placeholder="Comprehensive summary of methodology, system architecture, and expected deliverables..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="aesthetic-input"
              style={{ padding: '0.6rem 0.85rem', resize: 'vertical' }}
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
                  Analyze proposal uniqueness against registered projects in <strong>{user?.department?.name || user?.dept || 'CSE'} ({user?.batch || team?.batch || '2023-2027'})</strong>.
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
                      {similarityResult.recommendation || `No similar projects found in ${user?.department?.name || 'your department'} for batch ${user?.batch || team?.batch || '2023-2027'}. Your proposed idea is novel!`}
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
                      Similar existing project(s) found in <strong>{user?.department?.name || 'your department'} ({user?.batch || team?.batch || '2023-2027'})</strong>:
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
                  </div>
                )}
              </div>
            )}
          </div>

          {team && Array.isArray(team.members) && team.members.length > 0 ? (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Confirmed Project Team ({team.name || 'Team'})</label>
                <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>
                  <CheckCircle2 size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                  {team.members.filter(m => m.status === 'ACCEPTED').length} / {team.targetSize} Members Confirmed
                </span>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {team.members.filter(m => m.status === 'ACCEPTED').map((m, idx) => {
                  const student = m.student || {};
                  const isLead = m.role === 'LEADER' || (team.leader?._id || team.leader) === (student._id || student);
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.825rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={14} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: 600 }}>{student.name || user?.name || 'Student'}</span>
                        {student.regNo && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({student.regNo})</span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '12px',
                        background: isLead ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: isLead ? '#818CF8' : '#10B981',
                        border: `1px solid ${isLead ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                      }}>
                        {isLead ? 'Team Leader' : 'Confirmed Member'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Team Members (Comma Separated)</label>
              <div className="input-wrapper">
                <Users className="input-icon" size={15} />
                <input
                  type="text"
                  placeholder="e.g. Student 1, Student 2"
                  value={formData.teamMembers}
                  onChange={(e) => setFormData({ ...formData, teamMembers: e.target.value })}
                  className="aesthetic-input"
                  style={{ width: '100%', height: '42px', minHeight: '42px', paddingLeft: '2.5rem' }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="btn-aesthetic btn-glass-secondary" 
              onClick={() => handleSubmit('draft')}
              style={{ padding: '0.65rem 1.1rem' }}
            >
              <Save size={15} />
              <span>Save as Draft</span>
            </button>

            <button 
              type="submit" 
              className="btn-aesthetic btn-primary-glow"
              style={{ padding: '0.65rem 1.25rem' }}
            >
              <Send size={15} />
              <span>Submit Proposal for Faculty Review</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;
