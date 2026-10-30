import React from 'react';
import { FileText, Download, CheckCircle2, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';

const GuidelinesPage = () => {
  return (
    <div className="page-container">
      {/* Banner */}
      <div className="page-header-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="hero-pill-badge" style={{ margin: 0, padding: '0.2rem 0.65rem' }}>
              <FileText size={14} /> Academic Guidelines & Policy
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Academic Cell VCET</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            Project Regulations & Evaluation Rubrics
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Standard operating procedures for academic projects across all years of study.
          </p>
        </div>

        <button className="btn-aesthetic btn-primary-glow btn-sm">
          <Download size={16} />
          <span>Download Rulebook PDF</span>
        </button>
      </div>

      {/* Guidelines Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="guideline-card">
          <h3>1. Paper & Report Standard</h3>
          <p>
            All final-year projects must align with standard academic publication or institutional conference formats (double-column, 6-8 pages). A minimum 70% original contribution is mandatory.
          </p>
        </div>

        <div className="guideline-card">
          <h3>2. Plagiarism Policy</h3>
          <p>
            Project reports and documentation must pass Turnitin / Plagiarism analysis with less than <strong>15% similarity score</strong> excluding references.
          </p>
        </div>

        <div className="guideline-card">
          <h3>3. Phase Evaluation Breakdown</h3>
          <p>
            Evaluation is divided into 4 reviews: Zeroth Review (10%), First Review (20%), Second Review (30%), and Final Viva (40%).
          </p>
        </div>
      </div>

      {/* Downloadable Templates Section */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>
          Official Document Templates & Resources
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {[
            { title: 'Project Synopsis & Proposal Template', format: 'DOCX • 120 KB' },
            { title: 'System Requirement Spec (SRS)', format: 'PDF • 450 KB' },
            { title: 'Final Review Viva Slide Deck', format: 'PPTX • 2.1 MB' },
            { title: 'Guide Approval & Sign-Off Sheet', format: 'PDF • 95 KB' }
          ].map((t, idx) => (
            <div key={idx} style={{ padding: '1rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{t.format}</div>
              </div>
              <button className="btn-aesthetic btn-glass-secondary btn-sm" title="Download">
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuidelinesPage;
