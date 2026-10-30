import React from 'react';
import { 
  Sparkles, 
  GraduationCap, 
  UserCheck, 
  Shield, 
  ArrowRight, 
  CheckCircle2
} from 'lucide-react';

const LandingPage = ({ onOpenLogin }) => {
  return (
    <div className="landing-container">
      {/* Clean Hero Section */}
      <div className="hero-banner">
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
          <img 
            src="/logo.png" 
            alt="ProjIntel Official Logo" 
            style={{ 
              width: '88px', 
              height: '88px', 
              objectFit: 'contain',
              filter: 'drop-shadow(0 10px 25px rgba(99, 102, 241, 0.45))'
            }} 
          />
        </div>

        <div className="hero-pill-badge">
          <Sparkles size={15} />
          <span>Academic Project Tracking & Management System</span>
        </div>

        <h1 className="hero-heading">
          PROJINTEL
        </h1>

        <p className="hero-subheading">
          Streamlined Academic Project Lifecycle Management
        </p>

        <p className="hero-description">
          A centralized, role-based platform connecting students, faculty guides, and academic administrators for proposal approvals, milestone tracking, task management, weekly updates, and evaluation.
        </p>

        <div className="hero-cta-group">
          <button 
            type="button"
            className="btn-aesthetic btn-primary-glow btn-lg" 
            onClick={() => onOpenLogin && onOpenLogin()}
          >
            <span>Portal Sign In</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* Role-Based Overview Cards */}
      <div style={{ marginTop: '2.5rem' }}>
        <div className="role-cards-section-title">
          <h2>Institutional Portals & Roles</h2>
          <p>Comprehensive role-based workspaces tailored for students, faculty guides, and academic administrators.</p>
        </div>

        <div className="role-preview-grid">
          {/* Student Card */}
          <div 
            className="role-preview-card"
            onClick={() => onOpenLogin && onOpenLogin('Student')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpenLogin && onOpenLogin('Student'); }}
          >
            <div>
              <div className="role-card-badge" style={{ background: 'var(--gradient-primary)' }}>
                <GraduationCap size={22} />
              </div>
              <h3 className="role-card-title">Student Workspace</h3>
              <p className="role-card-desc">
                Submit project proposals, manage milestone tasks, submit weekly progress reports, and upload documentation.
              </p>
              <ul className="role-features-list">
                <li><CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> Proposal submission & revisions</li>
                <li><CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> 6 Standard milestone trackers & tasks</li>
                <li><CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> Weekly progress submissions & feedback</li>
              </ul>
            </div>
            <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>Enter Student Portal</span>
              <div className="btn-aesthetic btn-primary-glow btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                <ArrowRight size={14} />
              </div>
            </div>
          </div>

          {/* Faculty Guide Card */}
          <div 
            className="role-preview-card"
            onClick={() => onOpenLogin && onOpenLogin('Faculty')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpenLogin && onOpenLogin('Faculty'); }}
          >
            <div>
              <div className="role-card-badge" style={{ background: 'var(--gradient-accent)' }}>
                <UserCheck size={22} />
              </div>
              <h3 className="role-card-title">Faculty Guide Portal</h3>
              <p className="role-card-desc">
                Review submitted proposals, approve or request revisions, evaluate weekly progress updates, and grade deliverables.
              </p>
              <ul className="role-features-list">
                <li><CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> Proposal review (Approve/Revise/Reject)</li>
                <li><CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> Weekly update grading & feedback</li>
                <li><CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> Document inspection & guidance feed</li>
              </ul>
            </div>
            <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700 }}>Enter Faculty Portal</span>
              <div className="btn-aesthetic btn-accent btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                <ArrowRight size={14} />
              </div>
            </div>
          </div>

          {/* Admin Card */}
          <div 
            className="role-preview-card"
            onClick={() => onOpenLogin && onOpenLogin('Admin')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpenLogin && onOpenLogin('Admin'); }}
          >
            <div>
              <div className="role-card-badge" style={{ background: 'var(--gradient-emerald)' }}>
                <Shield size={22} />
              </div>
              <h3 className="role-card-title">Academic Admin Cell</h3>
              <p className="role-card-desc">
                Oversee department batches, assign faculty guides to projects, monitor progress statistics, and export marks.
              </p>
              <ul className="role-features-list">
                <li><CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> Faculty guide assignment to projects</li>
                <li><CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> Department-wide KPI statistics</li>
                <li><CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> Student & faculty project rosters</li>
              </ul>
            </div>
            <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--emerald)', fontWeight: 700 }}>Enter Admin Cell</span>
              <div className="btn-aesthetic btn-emerald btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                <ArrowRight size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
