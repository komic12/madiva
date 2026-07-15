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
    if (data.status !== undefined) payload.status = data.status;
    if (data.totalEnrolled !== undefined) payload.totalEnrolled = Number(data.totalEnrolled || 0);
    if (data.completionRate !== undefined) payload.completionRate = Number(data.completionRate || 0);
    if (data.employmentRate !== undefined) payload.employmentRate = Number(data.employmentRate || 0);
    if (data.duration !== undefined) payload.duration = Number(data.duration || 0);
    return payload;
};

// GET /api/campaigns
const getCampaigns = asyncHandler(async(req, res) => {
    const source = collections.campaigns || collections.programs;
    const snapshot = await source.get();
    const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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