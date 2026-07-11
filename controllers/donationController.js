// controllers/donationController.js
const { collections } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendDonationReceipt } = require('../services/emailService');

const generateRef = () => 'DON-' + Date.now().toString(36).toUpperCase();

const getSponsorLevelFromTotal = (total) => {
    if (total >= 100000) return 'platinum';
    if (total >= 50000) return 'gold';
    if (total >= 20000) return 'silver';
    return 'bronze';
};

const buildSponsorDashboardSummary = ({ donations = [], currentUser, sponsorUsers = [] }) => {
    const sponsorId = currentUser?.uid || currentUser?.id || currentUser?.userId || null;
    const sponsorDonations = (donations || []).filter((d) => d.donorId && sponsorId && d.donorId === sponsorId);

    const totalDonated = sponsorDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const programsSupported = Object.entries(
            sponsorDonations.reduce((acc, d) => {
                const program = d.program || 'General Fund';
                acc[program] = (acc[program] || 0) + (Number(d.amount) || 0);
                return acc;
            }, {})
        )
        .map(([program, totalContributed]) => ({ program, totalContributed }))
        .sort((a, b) => b.totalContributed - a.totalContributed);

    const peopleImpacted = Math.max(1, Math.round(totalDonated / 5000));
    const sponsorLevel = getSponsorLevelFromTotal(totalDonated);

    const donorTotals = (donations || []).reduce((acc, d) => {
        if (!d.donorId) return acc;
        acc[d.donorId] = (acc[d.donorId] || 0) + (Number(d.amount) || 0);
        return acc;
    }, {});

    const rankedDonors = Object.entries(donorTotals).sort((a, b) => b[1] - a[1]);
    const rank = sponsorId ? rankedDonors.findIndex(([id]) => id === sponsorId) + 1 : rankedDonors.length + 1;
    const totalSponsors = Math.max(1, rankedDonors.length || sponsorUsers.length || 1);
    const effectiveTotalSponsors = Math.max(totalSponsors, sponsorUsers.length || 0, rankedDonors.length || 0);

    const impactStories = programsSupported.slice(0, 3).map(({ program, totalContributed }, index) => ({
        title: program,
        summary: `Your support of KES ${Number(totalContributed).toLocaleString()} helped ${Math.max(1, Math.round(totalContributed / 2500))} community-led outcomes in ${program}.`,
        icon: index === 0 ? '✂️' : index === 1 ? '💰' : '🌟',
    }));

    return {
        totalDonated,
        peopleImpacted,
        programsSupported,
        sponsorLevel,
        rank,
        totalSponsors: effectiveTotalSponsors,
        impactStories,
        recentDonations: sponsorDonations.slice(0, 5),
    };
};

// POST /api/donations  — Record a new donation
const createDonation = asyncHandler(async(req, res) => {
    const { amount, program, paymentMethod, donorName, donorEmail, notes } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid donation amount is required.' });
    }

    const reference = generateRef();
    const donationId = `donation_${Date.now()}`;

    const donation = {
        id: donationId,
        reference,
        amount: Number(amount),
        program: program || 'General Fund',
        paymentMethod: paymentMethod || 'M-Pesa',
        donorName: donorName || (req.user?.name ?? 'Anonymous'),
        donorEmail: donorEmail || req.user?.email || null,
        donorId: req.user?.uid || null,
        status: 'received',
        notes: notes || '',
        createdAt: new Date().toISOString(),
    };

    await collections.donations.doc(donationId).set(donation);

    if (req.user?.role === 'sponsor') {
        const userDoc = await collections.users.doc(req.user.uid).get();
        const current = userDoc.data().totalDonated || 0;
        const newTotal = current + Number(amount);
        const sponsorLevel =
            newTotal >= 100000 ? 'platinum' :
            newTotal >= 50000 ? 'gold' :
            newTotal >= 20000 ? 'silver' : 'bronze';
        await collections.users.doc(req.user.uid).update({ totalDonated: newTotal, sponsorLevel });
    }

    await collections.activity.add({
        type: 'donation_received',
        description: `Donation of KES ${Number(amount).toLocaleString()} for ${program || 'General Fund'}`,
        userId: req.user?.uid || null,
        reference,
        timestamp: new Date().toISOString(),
    });

    if (donation.donorEmail) {
        sendDonationReceipt({
            name: donation.donorName,
            email: donation.donorEmail,
            amount,
            program: donation.program,
            reference,
        }).catch(() => {});
    }

    res.status(201).json({ success: true, message: 'Donation recorded. Thank you!', donation });
});

// GET /api/donations  — Admin: all | Sponsor: own donations
const getDonations = asyncHandler(async(req, res) => {
    const { program, status, limit = 100 } = req.query;
    let donations;

    if (req.user.role === 'sponsor') {
        // FIX: Use only .where() without .orderBy() to avoid composite index requirement.
        // Sort client-side instead.
        const snapshot = await collections.donations
            .where('donorId', '==', req.user.uid)
            .get();
        donations = snapshot.docs.map(d => d.data())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
        let query = collections.donations.orderBy('createdAt', 'desc').limit(Number(limit));
        if (program) query = query.where('program', '==', program);
        if (status) query = query.where('status', '==', status);
        const snapshot = await query.get();
        donations = snapshot.docs.map(d => d.data());
    }

    const total = donations.reduce((sum, d) => sum + (d.amount || 0), 0);

    res.json({ success: true, count: donations.length, total, donations });
});

// GET /api/donations/sponsor-summary  — Sponsor dashboard metrics
const getSponsorDashboardSummary = asyncHandler(async(req, res) => {
    const [donationSnap, sponsorSnap] = await Promise.all([
        collections.donations.get(),
        collections.users.where('role', '==', 'sponsor').get(),
    ]);

    const donations = donationSnap.docs.map((d) => d.data());
    const sponsorUsers = sponsorSnap.docs.map((d) => d.data());
    const summary = buildSponsorDashboardSummary({ donations, currentUser: req.user, sponsorUsers });

    res.json({ success: true, summary });
});

// GET /api/donations/summary  — Admin dashboard metrics
const getDonationSummary = asyncHandler(async(req, res) => {
    const snapshot = await collections.donations.get();
    const all = snapshot.docs.map(d => d.data());

    const now = new Date();
    const thisMonth = all.filter(d => {
        const date = new Date(d.createdAt);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    const byProgram = all.reduce((acc, d) => {
        const prog = d.program || 'General Fund';
        acc[prog] = (acc[prog] || 0) + d.amount;
        return acc;
    }, {});

    res.json({
        success: true,
        summary: {
            totalRaised: all.reduce((s, d) => s + d.amount, 0),
            totalCount: all.length,
            thisMonthTotal: thisMonth.reduce((s, d) => s + d.amount, 0),
            thisMonthCount: thisMonth.length,
            byProgram,
        },
    });
});

const getDonation = asyncHandler(async(req, res) => {
    const { id } = req.params;
    const snapshot = await collections.donations.doc(id).get();

    if (!snapshot.exists) {
        return res.status(404).json({ success: false, message: 'Donation not found.' });
    }

    res.json({ success: true, donation: snapshot.data() });
});

const updateDonationStatus = asyncHandler(async(req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    await collections.donations.doc(id).update({
        status,
        updatedAt: new Date().toISOString(),
    });

    const updatedDoc = await collections.donations.doc(id).get();
    res.json({ success: true, donation: updatedDoc.data() });
});

const updateDonation = asyncHandler(async(req, res) => {
    const { id } = req.params;
    const updates = {...req.body, updatedAt: new Date().toISOString() };

    if (updates.id) delete updates.id;

    await collections.donations.doc(id).update(updates);
    const updatedDoc = await collections.donations.doc(id).get();
    res.json({ success: true, donation: updatedDoc.data() });
});

const deleteDonation = asyncHandler(async(req, res) => {
    const { id } = req.params;
    await collections.donations.doc(id).delete();
    res.json({ success: true, message: 'Donation deleted.' });
});

module.exports = {
    createDonation,
    getDonations,
    getSponsorDashboardSummary,
    getDonationSummary,
    getDonation,
    updateDonationStatus,
    updateDonation,
    deleteDonation,
    buildSponsorDashboardSummary,
};