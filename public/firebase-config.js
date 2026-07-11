// ══════════════════════════════════════════════════════════════
//  FIREBASE REALTIME DATABASE CONFIGURATION
//  Enables real-time data synchronization for MADIVA CBO
// ══════════════════════════════════════════════════════════════

// Firebase Configuration (Web SDK) — MADIVA CBO Production Project
const DEFAULT_FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDftMiCPANTomqr8c6_X9zL8B5taihaWz0",
  authDomain:        "madiva-cbo-e4cc8.firebaseapp.com",
  databaseURL:       "https://madiva-cbo-e4cc8-default-rtdb.firebaseio.com",
  projectId:         "madiva-cbo-e4cc8",
  storageBucket:     "madiva-cbo-e4cc8.firebasestorage.app",
  messagingSenderId: "951815691601",
  appId:             "1:951815691601:web:164528e3ffb64099cc8770",
  measurementId:     "G-N54SCWDJEJ"
};

// Initialize Firebase (will be called after SDK loads)
let firebaseApp = null;
let realtimeDb = null;
let firebaseReady = false;
let firebaseConfig = DEFAULT_FIREBASE_CONFIG;
let firebaseInitPromise = null;

async function loadFirebaseConfigFromServer() {
  try {
    const response = await fetch('/api/firebase-config', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data?.success && data.config) return data.config;
  } catch (error) {
    console.warn('⚠️ Falling back to bundled Firebase config:', error.message);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

// Initialize Firebase after SDK is loaded
async function initializeFirebase() {
  if (firebaseInitPromise) return firebaseInitPromise;

  firebaseInitPromise = (async () => {
    try {
      const resolvedConfig = await loadFirebaseConfigFromServer();
      firebaseConfig = resolvedConfig;

      const existingApps = firebase.apps || [];
      const existingApp = existingApps[0];
      const needsReinit = existingApp && (
        existingApp.options?.authDomain !== firebaseConfig.authDomain ||
        existingApp.options?.projectId !== firebaseConfig.projectId
      );

      if (needsReinit) {
        await existingApp.delete();
        console.log('♻️ Reinitializing Firebase app with updated configuration.');
      }

      if (firebase.apps && firebase.apps.length > 0) {
        firebaseApp = firebase.app();
      } else {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      }

      realtimeDb = firebase.database();
      firebaseReady = true;
      console.log('✅ Firebase Realtime Database initialised — project:', firebaseConfig.projectId);
      return true;
    } catch (error) {
      console.error('❌ Firebase initialisation failed:', error);
      firebaseReady = false;
      return false;
    }
  })();

  return firebaseInitPromise;
}

// ══════════════════════════════════════════════════════════════
//  REALTIME DATABASE LISTENERS
// ══════════════════════════════════════════════════════════════

// Global listeners storage to manage subscriptions
const activeListeners = {};

/**
 * Subscribe to real-time updates for a specific collection
 * @param {string} collection - Collection name (donations, media, volunteers, activity, users)
 * @param {function} callback - Function to call when data changes
 * @param {object} options - Query options (limit, orderBy, etc.)
 */
function subscribeToCollection(collection, callback, options = {}) {
  if (!firebaseReady) {
    console.warn('Firebase not ready. Falling back to REST API.');
    return null;
  }

  try {
    let ref = realtimeDb.ref(collection);

    // Apply ordering if specified
    if (options.orderBy) {
      ref = ref.orderByChild(options.orderBy);
    }

    // Apply limit if specified
    if (options.limit) {
      ref = ref.limitToLast(options.limit);
    }

    // Set up real-time listener
    const listener = ref.on('value', (snapshot) => {
      const data = snapshot.val();
      const items = [];

      if (data) {
        Object.keys(data).forEach(key => {
          items.push({
            id: key,
            ...data[key]
          });
        });
      }

      // Reverse to show newest first
      items.reverse();
      callback(items);
    }, (error) => {
      console.error(`Error listening to ${collection}:`, error);
    });

    // Store listener reference for cleanup
    activeListeners[collection] = { ref, listener };

    return listener;
  } catch (error) {
    console.error(`Failed to subscribe to ${collection}:`, error);
    return null;
  }
}

/**
 * Subscribe to a specific document
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @param {function} callback - Function to call when data changes
 */
function subscribeToDocument(collection, docId, callback) {
  if (!firebaseReady) {
    console.warn('Firebase not ready. Falling back to REST API.');
    return null;
  }

  try {
    const ref = realtimeDb.ref(`${collection}/${docId}`);

    const listener = ref.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback({
          id: docId,
          ...data
        });
      }
    }, (error) => {
      console.error(`Error listening to ${collection}/${docId}:`, error);
    });

    activeListeners[`${collection}/${docId}`] = { ref, listener };

    return listener;
  } catch (error) {
    console.error(`Failed to subscribe to ${collection}/${docId}:`, error);
    return null;
  }
}

/**
 * Unsubscribe from a collection
 * @param {string} collection - Collection name
 */
function unsubscribeFromCollection(collection) {
  if (activeListeners[collection]) {
    const { ref } = activeListeners[collection];
    ref.off();
    delete activeListeners[collection];
    console.log(`Unsubscribed from ${collection}`);
  }
}

/**
 * Write data to Realtime Database
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @param {object} data - Data to write
 */
function writeToDatabase(collection, docId, data) {
  if (!firebaseReady) {
    console.warn('Firebase not ready. Cannot write data.');
    return Promise.reject(new Error('Firebase not ready'));
  }

  return realtimeDb.ref(`${collection}/${docId}`).set(data)
    .then(() => {
      console.log(`✅ Data written to ${collection}/${docId}`);
      return { success: true };
    })
    .catch((error) => {
      console.error(`❌ Error writing to ${collection}/${docId}:`, error);
      return { success: false, error };
    });
}

/**
 * Update specific fields in a document
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @param {object} updates - Fields to update
 */
function updateInDatabase(collection, docId, updates) {
  if (!firebaseReady) {
    console.warn('Firebase not ready. Cannot update data.');
    return Promise.reject(new Error('Firebase not ready'));
  }

  return realtimeDb.ref(`${collection}/${docId}`).update(updates)
    .then(() => {
      console.log(`✅ Data updated in ${collection}/${docId}`);
      return { success: true };
    })
    .catch((error) => {
      console.error(`❌ Error updating ${collection}/${docId}:`, error);
      return { success: false, error };
    });
}

/**
 * Delete a document from Realtime Database
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 */
function deleteFromDatabase(collection, docId) {
  if (!firebaseReady) {
    console.warn('Firebase not ready. Cannot delete data.');
    return Promise.reject(new Error('Firebase not ready'));
  }

  return realtimeDb.ref(`${collection}/${docId}`).remove()
    .then(() => {
      console.log(`✅ Data deleted from ${collection}/${docId}`);
      return { success: true };
    })
    .catch((error) => {
      console.error(`❌ Error deleting from ${collection}/${docId}:`, error);
      return { success: false, error };
    });
}

/**
 * Get a single value (one-time read)
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID (optional)
 */
function getFromDatabase(collection, docId = null) {
  if (!firebaseReady) {
    console.warn('Firebase not ready. Cannot read data.');
    return Promise.reject(new Error('Firebase not ready'));
  }

  const ref = docId 
    ? realtimeDb.ref(`${collection}/${docId}`)
    : realtimeDb.ref(collection);

  return ref.once('value')
    .then((snapshot) => {
      return snapshot.val();
    })
    .catch((error) => {
      console.error(`Error reading from ${collection}:`, error);
      return null;
    });
}

/**
 * Clean up all listeners
 */
function cleanupAllListeners() {
  Object.keys(activeListeners).forEach(key => {
    const { ref } = activeListeners[key];
    ref.off();
  });
  for (const key in activeListeners) delete activeListeners[key];
  console.log('All Firebase listeners cleaned up');
}

// Export functions for use in main script
window.firebaseRealtimeDB = {
  initializeFirebase,
  subscribeToCollection,
  subscribeToDocument,
  unsubscribeFromCollection,
  writeToDatabase,
  updateInDatabase,
  deleteFromDatabase,
  getFromDatabase,
  cleanupAllListeners,
  isReady: () => firebaseReady
};
