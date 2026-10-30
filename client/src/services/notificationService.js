import api from "./api";

export async function getNotifications(userId) {
  return api.get(`/notifications/${userId}`);
}

export async function markRead(notificationId) {
  return api.put(`/notifications/${notificationId}/read`);
}

export async function markAllRead(userId) {
  return api.put(`/notifications/user/${userId}/read-all`);
}

export async function createNotification(data) {
  return api.post("/notifications", data);
}
