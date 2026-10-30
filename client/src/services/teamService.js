import api from './api';

export async function getMyTeam(studentId) {
  const query = studentId ? `?studentId=${studentId}` : '';
  return api.get(`/teams/my-team${query}`);
}

export async function getAvailableStudents(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.append('search', params.search);
  if (params.department) searchParams.append('department', params.department);
  if (params.studentId) searchParams.append('studentId', params.studentId);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return api.get(`/teams/available-students${query}`);
}

export async function getPendingInvitations(studentId) {
  const query = studentId ? `?studentId=${studentId}` : '';
  return api.get(`/teams/invitations/pending${query}`);
}

export async function createTeam(data) {
  return api.post('/teams/create', data);
}

export async function respondToInvitation(teamId, action) {
  return api.post(`/teams/${teamId}/respond`, { action });
}

export async function inviteTeamMember(teamId, data) {
  return api.post(`/teams/${teamId}/invite`, data);
}

export async function cancelTeamInvite(teamId, studentId) {
  return api.post(`/teams/${teamId}/cancel-invite`, { studentId });
}

export async function disbandTeam(teamId, password) {
  return api.delete(`/teams/${teamId}`, { data: { password } });
}
