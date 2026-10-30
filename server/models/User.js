const Student = require('./Student');
const Faculty = require('./Faculty');
const Admin = require('./Admin');
// Ensure dependent schemas are registered for population
require('./Department');
require('./Project');

/**
 * Helper utility to find a user across separate Students, Faculties, and Admins collections.
 * Supports email, student register number (regNo), and faculty staff ID (facultyId/staffId).
 */
async function findUserByEmail(identifier) {
  if (!identifier) return null;
  const rawClean = identifier.toString().trim();
  const cleanEmail = rawClean.toLowerCase();

  // 1. Try finding Student by email OR register number
  const student = await Student.findOne({
    $or: [
      { email: cleanEmail },
      { regNo: rawClean },
      { regNo: new RegExp(`^${rawClean}$`, 'i') }
    ]
  }).populate('department').populate('project');
  if (student) return { user: student, role: 'STUDENT', model: 'Student' };

  // 2. Try finding Faculty by email OR facultyId / staffId
  const faculty = await Faculty.findOne({
    $or: [
      { email: cleanEmail },
      { facultyId: rawClean },
      { facultyId: new RegExp(`^${rawClean}$`, 'i') },
      { staffId: rawClean }
    ]
  }).populate('department');
  if (faculty) return { user: faculty, role: 'FACULTY', model: 'Faculty' };

  // 3. Try finding Admin by email
  const admin = await Admin.findOne({
    $or: [
      { email: cleanEmail },
      { email: new RegExp(`^${cleanEmail}$`, 'i') }
    ]
  }).populate('department');
  if (admin) return { user: admin, role: 'ADMIN', model: 'Admin' };

  return null;
}

module.exports = {
  Student,
  Faculty,
  Admin,
  findUserByEmail
};

