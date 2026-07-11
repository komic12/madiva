const { collections } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');

const buildCampaignPayload = (data = {}) => {
    const payload = {};
    if (data.title !== undefined) payload.title = data.title.trim();
    if (data.description !== undefined) payload.description = data.description.trim();
    if (data.targetAmount !== undefined) payload.targetAmount = Number(data.targetAmount || 0);
    if (data.currentAmount !== undefined) payload.currentAmount = Number(data.currentAmount || 0);
    if (data.deadline !== undefined) payload.deadline = data.deadline;
    if (data.category !== undefined) payload.category = data.category;
    if (data.image !== undefined) payload.image = data.image;
    return payload;
};

const seedDefaultCampaigns = async(source) => {
    const defaults = [{
            title: 'Vocational Skills Program',
            description: 'Upskilling young women and youth in hairdressing, beauty therapy, and entrepreneurship.',
            targetAmount: 500000,
            currentAmount: 240000,
            deadline: '2026-12-31',
            category: 'Vocational Skills',
            status: 'active',
            createdAt: new Date().toISOString(),
        },
        {
            title: 'Financial Literacy Drive',
            description: 'Helping families build savings habits, budget better, and start small income-generating activities.',
            targetAmount: 300000,
            currentAmount: 132500,
            deadline: '2026-10-30',
            category: 'Economic Empowerment',
            status: 'active',
            createdAt: new Date().toISOString(),
        },
    ];

    for (const item of defaults) {
        const id = `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await source.doc(id).set({ id, ...item });
    }
};

// GET /api/campaigns
const getCampaigns = asyncHandler(async(req, res) => {
    const source = collections.campaigns || collections.programs;
    const snapshot = await source.get();
    let campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!campaigns.length) {
        await seedDefaultCampaigns(source);
        const refreshed = await source.get();
        campaigns = refreshed.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    res.json({ success: true, campaigns });
});

// POST /api/campaigns (Admin only)
const createCampaign = asyncHandler(async(req, res) => {
    const campaignId = `campaign_${Date.now()}`;
    const normalized = buildCampaignPayload(req.body);

    const campaign = {
        id: campaignId,
        title: normalized.title || 'Untitled Campaign',
        description: normalized.description || '',
        targetAmount: normalized.targetAmount || 0,
        currentAmount: normalized.currentAmount || 0,
        deadline: normalized.deadline || '',
        category: normalized.category || 'General Fund',
        ...(normalized.image ? { image: normalized.image } : {}),
        status: 'active',
        createdAt: new Date().toISOString(),
    };

    await (collections.campaigns || collections.programs).doc(campaignId).set(campaign);
    res.status(201).json({ success: true, message: 'Campaign created successfully.', campaign });
});

// PATCH /api/campaigns/:id (Admin only)
const updateCampaign = asyncHandler(async(req, res) => {
    const { id } = req.params;
    const updates = buildCampaignPayload(req.body);
    updates.updatedAt = new Date().toISOString();

    await (collections.campaigns || collections.programs).doc(id).update(updates);
    res.json({ success: true, message: 'Campaign updated successfully.' });
});

// DELETE /api/campaigns/:id (Admin only)
const deleteCampaign = asyncHandler(async(req, res) => {
    await (collections.campaigns || collections.programs).doc(req.params.id).delete();
    res.json({ success: true, message: 'Campaign deleted successfully.' });
});

module.exports = { getCampaigns, createCampaign, updateCampaign, deleteCampaign, buildCampaignPayload };