// server.js — MADIVA CBO Express Server
'use strict';
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const path     = require('path');
const multer   = require('multer');

const { errorHandler }    = require('./middleware/errorHandler');
const { protect, authorize, optionalAuth } = require('./middleware/auth');

// ── Controllers ──────────────────────────────────────────────────────────────
const auth       = require('./controllers/authController');
const admin      = require('./controllers/adminController');
const donations  = require('./controllers/donationController');
const volunteers = require('./controllers/volunteerController');
const campaigns  = require('./controllers/campaignController');
const activities = require('./controllers/activityController');
const contact    = require('./controllers/contactController');
const media      = require('./controllers/mediaController');
const mpesa      = require('./controllers/mpesaController');
const googleAuth = require('./controllers/googleAuthController');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:5000',
        'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
    ],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// ── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ── File upload setup ─────────────────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload  = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'MADIVA CBO API' });
});

// ── Firebase client config ────────────────────────────────────────────────────
app.get('/api/firebase-config', (req, res) => {
    res.json({
        apiKey:            process.env.FIREBASE_API_KEY,
        authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
        projectId:         process.env.FIREBASE_PROJECT_ID,
        storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId:             process.env.FIREBASE_APP_ID,
        measurementId:     process.env.FIREBASE_MEASUREMENT_ID,
        databaseURL:       process.env.FIREBASE_DATABASE_URL,
    });
});

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register',         auth.register);
app.post('/api/auth/login',            auth.login);
app.get ('/api/auth/me',               protect, auth.getMe);
app.put ('/api/auth/update-profile',   protect, auth.updateProfile);
app.put ('/api/auth/change-password',  protect, auth.changePassword);

// Google OAuth
app.post('/api/auth/google/register-sponsor',   googleAuth.googleRegisterSponsor);
app.post('/api/auth/google/register-volunteer', googleAuth.googleRegisterVolunteer);
app.post('/api/auth/google/login',              googleAuth.googleLogin);
app.post('/api/auth/google/set-password',       protect, googleAuth.setPasswordAfterGoogle);

// ── Admin routes ──────────────────────────────────────────────────────────────
app.get ('/api/admin/dashboard',           protect, authorize('admin'), admin.getDashboard);
app.get ('/api/admin/users',               protect, authorize('admin'), admin.getUsers);
app.post('/api/admin/users',               protect, authorize('admin'), admin.createUser);
app.patch('/api/admin/users/:uid',         protect, authorize('admin'), admin.updateUser);
app.patch('/api/admin/users/:uid/toggle',  protect, authorize('admin'), admin.toggleUserStatus);
app.delete('/api/admin/users/:uid',        protect, authorize('admin'), admin.deleteUser);
app.get ('/api/admin/activity',            protect, authorize('admin'), admin.getActivity);
app.post('/api/admin/manual-donation',     protect, authorize('admin'), admin.addManualDonation);

// ── Donation routes ───────────────────────────────────────────────────────────
app.post('/api/donations',                 optionalAuth, donations.createDonation);
app.get ('/api/donations',                 protect, donations.getDonations);
app.get ('/api/donations/summary',         protect, authorize('admin'), donations.getDonationSummary);
app.get ('/api/donations/sponsor-summary', protect, authorize('sponsor', 'admin'), donations.getSponsorDashboardSummary);
app.get ('/api/donations/:id',             protect, donations.getDonation);
app.patch('/api/donations/:id/status',     protect, authorize('admin'), donations.updateDonationStatus);
app.patch('/api/donations/:id',            protect, authorize('admin'), donations.updateDonation);
app.delete('/api/donations/:id',           protect, authorize('admin'), donations.deleteDonation);

// ── Volunteer routes ──────────────────────────────────────────────────────────
app.get ('/api/volunteers/opportunities',  volunteers.getOpportunities);
app.post('/api/volunteers/apply',          protect, authorize('volunteer', 'admin'), volunteers.applyForOpportunity);
app.get ('/api/volunteers/my-applications',protect, authorize('volunteer'), volunteers.getMyApplications);
app.post('/api/volunteers/log-hours',      protect, authorize('volunteer', 'admin'), volunteers.logHours);
app.get ('/api/volunteers/my-hours',       protect, authorize('volunteer'), volunteers.getMyHours);
app.get ('/api/volunteers/stats',          protect, authorize('admin'), volunteers.getVolunteerStats);
app.get ('/api/volunteers',               protect, authorize('admin'), volunteers.getAllApplications);
app.patch('/api/volunteers/:id/status',    protect, authorize('admin'), volunteers.updateApplicationStatus);

// ── Campaign routes ───────────────────────────────────────────────────────────
app.get ('/api/campaigns',                 campaigns.getCampaigns);
app.post('/api/campaigns',                 protect, authorize('admin'), campaigns.createCampaign);
app.patch('/api/campaigns/:id',            protect, authorize('admin'), campaigns.updateCampaign);
app.delete('/api/campaigns/:id',           protect, authorize('admin'), campaigns.deleteCampaign);

// ── Activity routes ───────────────────────────────────────────────────────────
app.get ('/api/activities',                activities.getActivities);
app.post('/api/activities',                protect, authorize('admin'), activities.createActivity);
app.patch('/api/activities/:id',           protect, authorize('admin'), activities.updateActivity);
app.delete('/api/activities/:id',          protect, authorize('admin'), activities.deleteActivity);

// ── Contact routes ────────────────────────────────────────────────────────────
app.post('/api/contact',                   contact.submitContact);
app.get ('/api/contact',                   protect, authorize('admin'), contact.getContacts);
app.patch('/api/contact/:id',              protect, authorize('admin'), contact.updateContactStatus);
app.delete('/api/contact/:id',             protect, authorize('admin'), contact.deleteContact);

// ── Media routes ──────────────────────────────────────────────────────────────
app.post('/api/media/upload',              protect, authorize('admin'), upload.array('files', 20), media.uploadMedia);
app.get ('/api/media',                     media.getMedia);
app.get ('/api/media/stats',               protect, authorize('admin'), media.getMediaStats);
app.get ('/api/media/:id',                 media.getMediaItem);
app.patch('/api/media/:id',               protect, authorize('admin'), media.updateMedia);
app.delete('/api/media/:id',              protect, authorize('admin'), media.deleteMedia);

// ── M-Pesa routes ─────────────────────────────────────────────────────────────
app.post('/api/mpesa/stkpush',             optionalAuth, mpesa.stkPush);
app.post('/api/mpesa/callback',            mpesa.mpesaCallback);
app.get ('/api/mpesa/status/:checkoutRequestId', mpesa.checkStatus);

// ── Admin Analytics & Reports ─────────────────────────────────────────────────
app.get ('/api/donations/monthly-summary', protect, authorize('admin'), async (req, res) => {
    try {
        const db = require('./config/firebase').db;
        const donationsRef = db.collection('donations');
        const snapshot = await donationsRef.get();
        
        const monthlyData = {};
        snapshot.forEach(doc => {
            const donation = doc.data();
            const date = new Date(donation.createdAt);
            const monthKey = date.toLocaleString('en-KE', { year: 'numeric', month: 'short' });
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            monthlyData[monthKey] += Number(donation.amount || 0);
        });
        
        const months = Object.entries(monthlyData).map(([month, total]) => ({
            month,
            total
        })).slice(-12);
        
        res.json({ success: true, months });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get ('/api/donations/daily-summary', protect, authorize('admin'), async (req, res) => {
    try {
        const db = require('./config/firebase').db;
        const donationsRef = db.collection('donations');
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const snapshot = await donationsRef
            .where('createdAt', '>=', monthStart.toISOString())
            .get();
        
        const dailyData = {};
        snapshot.forEach(doc => {
            const donation = doc.data();
            const date = new Date(donation.createdAt);
            const day = date.getDate();
            
            if (!dailyData[day]) {
                dailyData[day] = 0;
            }
            dailyData[day] += Number(donation.amount || 0);
        });
        
        const days = Object.entries(dailyData)
            .map(([day, total]) => ({ day: Number(day), total }))
            .sort((a, b) => a.day - b.day);
        
        res.json({ success: true, days });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Admin Notifications ───────────────────────────────────────────────────────
app.get ('/api/admin/notifications', protect, authorize('admin'), async (req, res) => {
    try {
        const db = require('./config/firebase').db;
        const notificationsRef = db.collection('notifications')
            .where('adminId', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .limit(20);
        
        const snapshot = await notificationsRef.get();
        const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        res.json({ success: true, notifications });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put ('/api/admin/notifications/:notificationId/read', protect, authorize('admin'), async (req, res) => {
    try {
        const db = require('./config/firebase').db;
        await db.collection('notifications').doc(req.params.notificationId).update({
            read: true,
            readAt: new Date().toISOString()
        });
        
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Volunteer Hour Approvals ──────────────────────────────────────────────────
app.get ('/api/admin/pending-hours', protect, authorize('admin'), async (req, res) => {
    try {
        const db = require('./config/firebase').db;
        const hoursRef = db.collection('volunteerHours')
            .where('status', '==', 'pending_approval')
            .orderBy('loggedAt', 'desc');
        
        const snapshot = await hoursRef.get();
        const entries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        res.json({ success: true, entries });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put ('/api/admin/hours/:hoursId/approve', protect, authorize('admin'), async (req, res) => {
    try {
        const db = require('./config/firebase').db;
        const hoursRef = db.collection('volunteerHours').doc(req.params.hoursId);
        const hoursDoc = await hoursRef.get();
        
        if (!hoursDoc.exists) {
            return res.status(404).json({ success: false, message: 'Hours entry not found' });
        }
        
        const hoursData = hoursDoc.data();
        
        await hoursRef.update({
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: req.user.uid
        });
        
        const volunteerRef = db.collection('volunteers').doc(hoursData.volunteerId);
        const volunteerDoc = await volunteerRef.get();
        
        if (volunteerDoc.exists) {
            const currentTotal = Number(volunteerDoc.data().totalHours || 0);
            await volunteerRef.update({
                totalHours: currentTotal + Number(hoursData.hours || 0)
            });
        }
        
        res.json({ success: true, message: 'Hours approved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put ('/api/admin/hours/:hoursId/reject', protect, authorize('admin'), async (req, res) => {
    try {
        const db = require('./config/firebase').db;
        const { reason } = req.body;
        
        await db.collection('volunteerHours').doc(req.params.hoursId).update({
            status: 'rejected',
            rejectionReason: reason,
            rejectedAt: new Date().toISOString(),
            rejectedBy: req.user.uid
        });
        
        res.json({ success: true, message: 'Hours rejected successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Catch-all: serve the SPA ──────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'madiva-cbo.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 MADIVA CBO Server running on http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
