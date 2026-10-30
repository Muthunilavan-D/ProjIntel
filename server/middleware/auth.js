const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "projintel_jwt_secret_vcet_2026_secure_key";

function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized. No token provided." });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired token." });
  }
}

function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: "Unauthorized." });
    const userRole = (req.user.role || "").toUpperCase();
    const allowed = allowedRoles.map(r => r.toUpperCase());
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ success: false, error: "Forbidden. Insufficient role." });
    }
    next();
  };
}

module.exports = { protect, roleGuard, JWT_SECRET };
