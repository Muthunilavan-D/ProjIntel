import React, { useId } from 'react';

/**
 * ProjIntelSpinner - Custom themed orbital throbber/spinner
 * Designed to match the ProjIntel 3D orbital rings & neon glow branding.
 *
 * Props:
 * - size: 'xs' (15px) | 'sm' (18px) | 'md' (28px) | 'lg' (44px) | 'xl' (64px) | number
 * - label: optional text string displayed below or beside
 * - inline: boolean (for placement inside buttons or text lines)
 * - color: optional custom accent color
 */
const ProjIntelSpinner = ({ 
  size = 'md', 
  label = null, 
  inline = false, 
  color = null,
  className = '' 
}) => {
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const grad1Id = `orbitGrad1_${uniqueId}`;
  const grad2Id = `orbitGrad2_${uniqueId}`;
  const coreGlowId = `coreGlow_${uniqueId}`;

  const sizeMap = {
    xs: 15,
    sm: 18,
    md: 28,
    lg: 44,
    xl: 64
  };

  const px = typeof size === 'number' ? size : sizeMap[size] || 28;

  const spinnerSvg = (
    <div 
      className={`projintel-spinner-wrapper ${className}`}
      style={{
        width: px,
        height: px,
        display: inline ? 'inline-flex' : 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0
      }}
      aria-label="Loading"
      role="status"
    >
      <svg 
        width={px} 
        height={px} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="projintel-spinner-svg"
      >
        <defs>
          <linearGradient id={grad1Id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={grad2Id} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
          </linearGradient>
          <radialGradient id={coreGlowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer ambient glow halo */}
        <circle cx="24" cy="24" r="14" fill={`url(#${coreGlowId})`} className="projintel-pulse-core" />

        {/* Outer Orbital Ring (Forward Tilt) */}
        <ellipse 
          cx="24" 
          cy="24" 
          rx="21" 
          ry="9" 
          stroke={`url(#${grad1Id})`} 
          strokeWidth="2.5" 
          strokeLinecap="round"
          strokeDasharray="95 35"
          transform="rotate(-28 24 24)"
          className="projintel-orbit-outer"
        />

        {/* Inner Counter-Orbital Ring (Reverse Tilt) */}
        <ellipse 
          cx="24" 
          cy="24" 
          rx="17" 
          ry="7.5" 
          stroke={`url(#${grad2Id})`} 
          strokeWidth="2" 
          strokeLinecap="round"
          strokeDasharray="65 30"
          transform="rotate(38 24 24)"
          className="projintel-orbit-inner"
        />

        {/* Orbital Satellite Beads */}
        <circle 
          cx="42" 
          cy="24" 
          r="2.2" 
          fill="#38bdf8" 
          className="projintel-satellite"
          style={{ filter: 'drop-shadow(0 0 4px #38bdf8)' }}
        />
        <circle 
          cx="6" 
          cy="24" 
          r="1.8" 
          fill="#c084fc" 
          className="projintel-satellite-rev"
          style={{ filter: 'drop-shadow(0 0 4px #c084fc)' }}
        />

        {/* Center Tech Core Gem */}
        <polygon 
          points="24,19 28.5,24 24,29 19.5,24" 
          fill={`url(#${grad1Id})`} 
          className="projintel-core-diamond"
          style={{ filter: 'drop-shadow(0 0 5px rgba(99, 102, 241, 0.7))' }}
        />
      </svg>
    </div>
  );

  if (inline) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', verticalAlign: 'middle' }}>
        {spinnerSvg}
        {label && <span style={{ fontSize: '0.85em', opacity: 0.9 }}>{label}</span>}
      </span>
    );
  }

  if (label) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.85rem', padding: '1.5rem 0' }}>
        {spinnerSvg}
        <span style={{ 
          color: 'var(--text-muted)', 
          fontSize: px > 32 ? '0.95rem' : '0.82rem', 
          fontWeight: 500,
          letterSpacing: '0.02em',
          background: 'linear-gradient(90deg, var(--text-muted) 0%, var(--primary-light, #818cf8) 50%, var(--text-muted) 100%)',
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          animation: 'shimmer 2.5s linear infinite'
        }}>
          {label}
        </span>
      </div>
    );
  }

  return spinnerSvg;
};

export default ProjIntelSpinner;
