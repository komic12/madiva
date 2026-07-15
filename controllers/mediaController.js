// controllers/mediaController.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { bucket, collections, USE_FIREBASE, ensureFirebaseStorage } = require('../config/firebase');
const {
    uploadFile,
    deleteFile,
    createSignedUrl,
    listFiles,
    isSupabaseEnabled,
} = require('../config/supabase');
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

function normalizeExternalUrl(rawUrl) {
    try {
        return new URL(rawUrl).toString();
    } catch {
        return '';
    }
}

function getExternalMediaType(url) {
    if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url)) {
        return 'image';
    }
    if (/youtube\.com|youtu\.be|vimeo\.com|facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com/i.test(url)) {
        return 'video';
    }
    return 'video';
}

// POST /api/media/upload
const uploadMedia = asyncHandler(async(req, res) => {
    const { category = 'general', caption = '', program = '' } = req.body;
    const externalUrl = normalizeExternalUrl((req.body.link || req.body.externalUrl || '').trim());
    const uploaded = [];
    const errors = [];

    if ((!req.files || req.files.length === 0) && !externalUrl) {
        return res.status(400).json({ success: false, message: 'No files or links uploaded.' });
    }

    if (externalUrl) {
        const mediaId = uuidv4();
        const mediaType = getExternalMediaType(externalUrl);
        const mediaDoc = {
            id: mediaId,
            type: mediaType,
            originalName: externalUrl,
            filePath: null,
            url: externalUrl,
            size: 0,
            mimeType: null,
            category,
            program,
            caption,
            uploadedBy: req.user.uid,
            uploaderName: req.user.name,
            isPublished: true,
            storageType: 'external',
            externalUrl,
            createdAt: new Date().toISOString(),
        };

        await collections.media.doc(mediaId).set(mediaDoc);
        await collections.activity.add({
            type: 'media_uploaded',
            description: `External media link added: ${externalUrl}`,
            userId: req.user.uid,
            timestamp: new Date().toISOString(),
        });

        uploaded.push(mediaDoc);
    }

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
        let storageType = 'supabase';
        let localPath = null;
        let storagePath = remoteFilePath;

        try {
            await uploadFile(remoteFilePath, file.buffer, file.mimetype);
            publicUrl = buildMediaUrl(mediaId);
        } catch (supabaseError) {
            console.warn('Supabase Storage upload failed, trying Firebase fallback:', supabaseError.message);
            try {
                ensureFirebaseStorage();
                const fileRef = bucket.file(remoteFilePath);
                await fileRef.save(file.buffer, { metadata: { contentType: file.mimetype } });
                storageType = 'firebase';
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
        }

        const mediaDoc = {
            id: mediaId,
            type: mediaType,
            originalName: file.originalname,
            filePath: storagePath,
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

    const messageParts = [];
    if (uploaded.length) {
        messageParts.push(`${uploaded.length} item(s) uploaded`);
    }
    if (errors.length) {
        messageParts.push(`${errors.length} failed`);
    }

    res.status(201).json({
        success: uploaded.length > 0,
        message: messageParts.length ? messageParts.join(', ') : 'No media uploaded.',
        uploaded,
        ...(errors.length && { errors }),
    });
});

const checkSupabaseConnection = asyncHandler(async(req, res) => {
    if (!isSupabaseEnabled()) {
        return res.status(400).json({ success: false, message: 'Supabase storage is not configured.' });
    }

    try {
        const files = await listFiles('', { limit: 1 });
        return res.json({ success: true, message: 'Connected to Supabase Storage.', data: files });
    } catch (error) {
        return res.status(502).json({ success: false, message: `Supabase connection failed: ${error.message}` });
    }
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

    if (media.storageType === 'external' && media.externalUrl) {
        return res.redirect(media.externalUrl);
    }

    if (media.storageType === 'supabase') {
        try {
            const signedUrl = await createSignedUrl(media.filePath, 60);
            return res.redirect(signedUrl);
        } catch (signedError) {
            console.warn('Supabase signed URL generation failed:', signedError.message);
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
    } else if (doc.data().storageType === 'supabase') {
        try {
            await deleteFile(doc.data().filePath);
        } catch (_) {}
    } else {
        try {
            ensureFirebaseStorage();
            await bucket.file(doc.data().filePath).delete();
        } catch (_) {}
    }
    await collections.media.doc(req.params.id).delete();
    res.json({ success: true, message: 'Media deleted.' });
});

module.exports = { uploadMedia, getMedia, getMediaStats, getMediaContent, getMediaItem, updateMedia, deleteMedia, checkSupabaseConnection };