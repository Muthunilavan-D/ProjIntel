import React from 'react';
import { Users, CheckCircle2, Clock, GitBranch, Plus, MessageSquare, ExternalLink } from 'lucide-react';

const TeamWorkspace = () => {
  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="hero-pill-badge" style={{ margin: 0, padding: '0.2rem 0.65rem' }}>
              <Users size={14} /> Team 01 Workspace
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>GitHub: projintel-client</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            Collaborative Agile Task Board
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Sprint 3: Implementing Floating Translucent Navbar & Auth Modals
          </p>
        </div>

        <button className="btn-aesthetic btn-primary-glow btn-sm">
          <Plus size={16} />
          <span>Add Task</span>
        </button>
      </div>

      {/* Kanban Board Grid */}
      <div className="kanban-grid">
        {/* To Do Column */}
        <div className="kanban-col">
          <div className="kanban-col-header">
            <span>To Do</span>
            <span style={{ fontSize: '0.8rem', background: 'var(--bg-glass)', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>2</span>
          </div>

          <div className="task-item-card">
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.25rem' }}>BACKEND</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Setup MongoDB Schema for Guide Reviews</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span>Assignee: Praveen</span>
              <span>Due Aug 24</span>
            </div>
          </div>

          <div className="task-item-card">
            <div style={{ fontSize: '0.75rem', color: '#06B6D4', fontWeight: 700, marginBottom: '0.25rem' }}>DOCS</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Draft Phase III Project Synopsis PDF</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span>Assignee: Sanjay</span>
              <span>Due Aug 25</span>
            </div>
          </div>
        </div>

        {/* In Progress Column */}
        <div className="kanban-col">
          <div className="kanban-col-header">
            <span style={{ color: '#F59E0B' }}>In Progress</span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>2</span>
          </div>

          <div className="task-item-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
            <div style={{ fontSize: '0.75rem', color: '#F59E0B', fontWeight: 700, marginBottom: '0.25rem' }}>FRONTEND</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Floating Translucent Header & Theme Switcher</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span>Assignee: Muthunilavan</span>
              <span>Active</span>
            </div>
          </div>

          <div className="task-item-card">
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.25rem' }}>TESTING</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Vite Build & Cross-Browser Verification</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span>Assignee: Muthunilavan</span>
              <span>Active</span>
            </div>
          </div>
        </div>

        {/* Completed Column */}
        <div className="kanban-col">
          <div className="kanban-col-header">
            <span style={{ color: 'var(--success)' }}>Completed</span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>3</span>
          </div>

          <div className="task-item-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700, marginBottom: '0.25rem' }}>CORE</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Express Backend Health Check API Route</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span>Verified ✓</span>
              <span>Aug 20</span>
            </div>
          </div>

          <div className="task-item-card">
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700, marginBottom: '0.25rem' }}>AUTH</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Aesthetic Glassmorphism Login Popup Modal</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span>Verified ✓</span>
              <span>Aug 20</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamWorkspace;
