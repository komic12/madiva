(function(root) {
    function normalizeRole(role) {
        return String(role || '').toLowerCase().trim();
    }

    function resolveDashboardRole(role) {
        const roleValue = role && typeof role === 'object' && 'role' in role ? role.role : role;
        const normalized = normalizeRole(roleValue);
        if (normalized === 'administrator') return 'admin';
        if (normalized === 'donor') return 'sponsor';
        if (normalized === 'member') return 'volunteer';
        return ['admin', 'sponsor', 'volunteer'].includes(normalized) ? normalized : 'admin';
    }

    function persistAuthSession(token, user) {
        if (!token || !user) return null;
        const normalizedUser = {...user, role: resolveDashboardRole(user ? .role) };
        localStorage.setItem('madiva_token', token);
        localStorage.setItem('madiva_user', JSON.stringify(normalizedUser));
        return { token, user: normalizedUser };
    }

    function readStoredAuth() {
        const token = localStorage.getItem('madiva_token');
        const storedUser = localStorage.getItem('madiva_user');
        let user = null;

        try {
            user = storedUser ? JSON.parse(storedUser) : null;
        } catch (error) {
            user = null;
        }

        return {
            token,
            user: user ? {...user, role: resolveDashboardRole(user ? .role) } : null,
        };
    }

    const api = {
        normalizeRole,
        resolveDashboardRole,
        persistAuthSession,
        readStoredAuth,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.authFlow = api;
})(typeof window !== 'undefined' ? window : globalThis);