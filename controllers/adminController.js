// controllers/adminController.js
const bcrypt = require('bcryptjs');
const { collections } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendWelcomeEmail } = require('../utils/email');

const makeUid = () => 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

const normalizeMemberRole = (role) => {
    const normalized = (role || '').toLowerCase().trim();
    if (normalized === 'donor' || normalized === 'sponsor') return 'sponsor';
    if (normalized === 'volunteer') return 'volunteer';
    if (normalized === 'admin') return 'admin';
    return normalized || 'sponsor';
};

const generateMemberPassword = (providedPassword = '') => {
    const trimmed = (providedPassword || '').trim();
    if (trimmed) return trimmed;
    return `${Math.random().toString(36).slice(-8)}Aa1!`;
};

// GET /api/admin/dashboard
const getDashboard = asyncHandler(async(req, res) => {
    const [usersSnap, donationsSnap, contactsSnap, activitySnap] = await Promise.all([
        collections.users.get(),
        collections.donations.get(),
        collections.contacts.where('status', '==', 'new').get(),
        collections.activity.orderBy('timestamp', 'desc').limit(10).get(),
    ]);

    const users = usersSnap.docs.map(d => d.data());
    const donations = donationsSnap.docs.map(d => d.data());
    const now = new Date();

    const thisMonth = donations.filter(d => {
        const dt = new Date(d.createdAt);
        return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    });

    res.json({
        success: true,
        dashboard: {
            totalMembers: users.filter(u => u.role !== 'admin').length,
            activeVolunteers: users.filter(u => u.role === 'volunteer' && u.isActive).length,
            activeSponsors: users.filter(u => u.role === 'sponsor' && u.isActive).length,
            totalDonations: donations.reduce((s, d) => s + (d.amount || 0), 0),
            thisMonthDonations: thisMonth.reduce((s, d) => s + (d.amount || 0), 0),
            unreadContacts: contactsSnap.size,
            recentActivity: activitySnap.docs.map(d => d.data()),
        },
    });
});

// GET /api/admin/users
const getUsers = asyncHandler(async(req, res) => {
    const { role, limit = 100 } = req.query;
    let snap;
    if (role) snap = await collections.users.where('role', '==', role).limit(Number(limit)).get();
    else snap = await collections.users.orderBy('createdAt', 'desc').limit(Number(limit)).get();
    const users = snap.docs.map(d => { const { password: _, ...u } = d.data(); return u; });
    res.json({ success: true, count: users.length, users });
});

// POST /api/admin/users
const createUser = asyncHandler(async(req, res) => {
    const { name, email, role, phone, password: providedPassword } = req.body;
    if (!name || !email || !role)
        return res.status(400).json({ success: false, message: 'Name, email and role required.' });

    const existing = await collections.users.where('email', '==', email).limit(1).get();
    if (!existing.empty) return res.status(409).json({ success: false, message: 'Email already registered.' });

    const normalizedRole = normalizeMemberRole(role);
    const tempPassword = generateMemberPassword(providedPassword);
    const uid = makeUid();
    const hashed = await bcrypt.hash(tempPassword, 12);

    const user = {
        uid,
        name,
        email,
        role: normalizedRole,
        phone: phone || '',
        password: hashed,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: req.user.uid,
        ...(normalizedRole === 'sponsor' && { totalDonated: 0, sponsorLevel: 'bronze' }),
        ...(normalizedRole === 'volunteer' && { totalHours: 0, badgeLevel: 'starter' }),
    };

    await collections.users.doc(uid).set(user);
    sendWelcomeEmail({ name, email, role: normalizedRole, tempPassword }).catch(() => {});

    const { password: _, ...safe } = user;
    res.status(201).json({ success: true, message: 'User created. Welcome email sent.', temporaryPassword: tempPassword, user: safe });
});

// PATCH /api/admin/users/:uid/toggle
const toggleUserStatus = asyncHandler(async(req, res) => {
    const doc = await collections.users.doc(req.params.uid).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'User not found.' });
    const newStatus = !doc.data().isActive;
    await collections.users.doc(req.params.uid).update({ isActive: newStatus, updatedAt: new Date().toISOString() });
    res.json({ success: true, message: `User ${newStatus?'activated':'deactivated'}.`, isActive: newStatus });
});

// DELETE /api/admin/users/:uid
const deleteUser = asyncHandler(async(req, res) => {
    await collections.users.doc(req.params.uid).delete();
    res.json({ success: true, message: 'User deleted.' });
});

// GET /api/admin/activity
const getActivity = asyncHandler(async(req, res) => {
    const { limit = 50 } = req.query;
    const snap = await collections.activity.orderBy('timestamp', 'desc').limit(Number(limit)).get();
    res.json({ success: true, count: snap.size, activity: snap.docs.map(d => d.data()) });
});

// PATCH /api/admin/users/:uid
const updateUser = asyncHandler(async(req, res) => {
    const { uid } = req.params;
    const updates = req.body;

    await collections.users.doc(uid).update(updates);
    res.json({ success: true, message: 'User updated successfully.' });
});

// POST /api/admin/manual-donation
const addManualDonation = asyncHandler(async(req, res) => {
    const { amount, donorName, donorEmail, program, campaignId, date } = req.body;

    const donationId = `manual_${Date.now()}`;
    const donation = {
        id: donationId,
        amount: Number(amount),
        donorName,
        donorEmail,
        program,
        campaignId,
        paymentMethod: 'manual',
        status: 'completed',
        createdAt: date || new Date().toISOString()
    };

    await collections.donations.doc(donationId).set(donation);

    // If linked to a campaign, update campaign progress
    if (campaignId) {
        const campaignRef = collections.campaigns.doc(campaignId);
        const campaignDoc = await campaignRef.get();
        if (campaignDoc.exists) {
            const current = campaignDoc.data().currentAmount || 0;
            await campaignRef.update({ currentAmount: current + Number(amount) });
        }
    }

    // Add to activity log
    await collections.activity.add({
        type: 'donation',
        message: `Manual donation of KES ${amount} added for ${donorName}`,
        timestamp: new Date().toISOString()
    });

    res.status(201).json({ success: true, message: 'Manual donation recorded successfully.', donation });
});

module.exports = {
    getDashboard,
    getUsers,
    createUser,
    updateUser,
    toggleUserStatus,
    deleteUser,
    getActivity,
    addManualDonation,
    normalizeMemberRole,
    generateMemberPassword,
};