const { collections } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');

const seedDefaultActivities = async(source) => {
    const defaults = [{
            title: 'Community Training Session',
            description: 'Hands-on training in vocational and financial skills for local women and youth.',
            date: new Date().toISOString(),
            location: 'Suneka Community Center',
            category: 'Training',
            createdAt: new Date().toISOString(),
        },
        {
            title: 'Youth Leadership Meetup',
            description: 'A guided discussion on confidence, mentorship, and participation in local development.',
            date: new Date(Date.now() + 86400000).toISOString(),
            location: 'MADIVA Hall',
            category: 'Leadership',
            createdAt: new Date().toISOString(),
        },
    ];

    for (const item of defaults) {
        const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await source.doc(id).set({ id, ...item });
    }
};

// GET /api/activities
const getActivities = asyncHandler(async(req, res) => {
    const source = collections.ongoingActivities || collections.activity;
    const snapshot = await source.orderBy('date', 'desc').get();
    let activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!activities.length) {
        await seedDefaultActivities(source);
        const refreshed = await source.orderBy('date', 'desc').get();
        activities = refreshed.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    res.json({ success: true, activities });
});

// POST /api/activities (Admin only)
const createActivity = asyncHandler(async(req, res) => {
    const { title, description, date, location, category, image } = req.body;
    const activityId = `act_${Date.now()}`;

    const activity = {
        id: activityId,
        title,
        description,
        date,
        location,
        category,
        image,
        createdAt: new Date().toISOString()
    };

    await (collections.ongoingActivities || collections.activity).doc(activityId).set(activity);
    res.status(201).json({ success: true, message: 'Activity added successfully.', activity });
});

// PATCH /api/activities/:id (Admin only)
const updateActivity = asyncHandler(async(req, res) => {
    const { id } = req.params;
    const updates = req.body;
    updates.updatedAt = new Date().toISOString();

    await (collections.ongoingActivities || collections.activity).doc(id).update(updates);
    res.json({ success: true, message: 'Activity updated successfully.' });
});

// DELETE /api/activities/:id (Admin only)
const deleteActivity = asyncHandler(async(req, res) => {
    await (collections.ongoingActivities || collections.activity).doc(req.params.id).delete();
    res.json({ success: true, message: 'Activity deleted successfully.' });
});

module.exports = { getActivities, createActivity, updateActivity, deleteActivity };