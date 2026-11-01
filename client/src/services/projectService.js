import api from "./api";

export async function getProjects(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  return api.get(`/projects${params ? "?" + params : ""}`);
}

export async function getProject(id) {
  return api.get(`/projects/${id}`);
}

export async function createProject(data) {
  return api.post("/projects", data);
}

export async function updateProject(id, data) {
  return api.put(`/projects/${id}`, data);
}

export async function submitProposal(id) {
  return api.put(`/projects/${id}/submit`);
}

export async function approveProject(id, data) {
  return api.put(`/projects/${id}/approve`, data);
}

export async function requestRevision(id, revisionNotes) {
  return api.put(`/projects/${id}/revision`, { revisionNotes });
}

export async function rejectProject(id, reason) {
  return api.put(`/projects/${id}/reject`, { reason });
}

export async function assignGuide(id, data) {
  return api.put(`/projects/${id}/assign-guide`, data);
}

export async function addComment(id, data) {
  return api.post(`/projects/${id}/comments`, data);
}

export async function completeProject(id, data = {}) {
  return api.put(`/projects/${id}/complete`, data);
}

export async function reopenProject(id) {
  return api.put(`/projects/${id}/reopen`, {});
}

export async function getIeeeDetails(projectId) {
  return api.get(`/projects/${projectId}/ieee`);
}

export async function updateIeeeDetails(projectId, data) {
  return api.put(`/projects/${projectId}/ieee`, data);
}

export async function uploadIeeeDraft(projectId, formData) {
  return api.postForm(`/projects/${projectId}/ieee/draft`, formData);
}

export async function uploadIeeeProof(projectId, formData) {
  return api.postForm(`/projects/${projectId}/ieee/proof`, formData);
}

