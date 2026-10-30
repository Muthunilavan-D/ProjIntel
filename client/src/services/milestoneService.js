import api from "./api";

export async function getMilestones(projectId) {
  return api.get(`/milestones/project/${projectId}`);
}

export async function createMilestone(data) {
  return api.post('/milestones', data);
}

export async function updateMilestone(id, data) {
  return api.put(`/milestones/${id}`, data);
}

export async function deleteMilestone(id) {
  return api.delete(`/milestones/${id}`);
}

export async function verifyMilestone(id, data = {}) {
  return api.post(`/milestones/${id}/verify`, data);
}

export async function unverifyMilestone(id) {
  return api.post(`/milestones/${id}/unverify`, {});
}
