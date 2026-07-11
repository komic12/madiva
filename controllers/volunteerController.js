// controllers/volunteerController.js
const { collections } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/volunteers/opportunities
// Returns volunteer opportunities from Firestore (not hardcoded)
const getOpportunities = asyncHandler(async (req, res) => {
  try {
    const snapshot = await collections.programs.get();
    const opportunities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ 
      success: true, 
      count: opportunities.length,
      opportunities 
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch opportunities',
      error: error.message 
    });
  }
});

// POST /api/volunteers/apply
const applyForOpportunity = asyncHandler(async (req, res) => {
  const { opportunityId, opportunityTitle, message } = req.body;

  if (!opportunityId || !opportunityTitle) {
    return res.status(400).json({ 
      success: false, 
      message: 'Opportunity ID and title are required.' 
    });
  }

  const appId = `app_${Date.now()}`;
  const application = {
    id: appId, 
    opportunityId, 
    opportunityTitle,
    volunteerId: req.user.uid,
    volunteerName: req.user.name,
    volunteerEmail: req.user.email,
    message: message || '',
    status: 'pending',
    appliedAt: new Date().toISOString(),
  };

  await collections.volunteers.doc(appId).set(application);

  await collections.activity.add({
    type: 'volunteer_applied',
    description: `${req.user.name} applied for: ${opportunityTitle}`,
    userId: req.user.uid,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({ 
    success: true, 
    message: 'Application submitted! We will confirm shortly.', 
    application 
  });
});

// GET /api/volunteers/my-applications
const getMyApplications = asyncHandler(async (req, res) => {
  // FIX: Avoid composite index by filtering client-side
  const snapshot = await collections.volunteers
    .where('volunteerId', '==', req.user.uid)
    .get();
  
  const applications = snapshot.docs.map(d => d.data())
    .filter(d => d.opportunityId) // only applications, not hour logs
    .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
  
  res.json({ 
    success: true, 
    count: applications.length,
    applications 
  });
});

// POST /api/volunteers/log-hours
const logHours = asyncHandler(async (req, res) => {
  const { date, role, location, hours, notes } = req.body;
  
  if (!hours || isNaN(hours) || Number(hours) <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Valid hours required.' 
    });
  }

  const logId = `hours_${Date.now()}`;
  const entry = {
    id: logId,
    volunteerId: req.user.uid,
    volunteerName: req.user.name,
    date: date || new Date().toISOString().split('T')[0],
    role: role || 'General',
    location: location || '',
    hours: Number(hours),
    notes: notes || '',
    status: 'pending_approval',
    loggedAt: new Date().toISOString(),
  };

  await collections.volunteers.doc(logId).set(entry);

  // Update volunteer total hours
  const userDoc = await collections.users.doc(req.user.uid).get();
  const current = userDoc.data()?.totalHours || 0;
  const newTotal = current + Number(hours);
  
  const badgeLevel =
    newTotal >= 200 ? 'gold' :
    newTotal >= 100 ? 'silver' :
    newTotal >= 50  ? 'bronze' : 'starter';

  await collections.users.doc(req.user.uid).update({ 
    totalHours: newTotal, 
    badgeLevel,
    updatedAt: new Date().toISOString()
  });

  res.status(201).json({ 
    success: true, 
    message: 'Hours logged. Pending admin approval.', 
    entry, 
    newTotal 
  });
});

// GET /api/volunteers/my-hours
const getMyHours = asyncHandler(async (req, res) => {
  // FIX: Avoid composite index by doing client-side filtering and sorting
  const snapshot = await collections.volunteers
    .where('volunteerId', '==', req.user.uid)
    .get();

  const entries = snapshot.docs
    .map(d => d.data())
    .filter(d => d.hours && ['pending_approval', 'approved'].includes(d.status))
    .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
  
  const totalHours = entries
    .filter(e => e.status === 'approved')
    .reduce((s, e) => s + e.hours, 0);

  res.json({ 
    success: true, 
    totalHours, 
    count: entries.length,
    entries 
  });
});

// GET /api/volunteers  — Admin: all applications
const getAllApplications = asyncHandler(async (req, res) => {
  // FIX: Avoid composite index by doing client-side sorting
  const snapshot = await collections.volunteers
    .limit(200)
    .get();
  
  const applications = snapshot.docs.map(d => d.data())
    .sort((a, b) => new Date(b.appliedAt || b.loggedAt || 0) - new Date(a.appliedAt || a.loggedAt || 0))
    .slice(0, 100);
  
  res.json({ 
    success: true, 
    count: applications.length, 
    applications 
  });
});

// PATCH /api/volunteers/:id/status  — Admin approve/reject
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid status. Must be: approved, rejected, or pending' 
    });
  }

  await collections.volunteers.doc(req.params.id).update({
    status, 
    updatedAt: new Date().toISOString(), 
    reviewedBy: req.user.uid,
  });
  
  res.json({ 
    success: true, 
    message: `Application ${status}.` 
  });
});

// GET /api/volunteers/stats  — Admin: volunteer statistics
const getVolunteerStats = asyncHandler(async (req, res) => {
  const snapshot = await collections.volunteers.get();
  const allEntries = snapshot.docs.map(d => d.data());

  const applications = allEntries.filter(e => e.opportunityId);
  const hourLogs = allEntries.filter(e => e.hours);
  
  const totalHours = hourLogs
    .filter(e => e.status === 'approved')
    .reduce((s, e) => s + e.hours, 0);

  const pendingApprovals = hourLogs.filter(e => e.status === 'pending_approval').length;

  res.json({
    success: true,
    stats: {
      totalApplications: applications.length,
      pendingApplications: applications.filter(a => a.status === 'pending').length,
      approvedApplications: applications.filter(a => a.status === 'approved').length,
      totalHoursLogged: totalHours,
      pendingHourApprovals: pendingApprovals,
    }
  });
});

module.exports = {
  getOpportunities,
  applyForOpportunity,
  getMyApplications,
  logHours,
  getMyHours,
  getAllApplications,
  updateApplicationStatus,
  getVolunteerStats,
};
