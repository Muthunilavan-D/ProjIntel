import React, { useState } from 'react';
import { 
  FolderGit2, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Plus, 
  Search, 
  Sparkles, 
  Activity, 
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  CheckCircle2,
  FileCheck
} from 'lucide-react';

const Dashboard = ({ projects, healthStatus, statusMessage, onOpenNewProjectModal }) => {
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter((p) => {
    const matchesFilter = filter === 'All' || p.status.toLowerCase().replace(' ', '-') === filter.toLowerCase().replace(' ', '-');
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.guide.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="dashboard-container">
      {/* Top Banner Control Bar */}
      <div className="dashboard-header-banner">
        <div className="dashboard-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1>Academic Workspace</h1>
            <div className="backend-status-pill">
              <span className={`status-dot ${healthStatus}`}></span>
              <span>{healthStatus === 'success' ? 'Backend Live' : healthStatus === 'loading' ? 'Connecting...' : 'Offline'}</span>
            </div>
          </div>
          <p>Track, manage, and evaluate academic projects in real time.</p>
        </div>

        <button className="btn-aesthetic btn-primary-glow btn-lg" onClick={onOpenNewProjectModal}>
          <Plus size={18} />
          <span>New Proposal</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box metric-icon-indigo">
            <FolderGit2 size={24} />
          </div>
          <div className="metric-info">
            <h3>Total Projects</h3>
            <div className="metric-value">{projects.length}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-icon-amber">
            <Clock size={24} />
          </div>
          <div className="metric-info">
            <h3>Under Guide Review</h3>
            <div className="metric-value">
              {projects.filter(p => p.status === 'Under Review').length}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-icon-emerald">
            <TrendingUp size={24} />
          </div>
          <div className="metric-info">
            <h3>Avg. Completion</h3>
            <div className="metric-value">
              {Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / (projects.length || 1))}%
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box metric-icon-cyan">
            <Activity size={24} />
          </div>
          <div className="metric-info">
            <h3>System Status</h3>
            <div className="metric-value" style={{ fontSize: '1.2rem', color: 'var(--success)' }}>
              {healthStatus === 'success' ? 'Operational' : 'Checking'}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="controls-bar">
        <div className="filter-tabs">
          {['All', 'In Progress', 'Under Review', 'Completed'].map((tab) => (
            <button
              key={tab}
              className={`filter-btn ${filter === tab ? 'active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search projects, domains, guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="aesthetic-input"
          />
        </div>
      </div>

      {/* Projects Cards Grid */}
      <div className="projects-grid">
        {filteredProjects.map((project) => (
          <div key={project.id} className="project-card">
            <div>
              <div className="project-header">
                <span className="project-domain-badge">{project.domain}</span>
                <span className={`project-status-badge status-${project.status.toLowerCase().replace(' ', '-')}`}>
                  {project.status}
                </span>
              </div>

              <h3 className="project-title">{project.title}</h3>
              <p className="project-abstract">{project.abstract}</p>
            </div>

            <div>
              {/* Progress Bar */}
              <div className="progress-section">
                <div className="progress-info">
                  <span>Development Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="progress-track">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="project-footer">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Guide
                  </span>
                  <span className="guide-name">{project.guide}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="team-members-avatars">
                    {(project.members || ['K', 'T', 'S']).map((m, idx) => (
                      <div key={idx} className="avatar-circle">
                        {m}
                      </div>
                    ))}
                  </div>

                  <button className="btn-aesthetic btn-glass-secondary btn-sm" title="View details">
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)', marginTop: '1rem' }}>
          <FolderGit2 size={48} style={{ color: 'var(--text-dim)', marginBottom: '1rem' }} />
          <h3>No Projects Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Try adjusting your search query or filter tab.
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
