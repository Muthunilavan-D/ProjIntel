import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  ShieldCheck, 
  Shield,
  ArrowRight, 
  ArrowLeft,
  Eye, 
  EyeOff, 
  UserCheck, 
  GraduationCap,
  Hash,
  Sparkles,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCw
} from 'lucide-react';
import { login, saveToken, forgotPassword, verifyResetOtp, resetPassword } from '../services/authService';
import ProjIntelSpinner from './ProjIntelSpinner';

const LoginModal = ({ 
  isOpen, 
  onClose, 
  onLoginSuccess,
  initialRole = null,
  initialResetParams = null
}) => {
  const [loginStep, setLoginStep] = useState('select_role'); // 'select_role' | 'login_form' | 'forgot_password' | 'verify_otp_reset'
  const [role, setRole] = useState('Student'); // 'Student' | 'Faculty' | 'Admin'
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Login form state: loginIdentifier is Reg No for Students, Email for Staff
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);

  // Forgot Password / Password Reset State
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const [showConfirmResetPw, setShowConfirmResetPw] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [devOtpPreview, setDevOtpPreview] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (initialResetParams && initialResetParams.token) {
        setLoginStep('verify_otp_reset');
        setResetToken(initialResetParams.token);
        setForgotEmail(initialResetParams.email || 'muthunilavand555@gmail.com');
      } else if (initialRole) {
        handleRoleSelection(initialRole);
      } else {
        setLoginStep('select_role');
        setLoginError(null);
        setLoginIdentifier('');
        setLoginPassword('');
      }
      setForgotError('');
      setForgotSuccess('');
      setResetOtp('');
      setNewResetPassword('');
      setConfirmResetPassword('');
      setDevOtpPreview(null);
    }
  }, [isOpen, initialResetParams, initialRole]);

  if (!isOpen) return null;

  const fallbackDemoLogin = (roleName, identifier) => {
    const demoUser = roleName === 'Admin' ? {
      _id: 'user_admin_1',
      id: 'user_admin_1',
      name: 'Academic Administrator',
      email: identifier || 'muthunilavand555@gmail.com',
      role: 'Admin',
      model: 'Admin'
    } : roleName === 'Faculty' ? {
      _id: 'user_faculty_1',
      id: 'user_faculty_1',
      name: 'Dr. S. Kavitha',
      email: identifier || 'faculty2@vcet.edu.in',
      facultyId: 'FACCSE05',
      role: 'Faculty',
      model: 'Faculty'
    } : {
      _id: '6ada46bbf4076fdbbd7f874c',
      id: '6ada46bbf4076fdbbd7f874c',
      name: 'Muthunilavan D',
      email: 'muthunilavand@gmail.com',
      regNo: identifier || '913123104100',
      role: 'Student',
      model: 'Student',
      project: '6add84d800b4104a004397e3'
    };
    saveToken('demo_jwt_token_' + (roleName || 'student').toLowerCase());
    onLoginSuccess(demoUser);
    onClose();
  };

  const handleInstantDemoLogin = (targetRole) => {
    setIsLoading(true);
    const roleName = targetRole || role;
    const defaultIdentifier = roleName === 'Admin' 
      ? 'muthunilavand555@gmail.com' 
      : roleName === 'Faculty' 
        ? 'faculty2@vcet.edu.in' 
        : '913123104100';
    
    login(defaultIdentifier, 'admin123', roleName)
      .then(res => {
        if (res && res.success && res.token) {
          saveToken(res.token);
          const userData = {
            ...res.user,
            role: res.user.role === 'STUDENT' ? 'Student' : res.user.role === 'FACULTY' ? 'Faculty' : 'Admin',
          };
          onLoginSuccess(userData);
          onClose();
        } else {
          fallbackDemoLogin(roleName, defaultIdentifier);
        }
      })
      .catch(() => fallbackDemoLogin(roleName, defaultIdentifier))
      .finally(() => setIsLoading(false));
  };

  const handleRoleSelection = (selectedRole) => {
    setRole(selectedRole);
    setLoginError(null);
    if (selectedRole === 'Admin') {
      setLoginIdentifier('muthunilavand555@gmail.com');
      setLoginPassword('');
    } else if (selectedRole === 'Faculty') {
      setLoginIdentifier('faculty2@vcet.edu.in');
      setLoginPassword('');
    } else {
      setLoginIdentifier('');
      setLoginPassword('');
    }
    setLoginStep('login_form');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);
    try {
      const idToUse = (loginIdentifier || '').trim();
      const passToUse = loginPassword || '';
      
      if (!idToUse || !passToUse) {
        setLoginError(role === 'Student' 
          ? 'Please enter your Register Number and password.' 
          : 'Please enter your institutional email and password.');
        setIsLoading(false);
        return;
      }

      const res = await login(idToUse, passToUse, role);
      if (res && res.success && res.token) {
        saveToken(res.token);
        const userData = {
          ...res.user,
          role: res.user.role === 'STUDENT' ? 'Student' : res.user.role === 'FACULTY' ? 'Faculty' : 'Admin',
        };
        onLoginSuccess(userData);
        onClose();
      } else {
        setLoginError(res?.error || 'Authentication rejected. Verify credentials.');
      }
    } catch (err) {
      setLoginError(err?.message || 'Authentication error. Please check your network and credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Forgot Password OTP & Link
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setDevOtpPreview(null);

    const emailToUse = (forgotEmail || '').trim().toLowerCase();
    if (!emailToUse) {
      setForgotError('Please enter your administrative email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await forgotPassword(emailToUse);
      if (res && res.success) {
        setForgotSuccess(res.message || 'Verification code and reset link dispatched to your email.');
        const otpCode = res.devOtp || res.otp;
        if (otpCode) {
          setDevOtpPreview(otpCode);
          setResetOtp(otpCode); // Auto-fill if not delivered to inbox
        }
        if (res.resetToken) {
          setResetToken(res.resetToken);
        }
        setLoginStep('verify_otp_reset');
      } else {
        setForgotError(res?.error || 'Failed to dispatch reset code.');
      }
    } catch (err) {
      setForgotError(err?.message || 'Error connecting to security service. Please verify your email.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Complete Password Reset
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!resetOtp && !resetToken) {
      setForgotError('Please enter the 6-digit OTP code received on your email.');
      return;
    }

    if (!newResetPassword || newResetPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      setForgotError('New password and confirmation password do not match.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await resetPassword({
        email: forgotEmail.trim().toLowerCase(),
        otp: resetOtp.trim(),
        resetToken: resetToken.trim(),
        newPassword: newResetPassword.trim()
      });

      if (res && res.success) {
        setForgotSuccess('Password updated successfully! Redirecting to sign in...');
        setLoginPassword(newResetPassword.trim());
        setLoginIdentifier(forgotEmail.trim().toLowerCase());
        setTimeout(() => {
          setLoginStep('login_form');
          setForgotSuccess('');
        }, 1500);
      } else {
        setForgotError(res?.error || 'Failed to reset password. Please check your OTP.');
      }
    } catch (err) {
      setForgotError(err?.message || 'Failed to update password. Code may have expired.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-modal-overlay modal-backdrop-overlay" onClick={onClose}>
      <div 
        className="login-modal-box aesthetic-modal-card aesthetic-card" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: loginStep === 'select_role' ? '680px' : '440px', width: '92%' }}
      >
        {/* Close Button */}
        <button 
          className="login-modal-close-btn modal-close-btn" 
          onClick={onClose} 
          title="Close modal"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: SIGN IN - STEP 1: ROLE SELECTION SCREEN              */}
        {/* ------------------------------------------------------------- */}
        {loginStep === 'select_role' && (
          <div className="role-selection-wrapper">
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <div style={{ margin: '0 auto 0.6rem', display: 'flex', justifyContent: 'center' }}>
                <img 
                  src="/logo.png" 
                  alt="ProjIntel" 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    objectFit: 'contain', 
                    filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.45))' 
                  }} 
                />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Sign In</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Select your institutional role to continue
              </p>
            </div>

            {/* 3 Role Selection Cards */}
            <div className="role-select-grid">
              {/* Role 1: Student */}
              <div 
                className="role-select-card role-select-card-student"
                onClick={() => handleRoleSelection('Student')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRoleSelection('Student'); }}
              >
                <div>
                  <div className="role-select-badge" style={{ background: 'var(--gradient-primary)' }}>
                    <GraduationCap size={22} />
                  </div>
                  <h3 className="role-select-title">Student</h3>
                  <p className="role-select-desc">
                    Access project workspace, tasks, milestones, submissions and progress using your Register Number.
                  </p>
                </div>
                <button 
                  type="button" 
                  className="btn-aesthetic btn-primary-glow role-select-action-btn"
                  onClick={(e) => { e.stopPropagation(); handleRoleSelection('Student'); }}
                >
                  <span>Continue as Student</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              {/* Role 2: Faculty */}
              <div 
                className="role-select-card role-select-card-faculty"
                onClick={() => handleRoleSelection('Faculty')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRoleSelection('Faculty'); }}
              >
                <div>
                  <div className="role-select-badge" style={{ background: 'var(--gradient-accent)' }}>
                    <UserCheck size={22} />
                  </div>
                  <h3 className="role-select-title">Faculty</h3>
                  <p className="role-select-desc">
                    Review projects, monitor progress, provide feedback and manage supervised projects.
                  </p>
                </div>
                <button 
                  type="button" 
                  className="btn-aesthetic btn-accent role-select-action-btn"
                  onClick={(e) => { e.stopPropagation(); handleRoleSelection('Faculty'); }}
                >
                  <span>Continue as Faculty</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              {/* Role 3: Admin */}
              <div 
                className="role-select-card role-select-card-admin"
                onClick={() => handleRoleSelection('Admin')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRoleSelection('Admin'); }}
              >
                <div>
                  <div className="role-select-badge" style={{ background: 'var(--gradient-emerald)' }}>
                    <Shield size={22} />
                  </div>
                  <h3 className="role-select-title">Admin</h3>
                  <p className="role-select-desc">
                    Manage academic projects, users, assignments, batches and institutional monitoring.
                  </p>
                </div>
                <button 
                  type="button" 
                  className="btn-aesthetic btn-emerald role-select-action-btn"
                  onClick={(e) => { e.stopPropagation(); handleRoleSelection('Admin'); }}
                >
                  <span>Continue as Admin</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: SIGN IN - STEP 2: ROLE LOGIN FORM                    */}
        {/* ------------------------------------------------------------- */}
        {loginStep === 'login_form' && (
          <div>
            {/* Top Navigation: Back to Role Selection */}
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="role-back-nav-btn"
                onClick={() => setLoginStep('select_role')}
                title="Return to role selection"
              >
                <ArrowLeft size={14} />
                <span>Change Role</span>
              </button>
              <span className={`user-role-tag role-tag-${role.toLowerCase()}`}>
                {role} Portal
              </span>
            </div>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div 
                className="role-card-badge" 
                style={{ 
                  margin: '0 auto 0.5rem', 
                  width: 40, 
                  height: 40,
                  background: role === 'Student' ? 'var(--gradient-primary)' : role === 'Faculty' ? 'var(--gradient-accent)' : 'var(--gradient-emerald)'
                }}
              >
                {role === 'Student' ? <GraduationCap size={20} /> : role === 'Faculty' ? <UserCheck size={20} /> : <ShieldCheck size={20} />}
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                {role === 'Student' ? 'Student Workspace' : role === 'Faculty' ? 'Faculty Guide Portal' : 'Academic Admin Cell'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                {role === 'Student' 
                  ? 'Enter your student Register Number and password to sign in' 
                  : 'Enter your institutional email and password to sign in'}
              </p>
            </div>

            {/* Sign In Form */}
            <form onSubmit={handleLoginSubmit}>
              {loginError && (
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#EF4444', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  {loginError}
                </div>
              )}
              <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                <label className="form-label">
                  {role === 'Student' 
                    ? 'Register Number' 
                    : 'Institutional Email'}
                </label>
                <div className="input-wrapper">
                  {role === 'Student' ? <Hash className="input-icon" size={16} /> : <Mail className="input-icon" size={16} />}
                  <input
                    type={role === 'Student' ? 'text' : 'email'}
                    required
                    autoFocus
                    placeholder={
                      role === 'Student' 
                        ? 'e.g. 913123104112' 
                        : role === 'Faculty' 
                          ? 'faculty2@vcet.edu.in' 
                          : 'muthunilavand555@gmail.com'
                    }
                    value={loginIdentifier}
                    onChange={(e) => { setLoginIdentifier(e.target.value); setLoginError(null); }}
                    className="aesthetic-input"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.4rem' }}>
                <label className="form-label">Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); setLoginError(null); }}
                    className="aesthetic-input"
                  />
                  <span className="input-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </span>
                </div>
              </div>

              {/* Forgot Password Link (Special emphasis for Admin & staff) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(role === 'Admin' ? 'muthunilavand555@gmail.com' : (loginIdentifier || ''));
                    setForgotError('');
                    setForgotSuccess('');
                    setLoginStep('forgot_password');
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-aesthetic btn-primary-glow"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.875rem' }}
              >
                {isLoading ? <ProjIntelSpinner size="xs" inline label="Signing in..." /> : (
                  <>
                    <span>Sign In as {role}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 3: FORGOT PASSWORD REQUEST                               */}
        {/* ------------------------------------------------------------- */}
        {loginStep === 'forgot_password' && (
          <div>
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="role-back-nav-btn"
                onClick={() => setLoginStep('login_form')}
                title="Return to sign in form"
              >
                <ArrowLeft size={14} />
                <span>Back to Sign In</span>
              </button>
              <span className="user-role-tag role-tag-admin">
                {role || 'Security'} Cell
              </span>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div 
                className="role-card-badge" 
                style={{ 
                  margin: '0 auto 0.5rem', 
                  width: 44, 
                  height: 44,
                  background: 'var(--gradient-primary)'
                }}
              >
                <KeyRound size={22} />
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                Reset Account Password
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem', lineHeight: 1.4 }}>
                Enter your {role === 'Admin' ? 'administrative' : 'institutional'} email. We will send a 6-digit OTP verification code and a secure reset link.
              </p>
            </div>

            <form onSubmit={handleForgotPasswordSubmit}>
              {forgotError && (
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#EF4444', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{forgotError}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">{role === 'Admin' ? 'Administrator' : 'Faculty'} Email Address</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={16} />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder={role === 'Admin' ? 'e.g. muthunilavand555@gmail.com' : 'e.g. faculty@institution.edu'}
                    value={forgotEmail}
                    onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                    className="aesthetic-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="btn-aesthetic btn-primary-glow"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
              >
                {forgotLoading ? (
                  <ProjIntelSpinner size="xs" inline label="Dispatching Code..." />
                ) : (
                  <>
                    <Send size={15} />
                    <span>Send Verification Code & Link</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 4: VERIFY OTP & SET NEW PASSWORD                         */}
        {/* ------------------------------------------------------------- */}
        {loginStep === 'verify_otp_reset' && (
          <div>
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="role-back-nav-btn"
                onClick={() => setLoginStep('login_form')}
                title="Return to sign in form"
              >
                <ArrowLeft size={14} />
                <span>Cancel</span>
              </button>
              <span className="user-role-tag role-tag-admin">
                Verify Credentials
              </span>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div 
                className="role-card-badge" 
                style={{ 
                  margin: '0 auto 0.5rem', 
                  width: 44, 
                  height: 44,
                  background: 'var(--gradient-emerald)'
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                Set New Password
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                Enter the 6-digit code sent to <strong style={{ color: 'var(--text-main)' }}>{forgotEmail}</strong>
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit}>
              {forgotError && (
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#EF4444', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess && (
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', color: '#10B981', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              {/* Dev Notice if OTP was simulated */}
              {devOtpPreview && (
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px dashed #6366F1', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#A5B4FC' }}>
                  <span>Security Notice: 6-Digit Verification Code: <strong style={{ color: '#fff', fontSize: '0.9rem', letterSpacing: '2px' }}>{devOtpPreview}</strong></span>
                </div>
              )}

              {/* 6-Digit OTP Code */}
              <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                <label className="form-label">6-Digit Verification Code (OTP) *</label>
                <div className="input-wrapper">
                  <KeyRound className="input-icon" size={16} />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 548912"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    className="aesthetic-input"
                    style={{ letterSpacing: '4px', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', textAlign: 'center' }}
                  />
                </div>
              </div>

              {/* New Password */}
              <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                <label className="form-label">New Password *</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={16} />
                  <input
                    type={showResetPw ? 'text' : 'password'}
                    required
                    placeholder="Minimum 6 characters"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    className="aesthetic-input"
                  />
                  <span className="input-toggle-icon" onClick={() => setShowResetPw(!showResetPw)}>
                    {showResetPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </span>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Confirm New Password *</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={16} />
                  <input
                    type={showConfirmResetPw ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password"
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    className="aesthetic-input"
                  />
                  <span className="input-toggle-icon" onClick={() => setShowConfirmResetPw(!showConfirmResetPw)}>
                    {showConfirmResetPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="btn-aesthetic btn-primary-glow"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
              >
                {forgotLoading ? (
                  <ProjIntelSpinner size="xs" inline label="Updating Password..." />
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Reset Password & Sign In</span>
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleForgotPasswordSubmit}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <RefreshCw size={12} />
                  <span>Resend verification code</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
