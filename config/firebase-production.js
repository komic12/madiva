// config/firebase-production.js
// Production Firebase configuration with secure credential handling
// IMPORTANT: All credentials must be provided via environment variables

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Import firebase-admin with modular API (v14+)
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

let db, auth, bucket;
let USE_FIREBASE = false;
let _app = null;

// ── Validate Firebase credentials ──────────────────────────────
const validateFirebaseCredentials = () => {
    const required = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ PRODUCTION ERROR: Missing Firebase credentials:');
        missing.forEach(key => console.error(`   - ${key}`));
        throw new Error('Firebase credentials not configured');
    }

    // Validate private key format
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
        throw new Error('FIREBASE_PRIVATE_KEY is invalid - must contain BEGIN and END markers');
    }
};

// ── Initialize Firebase Admin SDK ──────────────────────────────
const initializeFirebase = () => {
    try {
        validateFirebaseCredentials();

        console.log('📋 Attempting Firebase initialization...');
        console.log(`   Project: ${process.env.FIREBASE_PROJECT_ID}`);
        console.log(`   Email: ${process.env.FIREBASE_CLIENT_EMAIL}`);

        // Check if already initialized
        const existingApps = admin.getApps();
        if (!existingApps || existingApps.length === 0) {
            console.log('   Initializing Firebase Admin SDK...');

            const privateKeyProcessed = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

            _app = admin.initializeApp({
                credential: admin.cert({
                    type: 'service_account',
                    project_id: process.env.FIREBASE_PROJECT_ID,
                    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                    private_key: privateKeyProcessed,
                    client_email: process.env.FIREBASE_CLIENT_EMAIL,
                    client_id: process.env.FIREBASE_CLIENT_ID,
                    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
                    token_uri: 'https://oauth2.googleapis.com/token',
                }),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
                databaseURL: process.env.FIREBASE_DATABASE_URL,
            });
            console.log('   ✅ Firebase Admin SDK app initialized');
        } else {
            _app = admin.app();
        }

        // Access services using modular API (firebase-admin v14+)
        console.log('   Initializing services...');
        db = getFirestore(_app);
        auth = getAuth(_app);
        bucket = getStorage(_app).bucket(process.env.FIREBASE_STORAGE_BUCKET);
        USE_FIREBASE = true;

        console.log('✅ Firebase successfully initialized!');
        console.log(`   Firestore: Ready`);
        console.log(`   Authentication: Ready`);
        console.log(`   Storage: ${process.env.FIREBASE_STORAGE_BUCKET}`);
        return true;
    } catch (err) {
        console.error('❌ Firebase initialization failed:', err.message);
        console.error('   Stack:', err.stack);
        throw err;
    }
};

// ── Initialize Firebase on module load ──────────────────────────
const credentialsPresent =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    !process.env.FIREBASE_PRIVATE_KEY.includes('REPLACE_WITH');

if (credentialsPresent) {
    try {
        initializeFirebase();
    } catch (err) {
        console.warn('⚠️  Firebase initialization failed:', err.message);
        console.warn('   Check your FIREBASE_* values in .env');
    }
} else {
    console.warn('⚠️  Firebase credentials not set — running in DEMO mode (in-memory, no persistence).');
    console.warn('   Open .env and fill in your FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, etc.');
}

// ── Demo store fallback ──────────────────────────────────────────
const _demo = require('./firebase-demo');

// ── Collections ─────────────────────────────────────────────────
const collections = {
    get users() { return USE_FIREBASE ? db.collection('users') : _demo.collections.users; },
    get contacts() { return USE_FIREBASE ? db.collection('contacts') : _demo.collections.contacts; },
    get donations() { return USE_FIREBASE ? db.collection('donations') : _demo.collections.donations; },
    get programs() { return USE_FIREBASE ? db.collection('programs') : _demo.collections.programs; },
    get campaigns() { return USE_FIREBASE ? db.collection('campaigns') : _demo.collections.campaigns; },
    get volunteers() { return USE_FIREBASE ? db.collection('volunteers') : _demo.collections.volunteers; },
    get activity() { return USE_FIREBASE ? db.collection('activity') : _demo.collections.activity; },
    get ongoingActivities() { return USE_FIREBASE ? db.collection('activities') : _demo.collections.ongoingActivities; },
    get media() { return USE_FIREBASE ? db.collection('media') : _demo.collections.media; },
};

// ── Storage bucket helper ───────────────────────────────────────
function ensureFirebaseStorage() {
    if (!USE_FIREBASE || !bucket) {
        throw new Error('Firebase Storage is required for file uploads. Ensure FIREBASE_STORAGE_BUCKET is configured in .env');
    }
    return bucket;
}

// ── Firestore helpers ───────────────────────────────────────────
const firestoreHelpers = {
    async batch(operations) {
        if (!USE_FIREBASE) throw new Error('Firebase not initialized');
        const batch = db.batch();
        operations.forEach(op => {
            const { type, collection, docId, data } = op;
            const docRef = db.collection(collection).doc(docId);
            if (type === 'set') batch.set(docRef, data);
            else if (type === 'update') batch.update(docRef, data);
            else if (type === 'delete') batch.delete(docRef);
        });
        return batch.commit();
    },

    async transaction(callback) {
        if (!USE_FIREBASE) throw new Error('Firebase not initialized');
        return db.runTransaction(callback);
    },

    query: (collectionName) => {
        if (!USE_FIREBASE) throw new Error('Firebase not initialized');
        return db.collection(collectionName);
    },
};

module.exports = {
    get admin() { return USE_FIREBASE ? admin : null; },
    get db() { return USE_FIREBASE ? db : null; },
    get auth() { return USE_FIREBASE ? auth : null; },
    get bucket() { return USE_FIREBASE ? bucket : null; },
    get USE_FIREBASE() { return USE_FIREBASE; },
    collections,
    ensureFirebaseStorage,
    firestoreHelpers,
    initializeFirebase,
};