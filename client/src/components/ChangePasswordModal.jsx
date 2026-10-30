import React, { useState } from 'react';
import ProjIntelSpinner from './ProjIntelSpinner';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Mail,
  ShieldCheck,
  Send,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { changePassword, requestEmailChange, requestAdminEmailChange, verifyEmailToken, saveToken, getMe } from '../services/authService';

const ChangePasswordModal = ({ isOpen, onClose, user, onEmailChangeRequested }) => {
  if (!isOpen) return null;

  const isAdmin = user?.role === 'Admin' || user?.role === 'ADMIN';
  const isFaculty = user?.role === 'Faculty' || user?.role === 'FACULTY' || user?.role === 'Guide';
  const canManageEmail = isAdmin || isFaculty;
  const roleTitle = isAdmin ? 'Administrator' : 'Faculty';

  const [activeTab, setActiveTab] = useState('password'); // 'password' | 'email'

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Email Change state (Admin only)
  const [currentAdminEmail, setCurrentAdminEmail] = useState(user?.email || '');
  const [newEmail, setNewEmail] = useState('');
  const [emailAuthPassword, setEmailAuthPassword] = useState('');
  const [showEmailAuthPw, setShowEmailAuthPw] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [pendingVerificationInfo, setPendingVerificationInfo] = useState(null);
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [verifyingOtpLoading, setVerifyingOtpLoading] = useState(false);

  // Always sync latest administrative email from MongoDB on modal open
  React.useEffect(() => {
    if (isOpen) {
      getMe().then(res => {
        if (res && res.success && res.user && res.user.email) {
          setCurrentAdminEmail(res.user.email);
          if (onEmailChangeRequested) {
            onEmailChangeRequested({ verified: true, user: res.user });
          }
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation password do not match.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res && res.success) {
        setPwSuccess('Your password has been changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setPwError(res?.error || 'Failed to update password.');
      }
    } catch (err) {
      setPwError(err?.message || 'Failed to update password. Please check your current password.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleEmailChangeSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setPendingVerificationInfo(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmail || !emailRegex.test(newEmail.trim())) {
      setEmailError('Please provide a valid new email address.');
      return;
    }

    if (!emailAuthPassword) {
      setEmailError('Please enter your current administrator password to authorize this email change.');
      return;
    }

    const activeCurrent = (currentAdminEmail || user?.email || '').trim().toLowerCase();
    if (newEmail.trim().toLowerCase() === activeCurrent) {
      setEmailError(`Your administrator email is already registered and verified as ${activeCurrent}.`);
      return;
    }

    setEmailLoading(true);
    try {
      const res = await requestEmailChange(newEmail.trim().toLowerCase(), emailAuthPassword);
      if (res && res.success) {
        setEmailSuccess(res.message || 'Verification code and link dispatched successfully!');
        setPendingVerificationInfo({
          pendingEmail: res.pendingEmail || newEmail.trim().toLowerCase(),
          deliveredLive: res.deliveredLive,
          devVerifyLink: res.devVerifyLink,
          token: res.verificationToken
        });
        setEmailAuthPassword('');
        if (onEmailChangeRequested) {
          onEmailChangeRequested(res.pendingEmail);
        }
      } else {
        if (res && res.currentEmail) {
          setCurrentAdminEmail(res.currentEmail);
        }
        setEmailError(res?.error || 'Failed to request email change.');
      }
    } catch (err) {
      if (err?.currentEmail) {
        setCurrentAdminEmail(err.currentEmail);
      }
      setEmailError(err?.message || 'Failed to initiate email change. Please check your password.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleConfirmEmailWithOtp = async (e) => {
    if (e) e.preventDefault();
    const codeToVerify = (emailOtpInput || '').trim();
    if (codeToVerify.length !== 6) {
      setEmailError('Please enter the 6-digit verification code.');
      return;
    }
    setVerifyingOtpLoading(true);
    setEmailError('');
    setEmailSuccess('');
    try {
      const targetEmail = pendingVerificationInfo?.pendingEmail || newEmail.trim().toLowerCase();
      const res = await verifyEmailToken({
        otp: codeToVerify,
        email: targetEmail
      });
      if (res && res.success) {
        setEmailSuccess(res.message || `${roleTitle} email successfully updated!`);
        if (res.token) saveToken(res.token);
        if (res.user) {
          setCurrentAdminEmail(res.user.email);
          if (user) user.email = res.user.email;
        }
        setPendingVerificationInfo(null);
        setNewEmail('');
        setEmailAuthPassword('');
        setEmailOtpInput('');
        if (onEmailChangeRequested) {
          onEmailChangeRequested({ verified: true, user: res.user });
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setEmailError(res?.error || 'Invalid or expired 6-digit verification code.');
      }
    } catch (err) {
      setEmailError(err?.message || 'Failed to verify code. Please try again.');
    } finally {
      setVerifyingOtpLoading(false);
    }
  };

  return (
    <div className="ai-modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div 
        className="ai-modal-box" 
        style={{ maxWidth: '480px', width: '92%' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ai-modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', margin: 0 }}>
              <ShieldCheck size={20} style={{ color: 'var(--primary)' }} />
              Account Security Governance
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', margin: 0 }}>
              Manage password credentials and institutional email address
            </p>
          </div>
          <button 
            className="btn-ghost-icon" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher (For Admin & Faculty) */}
        {canManageEmail && (
          <div style={{ display: 'flex', background: 'var(--bg-glass)', borderBottom: '1px solid var(--border-color)', padding: '0.35rem 0.65rem', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`nav-item-link ${activeTab === 'password' ? 'active' : ''}`}
              style={{ flex: 1, height: '34px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderRadius: '8px' }}
            >
              <KeyRound size={14} />
              <span>Change Password</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`nav-item-link ${activeTab === 'email' ? 'active' : ''}`}
              style={{ flex: 1, height: '34px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderRadius: '8px' }}
            >
              <Mail size={14} />
              <span>{isAdmin ? 'Admin Email' : 'Faculty Email'}</span>
            </button>
          </div>
        )}

        {/* TAB 1: CHANGE PASSWORD */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} style={{ padding: '1.25rem 1.5rem' }}>
            {pwError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: '#EF4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: '#10B981', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{pwSuccess}</span>
              </div>
            )}

            {/* Current Password */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                Current Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="aesthetic-input"
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="aesthetic-input"
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                Confirm New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="aesthetic-input"
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              ℹ️ Choose a strong password containing letters, numbers, and symbols for maximum security.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button 
                type="button"
                className="btn-aesthetic btn-glass-secondary btn-sm"
                onClick={onClose}
                disabled={pwLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-aesthetic btn-primary-glow btn-sm"
                disabled={pwLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {pwLoading ? (
                  <ProjIntelSpinner size="xs" inline label="Updating..." />
                ) : (
                  <>
                    <Lock size={15} />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: EMAIL GOVERNANCE (Admin & Faculty) */}
        {activeTab === 'email' && canManageEmail && (
          <div style={{ padding: '1.25rem 1.5rem' }}>
            {emailError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: '#EF4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{emailError}</span>
              </div>
            )}

            {emailSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: '#10B981', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{emailSuccess}</span>
              </div>
            )}

            {/* STAGE 1: BEFORE MAIL TRIGGERED */}
            {!pendingVerificationInfo ? (
              <form onSubmit={handleEmailChangeSubmit}>
                {/* Current Active Email Badge */}
                <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Current {roleTitle} Email
                    </span>
                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: '#DCFCE7', color: '#15803D', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Active & Verified
                    </span>
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                    <Mail size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentAdminEmail || user?.email || 'muthunilavand555@gmail.com'}>
                      {currentAdminEmail || user?.email || 'muthunilavand555@gmail.com'}
                    </span>
                  </div>
                </div>

                {/* New Email Address */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                    New {roleTitle} Email *
                  </label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={16} />
                    <input
                      type="email"
                      required
                      placeholder={`e.g. new.${roleTitle.toLowerCase()}@gmail.com`}
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="aesthetic-input"
                    />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                    A verification link and 6-digit OTP code will be dispatched to this new address.
                  </span>
                </div>

                {/* Current Password for authorization */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                    Confirm Current Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showEmailAuthPw ? 'text' : 'password'}
                      required
                      placeholder="Enter current password to authorize change"
                      value={emailAuthPassword}
                      onChange={(e) => setEmailAuthPassword(e.target.value)}
                      className="aesthetic-input"
                      style={{ width: '100%', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmailAuthPw(!showEmailAuthPw)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {showEmailAuthPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button 
                    type="button"
                    className="btn-aesthetic btn-glass-secondary btn-sm"
                    onClick={onClose}
                    disabled={emailLoading}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn-aesthetic btn-primary-glow btn-sm"
                    disabled={emailLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    {emailLoading ? (
                      <ProjIntelSpinner size="xs" inline label="Dispatching..." />
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Send Verification Link</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* STAGE 2: ONCE MAIL IS TRIGGERED — ONLY OTP FIELD AND CONFIRM EMAIL */
              <form onSubmit={handleConfirmEmailWithOtp}>
                <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Verification Code Sent To
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Mail size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pendingVerificationInfo.pendingEmail}
                    </span>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.45rem' }}>
                    Enter 6-Digit Code (OTP) *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    placeholder="e.g. 842866"
                    value={emailOtpInput}
                    onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="aesthetic-input"
                    style={{ letterSpacing: '6px', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.35rem', textAlign: 'center', width: '100%', padding: '0.75rem' }}
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.45rem', display: 'block', lineHeight: 1.45 }}>
                    📲 <em>Checked email on your phone?</em> Simply enter the 6-digit code received in your inbox. No password is required.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button 
                    type="button"
                    className="btn-aesthetic btn-glass-secondary btn-sm"
                    onClick={() => {
                      setPendingVerificationInfo(null);
                      setEmailOtpInput('');
                      setEmailError('');
                      setEmailSuccess('');
                    }}
                    disabled={verifyingOtpLoading}
                  >
                    ← Change Email
                  </button>

                  <button
                    type="submit"
                    className="btn-aesthetic btn-primary-glow btn-sm"
                    disabled={emailOtpInput.trim().length !== 6 || verifyingOtpLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.25rem' }}
                  >
                    {verifyingOtpLoading ? (
                      <ProjIntelSpinner size="xs" inline label="Verifying..." />
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Confirm Email</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordModal;
