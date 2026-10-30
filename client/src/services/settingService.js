import api from "./api";

export async function getSystemSettings() {
  return api.get('/settings');
}

export async function updateSystemSettings(data) {
  return api.put('/settings', data);
}
