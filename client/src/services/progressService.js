import api from "./api";

export async function getWeeklyProgress(projectId) {
  return api.get(`/weekly-progress/project/${projectId}`);
}

export async function submitWeeklyProgress(data) {
  return api.post("/weekly-progress", data);
}

export async function gradeWeeklyReport(id, data) {
  return api.put(`/weekly-progress/${id}/grade`, data);
}

export async function updateWeeklyProgress(id, data) {
  return api.put(`/weekly-progress/${id}`, data);
}
