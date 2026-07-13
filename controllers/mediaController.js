// controllers/mediaController.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { bucket, collections, USE_FIREBASE, ensureFirebaseStorage } = require('../config/firebase');
const { asyncHandler } = require('../middleware/errorHandler');

const LOCAL_UPLOAD_ROOT = path.join(os.tmpdir(), 'madiva-cbo', 'uploads');

function buildMediaUrl(id) {
    return `/api/media/${id}/content`;
}

function transformMediaItem(media) {
    if (!media || !media.id) return media;
    return {
        ...media,
        url: buildMediaUrl(media.id),
    };
}

const ALLOWED_IMAGES = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_VIDEOS = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];

// POST /api/media/upload
const uploadMedia = asyncHandler(async(req, res) => {
    if (!req.files || req.files.length === 0)
        return res.status(400).json({ success: false, message: 'No files uploaded.' });

    const { category = 'general', caption = '', program = '' } = req.body;
    const uploaded = [],
        errors = [];

    for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isImage = ALLOWED_IMAGES.includes(ext);
        const isVideo = ALLOWED_VIDEOS.includes(ext);

        if (!isImage && !isVideo) { errors.push(`${file.originalname}: type not allowed.`); continue; }

        const maxBytes = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxBytes) { errors.push(`${file.originalname}: too large.`); continue; }

        const mediaId = uuidv4();
        const mediaType = isImage ? 'image' : 'video';
        const remoteFilePath = `madiva-cbo/${mediaType}s/${category}/${mediaId}${ext}`;
        let publicUrl = '';
        let storageType = 'firebase';
        let localPath = null;

        try {
            ensureFirebaseStorage();
            const fileRef = bucket.file(remoteFilePath);
            await fileRef.save(file.buffer, { metadata: { contentType: file.mimetype } });
            publicUrl = buildMediaUrl(mediaId);
        } catch (firebaseError) {
            console.warn('Firebase Storage upload failed, using local fallback:', firebaseError.message);
            storageType = 'local';
            const absoluteFolder = path.join(LOCAL_UPLOAD_ROOT, mediaType === 'image' ? 'images' : 'videos', category);
            fs.mkdirSync(absoluteFolder, { recursive: true });
            const absoluteFilePath = path.join(absoluteFolder, `${mediaId}${ext}`);
            fs.writeFileSync(absoluteFilePath, file.buffer);
            localPath = absoluteFilePath;
            publicUrl = buildMediaUrl(mediaId);
        }

        const mediaDoc = {
            id: mediaId,
            type: mediaType,
            originalName: file.originalname,
            filePath: remoteFilePath,
            url: publicUrl,
            size: file.size,
            mimeType: file.mimetype,
            category,
            program,
            caption,
            uploadedBy: req.user.uid,
            uploaderName: req.user.name,
            isPublished: true,
            storageType,
            localPath,
            createdAt: new Date().toISOString(),
        };

        await collections.media.doc(mediaId).set(mediaDoc);
        await collections.activity.add({
            type: 'media_uploaded',
            description: `${mediaType} uploaded: ${file.originalname}`,
            userId: req.user.uid,
            timestamp: new Date().toISOString(),
        });

        uploaded.push(mediaDoc);
    }

    res.status(201).json({
        success: true,
        message: `${uploaded.length} file(s) uploaded successfully to Firebase Storage.`,
        uploaded,
        ...(errors.length && { errors }),
    });
});

// GET /api/media
const getMedia = asyncHandler(async(req, res) => {
    const { limit = 50, published } = req.query;
    const snapshot = await collections.media.orderBy('createdAt', 'desc').get();
    let media = snapshot.docs.map(d => d.data());

    if (published === 'true' || published === '1') {
        media = media.filter(m => m.isPublished === true);
    } else if (published === 'false' || published === '0') {
        media = media.filter(m => m.isPublished !== true);
    }

    const limitValue = Number(limit);
    const pagedMedia = Number.isFinite(limitValue) && limitValue > 0 ?
        media.slice(0, limitValue) :
        media;

    const transformed = pagedMedia.map(transformMediaItem);
    const images = transformed.filter(m => m.type === 'image');
    const videos = transformed.filter(m => m.type === 'video');
    res.json({ success: true, count: transformed.length, images, videos, media: transformed });
});

// GET /api/media/stats
const getMediaStats = asyncHandler(async(req, res) => {
    const snapshot = await collections.media.get();
    const all = snapshot.docs.map(d => d.data());
    res.json({
        success: true,
        stats: {
            total: all.length,
            images: all.filter(m => m.type === 'image').length,
            videos: all.filter(m => m.type === 'video').length,
            published: all.filter(m => m.isPublished).length,
            totalSizeMB: (all.reduce((s, m) => s + (m.size || 0), 0) / (1024 * 1024)).toFixed(2),
            byCategory: all.reduce((acc, m) => { acc[m.category] = (acc[m.category] || 0) + 1; return acc; }, {}),
        },
    });
});

// GET /api/media/:id/content
const getMediaContent = asyncHandler(async(req, res) => {
    const doc = await collections.media.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found.' });

    const media = doc.data();
    if (media.storageType === 'local' && media.localPath) {
        const absoluteLocalPath = path.join(__dirname, '..', media.localPath.replace(/^\/+/, ''));
        return res.sendFile(absoluteLocalPath, err => {
            if (err) {
                console.warn('Local media file not found:', absoluteLocalPath, err.message);
                res.status(404).json({ success: false, message: 'Media file not found.' });
            }
        });
    }

    if (media.storageType === 'firebase' && media.filePath) {
        try {
            ensureFirebaseStorage();
            const fileRef = bucket.file(media.filePath);
            const [exists] = await fileRef.exists();
            if (!exists) return res.status(404).json({ success: false, message: 'Media file not found.' });

            const [signedUrl] = await fileRef.getSignedUrl({
                action: 'read',
                expires: Date.now() + 24 * 60 * 60 * 1000,
            });
            return res.redirect(signedUrl);
        } catch (err) {
            console.warn('Failed to generate signed URL for media:', err.message);
            if (media.url) {
                return res.redirect(media.url);
            }
            return res.status(500).json({ success: false, message: 'Unable to load media.' });
        }
    }

    if (media.url) {
        return res.redirect(media.url);
    }

    res.status(404).json({ success: false, message: 'Media unavailable.' });
});

// GET /api/media/:id
const getMediaItem = asyncHandler(async(req, res) => {
    const doc = await collections.media.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, media: transformMediaItem(doc.data()) });
});

// PATCH /api/media/:id
const updateMedia = asyncHandler(async(req, res) => {
    const { caption, category, program, isPublished } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (caption !== undefined) updates.caption = caption;
    if (category !== undefined) updates.category = category;
    if (program !== undefined) updates.program = program;
    if (isPublished !== undefined) updates.isPublished = isPublished;
    await collections.media.doc(req.params.id).update(updates);
    res.json({ success: true, message: 'Media updated.' });
});

// DELETE /api/media/:id
const deleteMedia = asyncHandler(async(req, res) => {
    const doc = await collections.media.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Not found.' });
    if (doc.data().storageType === 'local' && doc.data().localPath) {
        const absoluteLocalPath = doc.data().localPath;
        try { fs.unlinkSync(absoluteLocalPath); } catch (_) {}
    } else {
        try {
            ensureFirebaseStorage();
            await bucket.file(doc.data().filePath).delete();
        } catch (_) {}
    }
    await collections.media.doc(req.params.id).delete();
    res.json({ success: true, message: 'Media deleted.' });
});

module.exports = { uploadMedia, getMedia, getMediaStats, getMediaContent, getMediaItem, updateMedia, deleteMedia };