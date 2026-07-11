// config/firebase-demo.js
// In-memory demo storage for development without Firebase credentials
// ⚠️  WARNING: Data is NOT persisted and will be lost on server restart
// ⚠️  This should NEVER be used in production

const memStore = {};
const memId = () => '_' + Math.random().toString(36).slice(2, 10) + Date.now();

const makeMemCollection = (name) => {
    if (!memStore[name]) memStore[name] = {};
    return {
        _name: name,

        doc(id) {
            const col = memStore[name];
            return {
                id,
                asyncget() {
                    return {
                        exists: !!col[id],
                        data: () => col[id] || {},
                        id
                    };
                },
                asyncset(v) {
                    col[id] = {...v, _createdAt: new Date().toISOString() };
                    return v;
                },
                async update(v) {
                    col[id] = {...(col[id] || {}), ...v };
                    return col[id];
                },
                async delete() {
                    delete col[id];
                },
            };
        },

        async add(data) {
            const id = memId();
            memStore[name][id] = {...data, _id: id, _createdAt: new Date().toISOString() };
            return { id };
        },

        where(field, op, val) {
            return makeQueryable(name, [{ field, op, val }]);
        },

        orderBy(field, dir) {
            return makeQueryable(name, [], { field, dir: dir || 'asc' });
        },

        asyncget() {
            const docs = Object.entries(memStore[name] || {})
                .map(([id, data]) => ({ id, data: () => data, exists: true }));
            return { docs, size: docs.length, empty: docs.length === 0 };
        },
    };
};

function makeQueryable(colName, filters = [], orderByOpt = null) {
    let _limit = 1000;

    const obj = {
        where(field, op, val) {
            filters.push({ field, op, val });
            return obj;
        },
        orderBy(field, dir) {
            orderByOpt = { field, dir: dir || 'asc' };
            return obj;
        },
        limit(n) {
            _limit = n;
            return obj;
        },
        asyncget() {
            let docs = Object.entries(memStore[colName] || {})
                .map(([id, data]) => ({ id, data: () => data, exists: true }));

            // Apply filters
            for (const f of filters) {
                docs = docs.filter(d => {
                    const v = d.data()[f.field];
                    if (f.op === '==') return v === f.val;
                    if (f.op === '!=') return v !== f.val;
                    if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(v);
                    return true;
                });
            }

            // Apply orderBy
            if (orderByOpt) {
                docs.sort((a, b) => {
                    const av = a.data()[orderByOpt.field] || '';
                    const bv = b.data()[orderByOpt.field] || '';
                    return orderByOpt.dir === 'desc' ?
                        (av < bv ? 1 : -1) :
                        (av > bv ? 1 : -1);
                });
            }

            docs = docs.slice(0, _limit);
            return { docs, size: docs.length, empty: docs.length === 0 };
        },
    };
    return obj;
}

// ── Collection factory ──────────────────────────────────────────
const makeCollection = (name) => makeMemCollection(name);

// ── Collections ─────────────────────────────────────────────────
const collections = {
    users: makeCollection('users'),
    contacts: makeCollection('contacts'),
    donations: makeCollection('donations'),
    programs: makeCollection('programs'),
    campaigns: makeCollection('campaigns'),
    volunteers: makeCollection('volunteers'),
    activity: makeCollection('activity'),
    ongoingActivities: makeCollection('ongoingActivities'),
    media: makeCollection('media'),
};

// ── Storage bucket (not available in demo mode) ──────────────────
function ensureFirebaseStorage() {
    throw new Error(
        'Firebase Storage is required for file uploads in production. ' +
        'Configure Firebase credentials in .env to enable media uploads.'
    );
}

module.exports = {
    admin: null,
    db: null,
    auth: null,
    bucket: null,
    collections,
    USE_FIREBASE: false,
    ensureFirebaseStorage,
};