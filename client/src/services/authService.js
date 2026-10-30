import api from "./api";

export async function login(identifier, password, role) {
  return api.post("/auth/login", { 
    email: identifier, 
    regNo: identifier, 
    identifier, 
    password, 
    role 
  });
}

export async function register(data) {
  return api.post("/auth/register", data);
}

export async function getMe() {
  return api.get("/auth/me");
}

export async function getDepartments() {
  return api.get("/auth/departments");
}

export async function changePassword(currentPassword, newPassword) {
  return api.post("/auth/change-password", { currentPassword, newPassword });
}

export async function forgotPassword(email) {
  return api.post("/auth/forgot-password", { email });
}

export async function verifyResetOtp(email, otp) {
  return api.post("/auth/verify-reset-otp", { email, otp });
}

export async function resetPassword({ email, otp, resetToken, newPassword }) {
  return api.post("/auth/reset-password", { email, otp, resetToken, newPassword });
}

export async function requestAdminEmailChange(newEmail, currentPassword) {
  return api.post("/auth/admin/request-email-change", { newEmail, currentPassword });
}

export async function verifyEmailToken(tokenOrPayload) {
  const payload = typeof tokenOrPayload === 'string' ? { token: tokenOrPayload } : tokenOrPayload;
  return api.post("/auth/verify-email", payload);
}

export function saveToken(token) {
  localStorage.setItem("projintel_token", token);
}

export function clearToken() {
  localStorage.removeItem("projintel_token");
}

export function getStoredToken() {
  return localStorage.getItem("projintel_token");
}
