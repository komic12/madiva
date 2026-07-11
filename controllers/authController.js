// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { collections } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendWelcomeEmail } = require('../utils/email');

const generateToken = (uid) =>
    jwt.sign({ uid }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const makeUid = () => 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'madiva@gmail.com';
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || 'Admin User';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123456';

const ensureDefaultAdmin = async() => {
    try {
        const existing = await collections.users.where('email', '==', DEFAULT_ADMIN_EMAIL).limit(1).get();
        if (!existing.empty) return existing.docs[0].data();

        const uid = makeUid();
        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
        const adminUser = {
            uid,
            name: DEFAULT_ADMIN_NAME,
            email: DEFAULT_ADMIN_EMAIL,
            role: 'admin',
            password: hashedPassword,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await collections.users.doc(uid).set(adminUser);
        await collections.activity.add({
            type: 'admin_bootstrap',
            userId: uid,
            description: `Default admin account created for ${DEFAULT_ADMIN_EMAIL}`,
            timestamp: new Date().toISOString(),
        });

        console.log(`✅ Default admin account created for ${DEFAULT_ADMIN_EMAIL}`);
        return adminUser;
    } catch (error) {
        console.warn('Could not ensure default admin account:', error.message);
        return null;
    }
};

// POST /api/auth/register
const register = asyncHandler(async(req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role)
        return res.status(400).json({ success: false, message: 'Name, email, password and role are required.' });

    const allowed = ['admin', 'sponsor', 'volunteer'];
    if (!allowed.includes(role))
        return res.status(400).json({ success: false, message: `Role must be one of: ${allowed.join(', ')}` });

    // Check duplicate email
    const existing = await collections.users.where('email', '==', email).limit(1).get();
    if (!existing.empty)
        return res.status(409).json({ success: false, message: 'Email already registered.' });

    const uid = makeUid();
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = {
        uid,
        name,
        email,
        role,
        password: hashedPassword,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(role === 'sponsor' && { totalDonated: 0, sponsorLevel: 'bronze' }),
        ...(role === 'volunteer' && { totalHours: 0, badgeLevel: 'starter' }),
    };

    await collections.users.doc(uid).set(user);
    await collections.activity.add({ type: 'user_registered', userId: uid, role, description: `New ${role}: ${name}`, timestamp: new Date().toISOString() });

    sendWelcomeEmail({ name, email, role, tempPassword: password }).catch(() => {});

    const { password: _, ...safe } = user;
    res.status(201).json({ success: true, message: 'Account created!', token: generateToken(uid), user: safe });
});

// POST /api/auth/login
const login = asyncHandler(async(req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ success: false, message: 'Email and password required.' });

    await ensureDefaultAdmin();

    const snap = await collections.users.where('email', '==', email).limit(1).get();
    if (snap.empty)
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const user = snap.docs[0].data();
    if (!user.isActive)
        return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    await collections.users.doc(user.uid).update({ lastLogin: new Date().toISOString() });
    await collections.activity.add({ type: 'user_login', userId: user.uid, description: `${user.name} logged in`, timestamp: new Date().toISOString() });

    const { password: _, ...safe } = user;
    res.json({ success: true, message: 'Login successful.', token: generateToken(user.uid), user: safe });
});

// GET /api/auth/me
const getMe = asyncHandler(async(req, res) => {
    const { password: _, ...safe } = req.user;
    res.json({ success: true, user: safe });
});

// PUT /api/auth/update-profile
const updateProfile = asyncHandler(async(req, res) => {
    const allowed = ['name', 'phone', 'location', 'skills', 'availability'];
    const updates = { updatedAt: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    await collections.users.doc(req.user.uid).update(updates);
    res.json({ success: true, message: 'Profile updated.' });
});

// PUT /api/auth/change-password
const changePassword = asyncHandler(async(req, res) => {
    const { currentPassword, newPassword } = req.body;
    const doc = await collections.users.doc(req.user.uid).get();
    const match = await bcrypt.compare(currentPassword, doc.data().password);
    if (!match) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await collections.users.doc(req.user.uid).update({ password: hashed, updatedAt: new Date().toISOString() });
    res.json({ success: true, message: 'Password changed.' });
});

module.exports = { register, login, getMe, updateProfile, changePassword, ensureDefaultAdmin };