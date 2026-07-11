// middleware/upload.js
// Multer config — stores files in memory before uploading to Firebase Storage

const multer = require('multer');
const path   = require('path');

const ALLOWED_TYPES = [
  // Images
  'image/jpeg','image/jpg','image/png','image/webp','image/gif',
  // Videos
  'video/mp4','video/quicktime','video/x-msvideo','video/webm','video/x-matroska',
];

const storage = multer.memoryStorage(); // hold in RAM, then push to Firebase

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not allowed. Upload images (JPG, PNG, WEBP) or videos (MP4, MOV, AVI).`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max per file (for videos)
    files: 20,                    // max 20 files at once
  },
});

// Single file:  upload.single('file')
// Multiple:     upload.array('files', 20)
// Mixed fields: upload.fields([{ name:'images' },{ name:'videos' }])

module.exports = upload;
