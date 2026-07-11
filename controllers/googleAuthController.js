// controllers/googleAuthController.js
// Google OAuth 2.0 authentication for Sponsor and Volunteer signup/login
const jwt = require('jsonwebtoken');
const { collections } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendWelcomeEmail } = require('../utils/email');

const generateToken = (uid) =>
  jwt.sign({ uid }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const makeUid = () => 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

/**
 * POST /api/auth/google/register-sponsor
 * Google OAuth registration for Sponsors
 * Body: { googleId, email, name, picture, role: 'sponsor' }
 */
const googleRegisterSponsor = asyncHandler(async (req, res) => {
  const { googleId, email, name, picture, role } = req.body;

  if (!googleId || !email || !name || role !== 'sponsor') {
    return res.status(400).json({
      success: false,
      message: 'googleId, email, name, and role=sponsor are required.',
    });
  }

  // Check if user already exists by email
  const existing = await collections.users.where('email', '==', email).limit(1).get();
  if (!existing.empty) {
    const user = existing.docs[0].data();
    if (user.googleId === googleId) {
      // Same Google account — return existing user
      const { password: _, ...safe } = user;
      return res.json({
        success: true,
        message: 'Welcome back!',
        token: generateToken(user.uid),
        user: safe,
      });
    }
    // Different account with same email
    return res.status(409).json({
      success: false,
      message: 'Email already registered with a different account.',
    });
  }

  // Create new sponsor
  const uid = makeUid();
  const newUser = {
    uid,
    googleId,
    name,
    email,
    role: 'sponsor',
    picture: picture || null,
    password: null, // No password for Google OAuth users initially
    isActive: true,
    totalDonated: 0,
    sponsorLevel: 'bronze',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await collections.users.doc(uid).set(newUser);
  await collections.activity.add({
    type: 'user_registered',
    userId: uid,
    role: 'sponsor',
    description: `New sponsor registered via Google: ${name}`,
    timestamp: new Date().toISOString(),
  });

  sendWelcomeEmail({ name, email, role: 'sponsor' }).catch(() => {});

  const { password: _, ...safe } = newUser;
  res.status(201).json({
    success: true,
    message: 'Sponsor account created successfully!',
    token: generateToken(uid),
    user: safe,
  });
});

/**
 * POST /api/auth/google/register-volunteer
 * Google OAuth registration for Volunteers
 * Body: { googleId, email, name, picture, role: 'volunteer' }
 */
const googleRegisterVolunteer = asyncHandler(async (req, res) => {
  const { googleId, email, name, picture, role } = req.body;

  if (!googleId || !email || !name || role !== 'volunteer') {
    return res.status(400).json({
      success: false,
      message: 'googleId, email, name, and role=volunteer are required.',
    });
  }

  // Check if user already exists by email
  const existing = await collections.users.where('email', '==', email).limit(1).get();
  if (!existing.empty) {
    const user = existing.docs[0].data();
    if (user.googleId === googleId) {
      // Same Google account — return existing user
      const { password: _, ...safe } = user;
      return res.json({
        success: true,
        message: 'Welcome back!',
        token: generateToken(user.uid),
        user: safe,
      });
    }
    // Different account with same email
    return res.status(409).json({
      success: false,
      message: 'Email already registered with a different account.',
    });
  }

  // Create new volunteer
  const uid = makeUid();
  const newUser = {
    uid,
    googleId,
    name,
    email,
    role: 'volunteer',
    picture: picture || null,
    password: null, // No password for Google OAuth users initially
    isActive: true,
    totalHours: 0,
    badgeLevel: 'starter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await collections.users.doc(uid).set(newUser);
  await collections.activity.add({
    type: 'user_registered',
    userId: uid,
    role: 'volunteer',
    description: `New volunteer registered via Google: ${name}`,
    timestamp: new Date().toISOString(),
  });

  sendWelcomeEmail({ name, email, role: 'volunteer' }).catch(() => {});

  const { password: _, ...safe } = newUser;
  res.status(201).json({
    success: true,
    message: 'Volunteer account created successfully!',
    token: generateToken(uid),
    user: safe,
  });
});

/**
 * POST /api/auth/google/login
 * Google OAuth login for Sponsor or Volunteer
 * Body: { googleId, email, name, picture, role: 'sponsor' | 'volunteer' }
 */
const googleLogin = asyncHandler(async (req, res) => {
  const { googleId, email, name, picture, role } = req.body;

  if (!googleId || !email || !role || !['sponsor', 'volunteer'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'googleId, email, role (sponsor|volunteer) are required.',
    });
  }

  // Try to find user by email
  const snap = await collections.users.where('email', '==', email).limit(1).get();

  if (snap.empty) {
    // User doesn't exist — create new account
    const uid = makeUid();
    const roleDefaults =
      role === 'sponsor'
        ? { totalDonated: 0, sponsorLevel: 'bronze' }
        : { totalHours: 0, badgeLevel: 'starter' };

    const newUser = {
      uid,
      googleId,
      name,
      email,
      role,
      picture: picture || null,
      password: null,
      isActive: true,
      ...roleDefaults,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await collections.users.doc(uid).set(newUser);
    await collections.activity.add({
      type: 'user_registered',
      userId: uid,
      role,
      description: `New ${role} registered via Google: ${name}`,
      timestamp: new Date().toISOString(),
    });

    sendWelcomeEmail({ name, email, role }).catch(() => {});

    const { password: _, ...safe } = newUser;
    return res.status(201).json({
      success: true,
      message: `Welcome, ${name}! Your ${role} account has been created.`,
      token: generateToken(uid),
      user: safe,
    });
  }

  // User exists
  const user = snap.docs[0].data();

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Account deactivated. Contact admin.',
    });
  }

  const loginRole = user.role || role;
  const updates = { lastLogin: new Date().toISOString() };

  if (googleId && (!user.googleId || user.googleId !== googleId)) {
    updates.googleId = googleId;
  }

  if (picture && picture !== user.picture) {
    updates.picture = picture;
  }

  if (!user.role && role) {
    updates.role = role;
  }

  await collections.users.doc(user.uid).update(updates);

  await collections.activity.add({
    type: 'user_login',
    userId: user.uid,
    description: `${user.name} logged in via Google as ${loginRole}`,
    timestamp: new Date().toISOString(),
  });

  const responseUser = { ...user, ...updates, role: loginRole };
  const { password: _, ...safe } = responseUser;
  res.json({
    success: true,
    message: `Welcome back, ${responseUser.name}!`,
    token: generateToken(user.uid),
    user: safe,
  });
});

/**
 * POST /api/auth/google/set-password
 * Allow new Google OAuth users to set a password for email/password login
 * Protected route (requires auth token)
 * Body: { password }
 */
const setPasswordAfterGoogle = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const uid = req.user.uid;

  if (!password || password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.',
    });
  }

  const bcrypt = require('bcryptjs');
  const hashed = await bcrypt.hash(password, 12);

  await collections.users.doc(uid).update({
    password: hashed,
    updatedAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: 'Password set successfully. You can now log in with email and password.',
  });
});

module.exports = {
  googleRegisterSponsor,
  googleRegisterVolunteer,
  googleLogin,
  setPasswordAfterGoogle,
};
