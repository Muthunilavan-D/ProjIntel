import api from "./api";

export async function getTasks(projectId) {
  return api.get(`/tasks/project/${projectId}`);
}

export async function createTask(data) {
  return api.post("/tasks", data);
}

export async function updateTask(id, data) {
  return api.put(`/tasks/${id}`, data);
}

export async function deleteTask(id) {
  return api.delete(`/tasks/${id}`);
}
