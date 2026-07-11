// config/firebase.js
// Main Firebase configuration
// Always uses firebase-production.js which auto-detects credentials and
// gracefully falls back to the in-memory demo store when they are absent.
require('dotenv').config();
module.exports = require('./firebase-production');
