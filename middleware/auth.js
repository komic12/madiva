// middleware/auth.js
// Verifies JWT tokens and role-based access control

const jwt = require('jsonwebtoken');
const { collections } = require('../config/firebase');

// ── Verify JWT token ────────────────────────────────────
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data from Firestore
    const userDoc = await collections.users.doc(decoded.uid).get();
    if (!userDoc.exists) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const userData = userDoc.data();
    if (!userData.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    req.user = { uid: decoded.uid, ...userData };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// ── Role-based access control ───────────────────────────
// Usage: authorize('admin') or authorize('admin', 'sponsor')
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized for this resource.`,
      });
    }
    next();
  };
};

// ── Optional auth (attaches user if token present) ──────
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userDoc = await collections.users.doc(decoded.uid).get();
      if (userDoc.exists) req.user = { uid: decoded.uid, ...userDoc.data() };
    }
  } catch (_) { /* No token or invalid — continue as guest */ }
  next();
};

module.exports = { protect, authorize, optionalAuth };
