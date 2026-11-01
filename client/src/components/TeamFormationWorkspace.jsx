import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  UserX,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  RefreshCw,
  Send,
  Sparkles,
  Layers,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Trash2,
  FolderPlus,
  Info,
  Lock,
  ShieldAlert,
  Building,
  Calendar
} from 'lucide-react';
import ProjIntelSpinner from './ProjIntelSpinner';
import {
  getMyTeam,
  getAvailableStudents,
  getPendingInvitations,
  createTeam,
  respondToInvitation,
  inviteTeamMember,
  cancelTeamInvite,
  disbandTeam
} from '../services/teamService';

const TeamFormationWorkspace = ({ user, onOpenNewProject, onTeamFormed, onRefreshUser }) => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [myTeam, setMyTeam] = useState(null);
  const [isLeader, setIsLeader] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Current student department and batch parameters
  const userDeptName = user?.department?.name || user?.dept || 'Your Department';
  const userDeptCode = user?.department?.code || '';
  const userBatch = (user?.batch || '2023-2027').trim();
  const userYear = Number(user?.yearOfStudy || user?.year || 4);

  // Filter available students to guarantee only same department and same batch are shown
  const filteredAvailableStudents = availableStudents.filter(stud => {
    // 1. Department match
    const studDeptId = String(stud.department?._id || stud.department?.id || stud.department || '');
    const myDeptId = String(user?.department?._id || user?.department?.id || user?.department || '');
    if (studDeptId && myDeptId && studDeptId !== myDeptId) return false;

    // 2. Batch match
    const studBatch = (stud.batch || '').trim();
    if (studBatch && userBatch && studBatch !== userBatch) return false;

    // 3. Fallback Year match
    const studYear = Number(stud.yearOfStudy || stud.year);
    if (!studBatch && !userBatch && studYear && userYear && studYear !== userYear) return false;

    return true;
  });

  // Creation wizard state
  const [targetSize, setTargetSize] = useState(2);
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]); // array of student objects
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Replacement invite state
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
  const [replacementSearch, setReplacementSearch] = useState('');
  const [replacementLoading, setReplacementLoading] = useState(false);

  // Leader Disband modal state (requires password verification)
  const [isDisbandModalOpen, setIsDisbandModalOpen] = useState(false);
  const [disbandPassword, setDisbandPassword] = useState('');
  const [disbandError, setDisbandError] = useState(null);
  const [isDisbanding, setIsDisbanding] = useState(false);

  // Determine if the current student is confirmed / active in myTeam
  const isSelfAccepted = Boolean(
    myTeam &&
    (isLeader ||
      (myTeam.members || []).some(m => {
        const sId = String(m.student?._id || m.student?.id || m.student || '');
        const uId = String(user?._id || user?.id || '');
        return sId && uId && sId === uId && m.status === 'ACCEPTED';
      }))
  );

  // Load all team-related data
  const loadTeamData = async (isManualSync = false) => {
    // Safety timer to prevent stuck spinner
    const timer = setTimeout(() => {
      clearTimeout(timer);
      setLoading(false);
      setSyncing(false);
    }, 8000);
    if (isManualSync) setSyncing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const studentId = user?._id || user?.id;
      const [teamRes, invitesRes, availRes] = await Promise.all([
        getMyTeam(studentId),
        getPendingInvitations(studentId),
        getAvailableStudents({ studentId, search: searchQuery, department: selectedDept })
      ]);

      if (teamRes.success) {
        setMyTeam(teamRes.data);
        setIsLeader(!!teamRes.isLeader);

      }

      if (invitesRes.success && Array.isArray(invitesRes.data)) {
        setPendingInvites(invitesRes.data);
      }

      if (availRes.success && Array.isArray(availRes.data)) {
        setAvailableStudents(availRes.data);
      }
    } catch (err) {
      console.error('Failed to load team workspace:', err);
      setErrorMessage(err.message || 'Could not load team data.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTeamData();
    }
  }, [user?._id, user?.id]);

  // Refresh available students when search or department changes
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!myTeam || myTeam.status === 'FORMING') {
        try {
          const studentId = user?._id || user?.id;
          const availRes = await getAvailableStudents({
            studentId,
            search: searchQuery,
            department: selectedDept
          });
          if (availRes.success && Array.isArray(availRes.data)) {
            setAvailableStudents(availRes.data);
          }
        } catch (e) {
          console.warn('Student search query error:', e);
        }
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, selectedDept]);

  // Handle Create Team
  const handleCreateTeamSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (targetSize > 1 && selectedMembers.length !== (targetSize - 1)) {
      setErrorMessage(`Please select exactly ${targetSize - 1} peer(s) to invite for a team size of ${targetSize}.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        studentId: user?._id || user?.id,
        targetSize,
        name: teamName.trim() || `${user?.name ? user.name.split(' ')[0] : 'Student'}'s Team`,
        invitedStudentIds: selectedMembers.map(m => m._id)
      };

      const res = await createTeam(payload);
      if (res.success && res.data) {
        setMyTeam(res.data);
        setIsLeader(true);
        setSelectedMembers([]);
        if (targetSize === 1) {
          setSuccessMessage('Team created.');
        } else {
          setSuccessMessage('Team created.');
        }
        await loadTeamData(true);
        if (onRefreshUser) onRefreshUser();
      } else {
        setErrorMessage(res.error || 'Failed to create team.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error occurred while creating team.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Respond to Invite (Accept / Decline)
  const handleRespondInvite = async (teamId, action) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await respondToInvitation(teamId, action);
      if (res.success) {
        if (action === 'ACCEPT') {
          setSuccessMessage('Joined team.');
          setMyTeam(res.data);
          setIsLeader(false);
          if (onTeamFormed) onTeamFormed(res.data);
        } else {
          setSuccessMessage('Invitation declined.');
          setMyTeam(null);
          setIsLeader(false);
        }
        await loadTeamData(true);
        if (onRefreshUser) onRefreshUser();
      } else {
        setErrorMessage(res.error || 'Failed to respond to invitation.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error responding to invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Inviting a Replacement Member
  const handleSendReplacementInvite = async (targetStudent) => {
    if (!myTeam) return;
    setReplacementLoading(true);
    setErrorMessage(null);
    try {
      const res = await inviteTeamMember(myTeam._id, { studentId: targetStudent._id });
      if (res.success) {
        setMyTeam(res.data);
        setSuccessMessage('Invitation sent.');
        setIsReplacementModalOpen(false);
        await loadTeamData(true);
      } else {
        setErrorMessage(res.error || 'Could not send invitation.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error sending replacement invitation.');
    } finally {
      setReplacementLoading(false);
    }
  };

  // Handle Cancel Invite
  const handleCancelInvite = async (memberStudentId) => {
    if (!window.confirm('Cancel this pending invitation?')) return;
    try {
      const res = await cancelTeamInvite(myTeam._id, memberStudentId);
      if (res.success) {
        setMyTeam(res.data);
        setSuccessMessage('Invitation cancelled.');
        await loadTeamData(true);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Could not cancel invite.');
    }
  };

  // Handle Disband Team with Password Confirmation
  const handleConfirmDisband = async (e) => {
    e.preventDefault();
    if (!disbandPassword.trim() || !myTeam) return;
    setIsDisbanding(true);
    setDisbandError(null);
    try {
      const res = await disbandTeam(myTeam._id, disbandPassword.trim());
      if (res.success) {
        setIsDisbandModalOpen(false);
        setDisbandPassword('');
        setMyTeam(null);
        setIsLeader(false);
        setSelectedMembers([]);
        setSuccessMessage('Team disbanded.');
        await loadTeamData(true);
        if (onRefreshUser) onRefreshUser();
      } else {
        setDisbandError(res.error || 'Failed to disband team.');
      }
    } catch (err) {
      setDisbandError(err.response?.data?.error || err.message || 'Incorrect password. Disband failed.');
    } finally {
      setIsDisbanding(false);
    }
  };


  // Member selection helpers for creation wizard
  const toggleSelectMember = (student) => {
    const isAlreadySelected = selectedMembers.some(m => m._id === student._id);
    if (isAlreadySelected) {
      setSelectedMembers(prev => prev.filter(m => m._id !== student._id));
    } else {
      const maxAllowed = targetSize - 1;
      if (selectedMembers.length >= maxAllowed) {
        setErrorMessage(`You have already chosen ${maxAllowed} member(s) for a team size of ${targetSize}.`);
        return;
      }
      setSelectedMembers(prev => [...prev, student]);
      setErrorMessage(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ padding: '6rem 1rem', textAlign: 'center' }}>
        <ProjIntelSpinner size="xl" label="Loading project team portal..." />
      </div>
    );
  }

  const isFormed = myTeam?.status === 'FORMED' || myTeam?.status === 'PROPOSED';
  const isForming = myTeam?.status === 'FORMING';

  return (
    <div className="page-container" style={{ paddingBottom: '3.5rem' }}>
      {/* Header Banner */}
      <div className="page-header-banner" style={{ marginBottom: '1.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span className="hero-pill-badge" style={{ margin: 0, padding: '0.2rem 0.65rem' }}>
              <Users size={14} /> Project Onboarding
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Step 1 of 2: Team Formation
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              • {user?.department?.name || user?.dept || 'Engineering'}
            </span>
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0.2rem 0' }}>
            Project Team Formation & Invitation Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Before proposing an academic project, confirm your team size (1-4 members) and batch. Peer invitations must be accepted before submitting your project proposal.
          </p>
        </div>

        <div>
          <button
            onClick={() => loadTeamData(true)}
            disabled={syncing}
            className="btn-aesthetic btn-glass-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            {syncing ? <ProjIntelSpinner size="xs" inline /> : <RefreshCw size={14} />}
            <span>{syncing ? 'Syncing...' : 'Sync Team Status'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div style={{ padding: '0.85rem 1.15rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#F87171', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.5rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div style={{ padding: '0.85rem 1.15rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', color: '#34D399', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* SECTION 1: RECEIVED INVITATIONS (IF ANY) */}
      {pendingInvites.length > 0 && !isFormed && (
        <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.75rem', boxShadow: '0 10px 30px rgba(99, 102, 241, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#818CF8', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#C7D2FE' }}>
              Action Required: Team Invitations Received ({pendingInvites.length})
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {pendingInvites.map(inv => (
              <div
                key={inv._id}
                style={{
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{inv.name || 'Academic Project Team'}</span>
                    <span style={{ fontSize: '0.725rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8', fontWeight: 700 }}>
                      {inv.targetSize} Members
                    </span>
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Invited by Team Lead: <strong style={{ color: 'var(--text-main)' }}>{inv.leader?.name}</strong> (Reg No: {inv.leader?.regNo}) • {inv.department?.name || 'Department'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button
                    onClick={() => handleRespondInvite(inv._id, 'ACCEPT')}
                    disabled={submitting}
                    className="btn-aesthetic btn-primary-glow btn-sm"
                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    {submitting ? (
                      <ProjIntelSpinner size="xs" inline label="Joining..." />
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Accept & Join Team</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleRespondInvite(inv._id, 'DECLINE')}
                    disabled={submitting}
                    className="btn-aesthetic btn-glass-secondary btn-sm"
                    style={{ color: '#F87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  >
                    {submitting ? (
                      <ProjIntelSpinner size="xs" inline label="Declining..." />
                    ) : (
                      <>
                        <XCircle size={15} />
                        <span>Decline</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: ACTIVE TEAM STATUS (IF USER BELONGS TO OR CREATED A TEAM) */}
      {isSelfAccepted && (
        <div style={{ background: 'var(--bg-card)', border: isFormed ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', marginBottom: '2rem', boxShadow: isFormed ? '0 15px 40px rgba(16, 185, 129, 0.1)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <span className={`project-status-badge ${isFormed ? 'status-completed' : 'status-in-progress'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {isFormed ? <CheckCircle2 size={13} /> : <Clock size={13} className="spin-animation" />}
                  <span>{isFormed ? 'TEAM FULLY FORMED' : 'INVITATIONS PENDING'}</span>
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Target Size: <strong>{myTeam.targetSize} {myTeam.targetSize === 1 ? 'Member' : 'Members'}</strong>
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  • {myTeam.department?.name || 'Department'}
                </span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0' }}>{myTeam.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
                {isFormed
                  ? 'All members have confirmed participation. Any team member can now draft and propose the project.'
                  : `Waiting for all ${myTeam.targetSize} slots to confirm before proposal submission opens.`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              {/* Only leader can disband the team, prompting for password */}
              {isLeader && !myTeam.project && (
                <button
                  type="button"
                  onClick={() => {
                    setDisbandPassword('');
                    setDisbandError(null);
                    setIsDisbandModalOpen(true);
                  }}
                  disabled={submitting || isDisbanding}
                  className="btn-aesthetic btn-glass-secondary btn-sm"
                  style={{ color: '#F87171', borderColor: 'rgba(239, 68, 68, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Trash2 size={14} />
                  <span>Disband Team</span>
                </button>
              )}


              {/* All confirmed team members can propose the project once formed! */}
              {isFormed && (
                <button
                  type="button"
                  onClick={onOpenNewProject}
                  className="btn-aesthetic btn-primary-glow"
                  style={{ padding: '0.65rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <FolderPlus size={16} />
                  <span>Propose Project</span>
                </button>
              )}
            </div>
          </div>

          {/* Members Status Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            {(myTeam.members || []).map((m, idx) => {
              const studentObj = m.student || {};
              const isAccepted = m.status === 'ACCEPTED';
              const isPending = m.status === 'PENDING';
              const isDeclined = m.status === 'DECLINED';
              const isSelf = String(studentObj._id || studentObj.id) === String(user?._id || user?.id);

              return (
                <div
                  key={m._id || idx}
                  style={{
                    background: isAccepted ? 'rgba(16, 185, 129, 0.05)' : isPending ? 'rgba(245, 158, 11, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                    border: isAccepted ? '1px solid rgba(16, 185, 129, 0.3)' : isPending ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: m.role === 'LEADER' ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {m.role === 'LEADER' ? 'Team Leader' : `Member ${idx + 1}`} {isSelf && '(You)'}
                    </span>

                    <span style={{ fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: isAccepted ? 'var(--success)' : isPending ? 'var(--warning)' : '#F87171' }}>
                      {isAccepted && <><CheckCircle2 size={13} /> Confirmed</>}
                      {isPending && <><Clock size={13} /> Pending</>}
                      {isDeclined && <><XCircle size={13} /> Declined</>}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.975rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.15rem' }}>
                    {studentObj.name || 'Invited Student'}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Reg No: <strong style={{ color: 'var(--text-main)' }}>{studentObj.regNo || 'Pending'}</strong>
                  </div>

                  {studentObj.email && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {studentObj.email}
                    </div>
                  )}

                  {/* Actions for Team Leader if member declined or pending */}
                  {isLeader && isForming && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem' }}>
                      {isDeclined && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplacementSearch('');
                            setIsReplacementModalOpen(true);
                          }}
                          className="btn-aesthetic btn-glass-secondary btn-sm"
                          style={{ fontSize: '0.725rem', padding: '0.25rem 0.55rem', width: '100%' }}
                        >
                          <UserPlus size={12} /> Invite Replacement
                        </button>
                      )}

                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleCancelInvite(studentObj._id)}
                          className="btn-aesthetic btn-glass-secondary btn-sm"
                          style={{ fontSize: '0.725rem', padding: '0.25rem 0.55rem', width: '100%', color: '#F87171' }}
                        >
                          <UserX size={12} /> Cancel Invite
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Formed Callout Banner */}
          {isFormed && (
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldCheck size={22} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.925rem', fontWeight: 700, color: '#34D399' }}>
                    Team formation verified ({myTeam.targetSize} / {myTeam.targetSize} members confirmed)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    All slots confirmed! Any team member can click "+ Propose Project" to draft title, problem statement, and technology stack.
                  </div>
                </div>
              </div>

              <button type="button" onClick={onOpenNewProject} className="btn-aesthetic btn-primary-glow btn-sm">
                <FolderPlus size={15} />
                <span>Open Proposal Form</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: FORM NEW TEAM WIZARD (WHEN STUDENT HAS NO ACTIVE ACCEPTED TEAM) */}
      {!isSelfAccepted && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '2rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div className="brand-icon" style={{ width: 42, height: 42, background: 'var(--gradient-primary)' }}>
              <Users size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Configure Your Project Team</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
                Select team size, assign registered classmates by Registration Number, and establish your group.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateTeamSubmit}>
            {/* Step 1: Team Size Picker */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.65rem', color: 'var(--text-main)' }}>
                Step 1: Select Team Size (1 - 4 Members) *
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
                {[
                  { size: 1, label: '1 Member (Solo)', desc: 'Individual academic project. Form instantly without invites.' },
                  { size: 2, label: '2 Members (Pair)', desc: 'Leader + 1 invited peer from your department.' },
                  { size: 3, label: '3 Members (Trio)', desc: 'Leader + 2 invited peers.' },
                  { size: 4, label: '4 Members (Quad)', desc: 'Leader + 3 invited peers (Maximum).' }
                ].map((opt) => (
                  <div
                    key={opt.size}
                    onClick={() => {
                      setTargetSize(opt.size);
                      setSelectedMembers([]);
                      setErrorMessage(null);
                    }}
                    style={{
                      background: targetSize === opt.size ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-glass)',
                      border: targetSize === opt.size ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.975rem', color: targetSize === opt.size ? '#C7D2FE' : 'var(--text-main)' }}>
                        {opt.label}
                      </span>
                      {targetSize === opt.size && (
                        <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} />
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {opt.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Name */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--text-main)' }}>
                Team Name / Working Group Title (Optional)
              </label>
              <input
                type="text"
                placeholder={`e.g. ${user?.name ? user.name.split(' ')[0] : 'Research'}'s Team`}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="aesthetic-input"
                style={{ padding: '0.65rem 0.85rem' }}
              />
            </div>

            {/* Step 2: Member Picker (If targetSize > 1) */}
            {targetSize > 1 && (
              <div style={{ marginBottom: '1.75rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'block' }}>
                      Step 2: Choose {targetSize - 1} Team Member(s) from Available Students *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem', marginBottom: '0.25rem' }}>
                      <span className="project-domain-badge" style={{ background: 'rgba(99, 102, 241, 0.18)', color: '#C7D2FE', border: '1px solid rgba(99, 102, 241, 0.35)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Building size={12} />
                        <span>Department: {userDeptName}</span>
                      </span>
                      <span className="project-domain-badge" style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#6EE7B7', border: '1px solid rgba(16, 185, 129, 0.35)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={12} />
                        <span>Batch: {userBatch} (Year {userYear})</span>
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Selected: <strong>{selectedMembers.length} of {targetSize - 1} peers</strong> • Only students of the same department & batch are eligible.
                    </span>
                  </div>

                  {selectedMembers.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {selectedMembers.map(m => (
                        <span key={m._id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '20px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', color: '#C7D2FE' }}>
                          <span>{m.name} ({m.regNo})</span>
                          <button
                            type="button"
                            onClick={() => toggleSelectMember(m)}
                            style={{ background: 'transparent', border: 'none', color: '#C7D2FE', cursor: 'pointer', padding: 0 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Bar & Available Students List */}
                <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  <div className="input-wrapper" style={{ flex: 1, minWidth: '220px' }}>
                    <Search className="input-icon" size={15} />
                    <input
                      type="text"
                      placeholder="Search by Registration Number, Name, or Email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="aesthetic-input"
                      style={{ paddingLeft: '2.2rem' }}
                    />
                  </div>
                </div>

                {/* Available Students Table / Cards */}
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)' }}>
                  {filteredAvailableStudents.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Users size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.875rem', margin: 0 }}>
                        {searchQuery ? 'No eligible students match this search filter.' : `No other eligible students currently available in ${userDeptName} (${userBatch}).`}
                      </p>
                      <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Students must belong to your department and batch, and not already belong to another team or project.</span>
                    </div>
                  ) : (
                    filteredAvailableStudents.map((stud) => {
                      const isChosen = selectedMembers.some(m => m._id === stud._id);

                      return (
                        <div
                          key={stud._id}
                          style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: isChosen ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                            gap: '0.85rem'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                {stud.name}
                              </span>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--primary)' }}>
                                {stud.regNo}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {stud.department?.code || stud.department?.name || userDeptCode || 'Department'} • Batch {stud.batch || userBatch} (Year {stud.yearOfStudy || stud.year || userYear}) • {stud.email}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleSelectMember(stud)}
                            className={`btn-aesthetic btn-sm ${isChosen ? 'btn-glass-secondary' : 'btn-primary-glow'}`}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                          >
                            {isChosen ? 'Selected ✓' : '+ Add'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Submit Action Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="submit"
                disabled={submitting || (targetSize > 1 && selectedMembers.length !== (targetSize - 1))}
                className="btn-aesthetic btn-primary-glow"
                style={{ padding: '0.75rem 1.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {targetSize === 1 ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Confirm Solo Team (1 Member)</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send Invitations to {selectedMembers.length} Peer(s)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REPLACEMENT INVITE MODAL (WHEN A MEMBER DECLINED) */}
      {isReplacementModalOpen && (
        <div className="modal-backdrop-overlay" onClick={() => setIsReplacementModalOpen(false)}>
          <div className="aesthetic-modal-card" style={{ maxWidth: '540px', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={18} style={{ color: 'var(--primary)' }} />
              Invite Replacement Team Member
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
              Select an available student from your department and batch to replace a declined invitation slot.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.725rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.25)'
              }}>
                <Building size={12} /> {userDeptName || 'Your Department'}
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.725rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: 'rgba(168, 85, 247, 0.12)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.25)'
              }}>
                <Calendar size={12} /> {userBatch || (userYear ? `Year ${userYear}` : 'Same Batch')}
              </span>
            </div>

            <div className="input-wrapper" style={{ marginBottom: '1rem' }}>
              <Search className="input-icon" size={15} />
              <input
                type="text"
                placeholder="Search by Registration Number or Name..."
                value={replacementSearch}
                onChange={(e) => setReplacementSearch(e.target.value)}
                className="aesthetic-input"
                style={{ paddingLeft: '2.2rem' }}
              />
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              {filteredAvailableStudents.filter(s => {
                if (!replacementSearch.trim()) return true;
                const q = replacementSearch.toLowerCase().trim();
                return s.name.toLowerCase().includes(q) || s.regNo.toLowerCase().includes(q);
              }).length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No available peers found matching your batch and department.
                </div>
              ) : (
                filteredAvailableStudents
                  .filter(s => {
                    if (!replacementSearch.trim()) return true;
                    const q = replacementSearch.toLowerCase().trim();
                    return s.name.toLowerCase().includes(q) || s.regNo.toLowerCase().includes(q);
                  })
                  .map(stud => (
                    <div
                      key={stud._id}
                      style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {stud.name} <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--primary)', marginLeft: '0.35rem' }}>{stud.regNo}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {stud.department?.name || 'Department'} • {stud.batch || (stud.yearOfStudy ? `Year ${stud.yearOfStudy}` : 'Same Batch')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSendReplacementInvite(stud)}
                        disabled={replacementLoading}
                        className="btn-aesthetic btn-primary-glow btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                      >
                        {replacementLoading ? 'Sending...' : 'Send Invite'}
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsReplacementModalOpen(false)}
                className="btn-aesthetic btn-glass-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leader Disband Team Password Confirmation Modal */}
      {isDisbandModalOpen && (
        <div className="modal-backdrop-overlay" onClick={() => !isDisbanding && setIsDisbandModalOpen(false)}>
          <div
            className="aesthetic-modal-card"
            style={{ maxWidth: '480px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="brand-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', width: 44, height: 44 }}>
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Disband Project Team
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '0.85rem',
              fontSize: '0.825rem',
              color: '#FCA5A5',
              marginBottom: '1.25rem',
              lineHeight: 1.5
            }}>
              <strong>Warning:</strong> Disbanding will remove all confirmed members and cancel all pending invitations for <strong>"{myTeam?.name}"</strong>. Since this is an irreversible action, please enter your account password to confirm.
            </div>

            <form onSubmit={handleConfirmDisband}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Lock size={14} /> Team Leader Password *
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Enter your account password"
                  value={disbandPassword}
                  onChange={(e) => {
                    setDisbandPassword(e.target.value);
                    setDisbandError(null);
                  }}
                  className="aesthetic-input"
                  style={{ paddingLeft: '0.85rem' }}
                />
              </div>

              {disbandError && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  fontSize: '0.825rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={15} />
                  <span>{disbandError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  disabled={isDisbanding}
                  onClick={() => setIsDisbandModalOpen(false)}
                  className="btn-aesthetic btn-glass-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDisbanding || !disbandPassword.trim()}
                  className="btn-aesthetic btn-sm"
                  style={{ background: '#EF4444', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {isDisbanding ? (
                    <ProjIntelSpinner size="xs" inline label="Disbanding..." />
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Confirm Disband Team</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamFormationWorkspace;
