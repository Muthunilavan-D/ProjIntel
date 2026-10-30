import api from "./api";

export async function getStudents() {
  return api.get("/users/students");
}

export async function getStudent(id) {
  return api.get(`/users/students/${id}`);
}

export async function getFaculty() {
  return api.get("/users/faculty");
}

export async function getFacultyById(id) {
  return api.get(`/users/faculty/${id}`);
}

export async function createStudent(data) {
  return api.post("/users/students", data);
}

export async function updateStudent(id, data) {
  return api.put(`/users/students/${id}`, data);
}

export async function deleteStudent(id) {
  return api.delete(`/users/students/${id}`);
}

export async function createFaculty(data) {
  return api.post("/users/faculty", data);
}

export async function updateFaculty(id, data) {
  return api.put(`/users/faculty/${id}`, data);
}

export async function deleteFaculty(id) {
  return api.delete(`/users/faculty/${id}`);
}

export async function getDepartments() {
  try {
    const res = await api.get("/users/departments");
    if (res && res.success) return res;
  } catch (e) {
    // fallback
  }
  return api.get("/auth/departments");
}
