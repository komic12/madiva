// ══════════════════════════════════════════════════════════════
//  REAL-TIME DATA LISTENERS FOR MADIVA CBO
//  Integrates Firebase Realtime Database with dashboard updates
// ══════════════════════════════════════════════════════════════

/**
 * Real-time listener for admin finance data
 */
function subscribeToFinanceData() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        loadAdminFinance();
        return;
    }

    window.firebaseRealtimeDB.subscribeToCollection('donations', (donations) => {
        const metricCards = document.querySelectorAll('#admin-finance .metric-card');
        const totalRaised = donations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const thisMonth = donations.filter(d => {
            const dDate = new Date(d.createdAt);
            const now = new Date();
            return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
        }).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

        if (metricCards[0]) metricCards[0].querySelector('.val').textContent = 'KES ' + (totalRaised / 1000).toFixed(0) + 'K';
        if (metricCards[2]) metricCards[2].querySelector('.val').textContent = 'KES ' + (thisMonth / 1000).toFixed(1) + 'K';

        // Update donations table
        const tbody = document.querySelector('#admin-finance tbody');
        if (tbody) {
            tbody.innerHTML = donations.slice(0, 20).length ?
                donations.slice(0, 20).map(d => `
            <tr>
              <td>${d.donorName || 'Anonymous'}</td>
              <td>${Number(d.amount).toLocaleString()}</td>
              <td>${d.program || 'General Fund'}</td>
              <td>${new Date(d.createdAt).toLocaleDateString('en-KE')}</td>
              <td><span class="status-pill sp-active">${d.status || 'received'}</span></td>
            </tr>`).join('') :
                '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No donations yet.</td></tr>';
        }
        console.log('📡 Real-time finance update:', donations.length, 'donations');
    }, { limit: 20 });
}

/**
 * Real-time listener for sponsor overview
 * FIX: Use uid (not id), call renderSponsorSummary for consistent rendering,
 *      also update impact panel and reports panel in real time.
 */
function subscribeToSponsorData() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        // Fallback: use REST API and renderSponsorSummary
        if (typeof loadSponsorOverviewFromAPI === 'function') {
            loadSponsorOverviewFromAPI();
        }
        return;
    }

    // FIX: Use uid consistently — matches backend donorId: req.user.uid
    const sponsorId = currentUser?.uid || currentUser?.id || currentUser?.userId || null;

    window.firebaseRealtimeDB.subscribeToCollection('donations', (donations) => {
        const userDonations = donations.filter(d => d.donorId && sponsorId && d.donorId === sponsorId);
        const total = userDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const peopleImpacted = Math.max(total > 0 ? 1 : 0, Math.round(total / 5000));

        const programMap = {};
        userDonations.forEach(d => {
            const program = d.program || 'General Fund';
            programMap[program] = (programMap[program] || 0) + (Number(d.amount) || 0);
        });
        const programsSupported = Object.entries(programMap).map(([program, totalContributed]) => ({ program, totalContributed }));

        // Compute sponsor level
        const sponsorLevel = total >= 100000 ? 'PLATINUM' :
            total >= 50000 ? 'GOLD' :
            total >= 20000 ? 'SILVER' : 'BRONZE';

        // Build impact stories
        const impactStories = programsSupported.map((p, i) => ({
            icon: i === 0 ? '✂️' : i === 1 ? '💰' : '🌟',
            title: p.program,
            summary: `Your support of KES ${Number(p.totalContributed).toLocaleString()} helped ${Math.max(1, Math.round(p.totalContributed / 2500))} community-led outcomes in ${p.program}.`
        }));

        // Build summary object matching renderSponsorSummary signature
        const summary = {
            totalDonated: total,
            peopleImpacted,
            programsSupported,
            sponsorLevel,
            impactStories,
            recentDonations: userDonations.slice(0, 5)
        };

        // Use the shared renderer for consistent display
        if (typeof renderSponsorSummary === 'function') {
            renderSponsorSummary(summary);
        } else {
            // Fallback direct update
            const metricCards = document.querySelectorAll('#sponsor-overview .metric-card');
            if (metricCards[0]) metricCards[0].querySelector('.val').textContent = 'KES ' + total.toLocaleString();
            if (metricCards[1]) metricCards[1].querySelector('.val').textContent = peopleImpacted;
            if (metricCards[2]) metricCards[2].querySelector('.val').textContent = programsSupported.length;
            if (metricCards[3]) metricCards[3].querySelector('.val').textContent = sponsorLevel;
        }

        console.log('📡 Real-time sponsor overview update:', userDonations.length, 'donations');
    });
}

/**
 * Real-time listener for donation history
 * FIX: Use uid consistently, render into correct tbody
 */
function subscribeToDonationHistory() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        if (typeof loadDonationHistoryFromAPI === 'function') {
            loadDonationHistoryFromAPI();
        }
        return;
    }

    // FIX: Use uid consistently
    const sponsorId = currentUser?.uid || currentUser?.id || currentUser?.userId || null;

    window.firebaseRealtimeDB.subscribeToCollection('donations', (donations) => {
        const userDonations = donations.filter(d => d.donorId && sponsorId && d.donorId === sponsorId);

        const tbody = document.querySelector('#sponsor-history tbody');
        if (tbody) {
            tbody.innerHTML = userDonations.length ?
                userDonations.map(d => `
            <tr>
              <td>${new Date(d.createdAt).toLocaleDateString('en-KE')}</td>
              <td>${Number(d.amount).toLocaleString()}</td>
              <td>${d.program || 'General Fund'}</td>
              <td>${d.paymentMethod || 'M-Pesa'}</td>
              <td><button class="btn btn-outline btn-sm" onclick="downloadReceiptFor('${d.id || d.reference || ''}','${(d.donorName || '').replace(/'/g,"\\'")}',${d.amount},'${d.program || 'General Fund'}','${d.createdAt || ''}')" style="white-space:nowrap">#${d.reference || d.id || 'REC'}</button></td>
            </tr>`).join('') :
                '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No donations yet. Make your first donation to see your history here.</td></tr>';
        }
        console.log('📡 Real-time donation history update:', userDonations.length, 'donations');
    });
}

/**
 * Real-time listener for admin media library
 */
function subscribeToMediaLibrary() {
    if (window.loadAdminMedia) {
        window.loadAdminMedia();
        return;
    }

    if (window.firebaseRealtimeDB && window.firebaseRealtimeDB.isReady()) {
        window.firebaseRealtimeDB.subscribeToCollection('media', () => {
            if (window.loadAdminMedia) window.loadAdminMedia();
        });
        return;
    }

    if (window.loadAdminMedia) window.loadAdminMedia();
}

/**
 * Real-time listener for volunteer opportunities
 * FIX: Use applyOpportunity (not applyForOpportunity), pass both id and title
 */
function subscribeToOpportunities() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        if (typeof loadOpportunitiesFromAPI === 'function') {
            loadOpportunitiesFromAPI();
        }
        return;
    }

    window.firebaseRealtimeDB.subscribeToCollection('programs', (programs) => {
        const container = document.getElementById('opportunities-list');
        if (container) {
            container.innerHTML = programs.length ?
                programs.map(prog => {
                    // FIX: Use applyOpportunity (matching the defined function), escape title safely
                    const safeTitle = (prog.name || prog.title || 'Opportunity').replace(/'/g, "\\'");
                    const safeId = (prog.id || '').replace(/'/g, "\\'");
                    return `
            <div class="opp-card">
              <div class="opp-tag">${prog.icon || '🌟'}</div>
              <div class="opp-info">
                <h4>${prog.name || prog.title || 'Opportunity'}</h4>
                <p>${prog.description || ''}</p>
                <p style="font-size:12px;color:var(--text-muted);margin-top:4px">
                  📍 ${prog.location || 'Kisii'} &nbsp;·&nbsp; 👥 ${prog.volunteers || 0} volunteers
                  ${prog.schedule ? ' &nbsp;·&nbsp; 🗓 ' + prog.schedule : ''}
                </p>
              </div>
              <button class="btn btn-red btn-sm" onclick="applyOpportunity('${safeId}','${safeTitle}')">Apply Now</button>
            </div>`;
                }).join('') :
                '<p style="color:var(--text-muted);text-align:center;padding:40px">No opportunities available yet. Check back soon!</p>';
        }
        console.log('📡 Real-time opportunities update:', programs.length, 'programs');
    });
}

/**
 * Real-time listener for volunteer hours
 * FIX: Use uid (not id), render into .hours-log div (not tbody), show all statuses
 */
function subscribeToVolunteerHours() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        if (typeof loadVolunteerHoursFromAPI === 'function') {
            loadVolunteerHoursFromAPI();
        }
        return;
    }

    // FIX: Use uid consistently — matches backend volunteerId: req.user.uid
    const volunteerId = currentUser?.uid || currentUser?.id || currentUser?.userId || null;

    window.firebaseRealtimeDB.subscribeToCollection('volunteers', (entries) => {
        // FIX: Filter by uid AND type=hours (hours entries have an `hours` field)
        const userHours = entries.filter(e =>
            e.volunteerId && volunteerId && e.volunteerId === volunteerId && e.hours
        );
        const approvedHours = userHours.filter(e => e.status === 'approved');
        const totalHours = approvedHours.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
        const pendingHours = userHours.filter(e => e.status === 'pending_approval').reduce((sum, h) => sum + (Number(h.hours) || 0), 0);

        // FIX: Render into .hours-log div (not tbody — there is no table in vol-hours)
        const list = document.querySelector('#vol-hours .hours-log');
        if (list) {
            list.innerHTML = userHours.length ?
                userHours.map(h => `
            <div class="hl-item" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
              <div>
                <strong style="font-size:14px">${h.role || 'Volunteer Shift'}</strong>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                  📅 ${h.date || new Date(h.loggedAt || Date.now()).toLocaleDateString('en-KE')}
                  ${h.location ? ' · 📍 ' + h.location : ''}
                  ${h.notes ? ' · ' + h.notes : ''}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <strong style="font-size:16px;color:var(--red)">${h.hours} hrs</strong>
                <span class="status-pill ${h.status === 'approved' ? 'sp-active' : h.status === 'rejected' ? 'sp-rejected' : 'sp-pending'}" style="font-size:11px">
                  ${h.status === 'approved' ? 'Approved' : h.status === 'rejected' ? 'Rejected' : 'Pending'}
                </span>
              </div>
            </div>`).join('') :
                '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:40px">No hours logged yet. Click "+ Log New Hours" to get started!</p>';
        }

        // Also update the hours summary at top of panel if present
        const hoursTotal = document.getElementById('vol-hours-total');
        if (hoursTotal) hoursTotal.textContent = totalHours;
        const hoursPending = document.getElementById('vol-hours-pending');
        if (hoursPending) hoursPending.textContent = pendingHours;

        console.log('📡 Real-time volunteer hours update:', userHours.length, 'entries, total approved:', totalHours);
    });
}

/**
 * Real-time listener for volunteer overview
 * FIX: Use uid (not id), update all 4 metric cards with real data,
 *      update progress bars and upcoming shifts
 */
function subscribeToVolunteerOverview() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        if (typeof loadVolunteerOverviewFromAPI === 'function') {
            loadVolunteerOverviewFromAPI();
        }
        return;
    }

    // FIX: Use uid consistently
    const volunteerId = currentUser?.uid || currentUser?.id || currentUser?.userId || null;

    window.firebaseRealtimeDB.subscribeToCollection('volunteers', (entries) => {
        // FIX: Filter by uid
        const userEntries = entries.filter(e => e.volunteerId && volunteerId && e.volunteerId === volunteerId);
        const hourEntries = userEntries.filter(e => e.hours);
        const applications = userEntries.filter(e => e.opportunityId);

        const approvedHours = hourEntries.filter(e => e.status === 'approved');
        const totalHours = approvedHours.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
        const shiftsCompleted = approvedHours.length;
        const impactPoints = totalHours * 5; // 5 points per hour

        // Compute badge level
        const badgeLevel = totalHours >= 200 ? '🥇 Gold' :
            totalHours >= 100 ? '🥈 Silver' :
            totalHours >= 50  ? '🥉 Bronze' : '🌱 Starter';

        // FIX: Update all 4 metric cards with real data
        const metricCards = document.querySelectorAll('#vol-overview .metric-card');
        if (metricCards[0]) metricCards[0].querySelector('.val').textContent = totalHours;
        if (metricCards[1]) metricCards[1].querySelector('.val').textContent = shiftsCompleted;
        if (metricCards[2]) metricCards[2].querySelector('.val').textContent = impactPoints;
        if (metricCards[3]) {
            const badgeEl = metricCards[3].querySelector('.val');
            if (badgeEl) badgeEl.textContent = badgeLevel;
        }

        // Update change indicators
        if (metricCards[0]) {
            const changeEl = metricCards[0].querySelector('.change');
            if (changeEl) {
                const thisMonthHours = approvedHours.filter(h => {
                    const d = new Date(h.loggedAt || h.date || Date.now());
                    const now = new Date();
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
                changeEl.textContent = thisMonthHours > 0 ? `↑ +${thisMonthHours} this month` : 'Keep going!';
            }
        }
        if (metricCards[2]) {
            const changeEl = metricCards[2].querySelector('.change');
            if (changeEl) {
                const rank = impactPoints >= 500 ? 'Top 10%' : impactPoints >= 200 ? 'Top 25%' : 'Keep going!';
                changeEl.textContent = '↑ ' + rank;
            }
        }

        // Update progress bars
        const hoursGoal = 150;
        const pointsGoal = 1000;
        const progBars = document.querySelectorAll('#vol-overview .prog-bar-list .pb-item');
        if (progBars[0]) {
            const pct = Math.min(100, Math.round((totalHours / hoursGoal) * 100));
            const fill = progBars[0].querySelector('.prog-fill');
            const label = progBars[0].querySelector('.pb-top small');
            if (fill) fill.style.width = pct + '%';
            if (label) label.textContent = `${totalHours} / ${hoursGoal}`;
            const span = progBars[0].querySelector('.pb-top span');
            if (span) span.textContent = `Hours Goal (${hoursGoal})`;
        }
        if (progBars[1]) {
            const pct = Math.min(100, Math.round((impactPoints / pointsGoal) * 100));
            const fill = progBars[1].querySelector('.prog-fill');
            const label = progBars[1].querySelector('.pb-top small');
            if (fill) fill.style.width = pct + '%';
            if (label) label.textContent = `${impactPoints} / ${pointsGoal}`;
        }
        if (progBars[2]) {
            const goldThreshold = 200;
            const pct = Math.min(100, Math.round((totalHours / goldThreshold) * 100));
            const fill = progBars[2].querySelector('.prog-fill');
            const label = progBars[2].querySelector('.pb-top small');
            if (fill) fill.style.width = pct + '%';
            if (label) label.textContent = pct + '%';
        }

        // Update upcoming shifts (pending applications)
        const pendingApps = applications.filter(a => a.status === 'pending' || a.status === 'approved');
        const upcomingContainer = document.querySelector('#vol-overview .opp-list');
        if (upcomingContainer && pendingApps.length) {
            upcomingContainer.innerHTML = pendingApps.slice(0, 3).map(a => `
            <div class="opp-card">
              <div class="opp-tag">📋</div>
              <div class="opp-info">
                <h4>${a.opportunityTitle || 'Volunteer Shift'}</h4>
                <p>Applied: ${new Date(a.appliedAt || Date.now()).toLocaleDateString('en-KE')}</p>
              </div>
              <span class="status-pill ${a.status === 'approved' ? 'sp-active' : 'sp-pending'}">${a.status === 'approved' ? 'Confirmed' : 'Pending'}</span>
            </div>`).join('');
        }

        console.log('📡 Real-time volunteer overview update:', totalHours, 'hours,', applications.length, 'applications');
    });
}

/**
 * Real-time listener for volunteer schedule
 * Shows approved applications as scheduled shifts
 */
function subscribeToVolunteerSchedule() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        if (typeof loadVolunteerScheduleFromAPI === 'function') {
            loadVolunteerScheduleFromAPI();
        }
        return;
    }

    const volunteerId = currentUser?.uid || currentUser?.id || currentUser?.userId || null;

    window.firebaseRealtimeDB.subscribeToCollection('volunteers', (entries) => {
        const userApps = entries.filter(e =>
            e.volunteerId && volunteerId && e.volunteerId === volunteerId && e.opportunityId
        );

        const container = document.getElementById('schedule-container');
        if (!container) return;

        if (!userApps.length) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:40px">No scheduled shifts yet. Apply for opportunities to get started!</p>';
            return;
        }

        container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Opportunity</th>
              <th>Applied On</th>
              <th>Status</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            ${userApps.map(a => `
            <tr>
              <td><strong>${a.opportunityTitle || 'Volunteer Shift'}</strong></td>
              <td>${new Date(a.appliedAt || Date.now()).toLocaleDateString('en-KE')}</td>
              <td><span class="status-pill ${a.status === 'approved' ? 'sp-active' : a.status === 'rejected' ? 'sp-rejected' : 'sp-pending'}">${a.status === 'approved' ? 'Confirmed' : a.status === 'rejected' ? 'Rejected' : 'Pending Review'}</span></td>
              <td style="font-size:12px;color:var(--text-muted)">${a.message || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;

        console.log('📡 Real-time volunteer schedule update:', userApps.length, 'applications');
    });
}

/**
 * Real-time listener for admin charts (monthly & daily)
 */
function subscribeToCharts() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        loadMonthlyChart();
        loadDailyChart();
        return;
    }

    window.firebaseRealtimeDB.subscribeToCollection('donations', () => {
        loadMonthlyChart();
        loadDailyChart();
        console.log('📡 Real-time charts update');
    }, { limit: 1000 });
}

/**
 * Real-time listener for admin notifications
 */
function subscribeToNotifications() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        loadNotifications();
        return;
    }

    if (window.currentUser?.uid) {
        window.firebaseRealtimeDB.subscribeToQuery(
            'notifications',
            [['adminId', '==', window.currentUser.uid]],
            (notifications) => {
                loadNotifications();
                console.log('📡 Real-time notifications update:', notifications.length);
            },
            { limit: 20, orderBy: ['createdAt', 'desc'] }
        );
    }
}

/**
 * Real-time listener for pending volunteer hours
 */
function subscribeToPendingHours() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        loadPendingApprovals();
        return;
    }

    window.firebaseRealtimeDB.subscribeToQuery(
        'volunteerHours',
        [['status', '==', 'pending_approval']],
        (entries) => {
            loadPendingApprovals();
            console.log('📡 Real-time pending hours update:', entries.length);
        },
        { orderBy: ['loggedAt', 'desc'] }
    );
}

/**
 * Real-time listener for programs
 */
function subscribeToPrograms() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        loadAdminDashboard();
        return;
    }

    window.firebaseRealtimeDB.subscribeToCollection('campaigns', (programs) => {
        const container = document.getElementById('programs-table-container');
        if (!container) return;

        if (programs.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:40px">No programs yet. Create programs to get started.</p>';
            return;
        }

        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Program Name</th>
                        <th>Target (KES)</th>
                        <th>Current (KES)</th>
                        <th>Progress</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${programs.map(p => {
                        const target = Number(p.targetAmount || 0);
                        const current = Number(p.currentAmount || 0);
                        const progress = target ? Math.round((current / target) * 100) : 0;
                        return `
                            <tr>
                                <td><strong>${p.title}</strong></td>
                                <td>${target.toLocaleString()}</td>
                                <td>${current.toLocaleString()}</td>
                                <td>
                                    <div class="prog-bar" style="width:100px;height:20px">
                                        <div class="prog-fill fill-p" style="width:${progress}%;height:100%"></div>
                                    </div>
                                    <small>${progress}%</small>
                                </td>
                                <td>${progress === 100 ? '✅ Funded' : '⏳ Active'}</td>
                                <td>
                                    <button class="btn btn-outline btn-xs" onclick="editProgram('${p.id}')">Edit</button>
                                    <button class="btn btn-red btn-xs" onclick="deleteProgram('${p.id}')">Delete</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = table;
        console.log('📡 Real-time programs update:', programs.length);
    }, { orderBy: ['createdAt', 'desc'] });
}

/**
 * Real-time listener for activities
 */
function subscribeToActivities() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        loadAdminDashboard();
        return;
    }

    window.firebaseRealtimeDB.subscribeToCollection('activities', (activities) => {
        const container = document.getElementById('activities-list');
        if (!container) return;

        if (activities.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">No activities yet. Add one to get started!</p>';
            return;
        }

        container.innerHTML = activities.map(a => `
            <div style="background:var(--purple-pale);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-weight:700;font-size:14px">${a.title}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${a.description || 'No description'}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${new Date(a.createdAt).toLocaleDateString('en-KE')}</div>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-outline btn-sm" onclick="editActivity('${a.id}')">Edit</button>
                    <button class="btn btn-red btn-sm" onclick="deleteActivity('${a.id}')">Delete</button>
                </div>
            </div>
        `).join('');
        console.log('📡 Real-time activities update:', activities.length);
    }, { orderBy: ['createdAt', 'desc'] });
}

/**
 * Real-time listener for campaigns
 */
function subscribeToCampaigns() {
    if (!window.firebaseRealtimeDB || !window.firebaseRealtimeDB.isReady()) {
        loadAdminDashboard();
        return;
    }

    window.firebaseRealtimeDB.subscribeToCollection('campaigns', (campaigns) => {
        const container = document.getElementById('campaigns-list');
        if (!container) return;

        if (campaigns.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">No campaigns yet. Add one to get started!</p>';
            return;
        }

        container.innerHTML = campaigns.map(c => {
            const target = Number(c.targetAmount || 0);
            const current = Number(c.currentAmount || 0);
            const progress = target ? Math.round((current / target) * 100) : 0;
            return `
                <div style="background:var(--blue-pale);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center">
                    <div style="flex:1">
                        <div style="font-weight:700;font-size:14px">${c.title}</div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">KES ${current.toLocaleString()} / ${target.toLocaleString()}</div>
                        <div class="prog-bar" style="width:100%;height:20px;margin-top:8px">
                            <div class="prog-fill fill-b" style="width:${progress}%;height:100%"></div>
                        </div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${progress}% funded</div>
                    </div>
                    <div style="display:flex;gap:8px;margin-left:12px">
                        <button class="btn btn-outline btn-sm" onclick="editCampaign('${c.id}')">Edit</button>
                        <button class="btn btn-red btn-sm" onclick="deleteCampaign('${c.id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
        console.log('📡 Real-time campaigns update:', campaigns.length);
    }, { orderBy: ['createdAt', 'desc'] });
}

// Export functions for use in main script
window.realtimeListeners = {
    subscribeToFinanceData,
    subscribeToSponsorData,
    subscribeToDonationHistory,
    subscribeToMediaLibrary,
    subscribeToOpportunities,
    subscribeToVolunteerHours,
    subscribeToVolunteerOverview,
    subscribeToVolunteerSchedule,
    subscribeToCharts,
    subscribeToNotifications,
    subscribeToPendingHours,
    subscribeToPrograms,
    subscribeToActivities,
    subscribeToCampaigns
};
