// auth-functions.js
// Extended authentication functions for Sponsor and Volunteer with Google OAuth

/* ── Sponsor Login & Register ─────────────────────────────────── */
function showSponsorRegisterForm() {
    document.getElementById('portal-sponsor-form').style.display = 'none';
    document.getElementById('portal-sponsor-register').style.display = 'block';
    document.getElementById('sponsor-reg-error').style.display = 'none';
    document.getElementById('sponsor-reg-name').value = '';
    document.getElementById('sponsor-reg-email').value = '';
    document.getElementById('sponsor-reg-password').value = '';
}

async function handleSponsorLogin() {
    const email = document.getElementById('sponsor-login-email').value.trim();
    const password = document.getElementById('sponsor-login-password').value;
    const errEl = document.getElementById('sponsor-login-error');
    const btnText = document.getElementById('sponsor-login-btn-text');

    if (!email || !password) {
        errEl.textContent = 'Please enter your email and password.';
        errEl.style.display = 'block';
        return;
    }

    btnText.textContent = 'Logging in…';
    const data = await apiCall('/auth/login', 'POST', { email, password });
    btnText.textContent = 'Log In →';

    if (!data.success) {
        errEl.textContent = data.message || 'Login failed. Please try again.';
        errEl.style.display = 'block';
        return;
    }

    const resolvedRole = authFlow.resolveDashboardRole(data.user?.role);
    if (resolvedRole !== 'sponsor') {
        errEl.textContent = 'This account is not registered as a sponsor.';
        errEl.style.display = 'block';
        return;
    }

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('madiva_token', authToken);
    localStorage.setItem('madiva_user', JSON.stringify(currentUser));

    closePortal();
    openDashboard(currentUser.role);
    showToast(`Welcome back, ${currentUser.name}! 💜`);
}

async function handleSponsorRegister() {
    const name = document.getElementById('sponsor-reg-name').value.trim();
    const email = document.getElementById('sponsor-reg-email').value.trim();
    const password = document.getElementById('sponsor-reg-password').value;
    const errEl = document.getElementById('sponsor-reg-error');
    const btnText = document.getElementById('sponsor-reg-btn-text');

    if (!name || !email || !password) {
        errEl.textContent = 'Please fill in all fields.';
        errEl.style.display = 'block';
        return;
    }

    if (password.length < 8) {
        errEl.textContent = 'Password must be at least 8 characters.';
        errEl.style.display = 'block';
        return;
    }

    btnText.textContent = 'Creating account…';
    const data = await apiCall('/auth/register', 'POST', { name, email, password, role: 'sponsor' });
    btnText.textContent = 'Create Account →';

    if (!data.success) {
        errEl.textContent = data.message || 'Registration failed. Please try again.';
        errEl.style.display = 'block';
        return;
    }

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('madiva_token', authToken);
    localStorage.setItem('madiva_user', JSON.stringify(currentUser));

    closePortal();
    openDashboard(currentUser.role);
    showToast(`Welcome to MADIVA CBO, ${currentUser.name}! 💜`);
}

/* ── Volunteer Login & Register ─────────────────────────────────── */
function showVolunteerRegisterForm() {
    document.getElementById('portal-volunteer-form').style.display = 'none';
    document.getElementById('portal-volunteer-register').style.display = 'block';
    document.getElementById('volunteer-reg-error').style.display = 'none';
    document.getElementById('volunteer-reg-name').value = '';
    document.getElementById('volunteer-reg-email').value = '';
    document.getElementById('volunteer-reg-password').value = '';
}

async function handleVolunteerLogin() {
    const email = document.getElementById('volunteer-login-email').value.trim();
    const password = document.getElementById('volunteer-login-password').value;
    const errEl = document.getElementById('volunteer-login-error');
    const btnText = document.getElementById('volunteer-login-btn-text');

    if (!email || !password) {
        errEl.textContent = 'Please enter your email and password.';
        errEl.style.display = 'block';
        return;
    }

    btnText.textContent = 'Logging in…';
    const data = await apiCall('/auth/login', 'POST', { email, password });
    btnText.textContent = 'Log In →';

    if (!data.success) {
        errEl.textContent = data.message || 'Login failed. Please try again.';
        errEl.style.display = 'block';
        return;
    }

    const resolvedRole = authFlow.resolveDashboardRole(data.user?.role);
    if (resolvedRole !== 'volunteer') {
        errEl.textContent = 'This account is not registered as a volunteer.';
        errEl.style.display = 'block';
        return;
    }

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('madiva_token', authToken);
    localStorage.setItem('madiva_user', JSON.stringify(currentUser));

    closePortal();
    openDashboard(currentUser.role);
    showToast(`Welcome back, ${currentUser.name}! 💜`);
}

async function handleVolunteerRegister() {
    const name = document.getElementById('volunteer-reg-name').value.trim();
    const email = document.getElementById('volunteer-reg-email').value.trim();
    const password = document.getElementById('volunteer-reg-password').value;
    const errEl = document.getElementById('volunteer-reg-error');
    const btnText = document.getElementById('volunteer-reg-btn-text');

    if (!name || !email || !password) {
        errEl.textContent = 'Please fill in all fields.';
        errEl.style.display = 'block';
        return;
    }

    if (password.length < 8) {
        errEl.textContent = 'Password must be at least 8 characters.';
        errEl.style.display = 'block';
        return;
    }

    btnText.textContent = 'Creating account…';
    const data = await apiCall('/auth/register', 'POST', { name, email, password, role: 'volunteer' });
    btnText.textContent = 'Create Account →';

    if (!data.success) {
        errEl.textContent = data.message || 'Registration failed. Please try again.';
        errEl.style.display = 'block';
        return;
    }

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('madiva_token', authToken);
    localStorage.setItem('madiva_user', JSON.stringify(currentUser));

    closePortal();
    openDashboard(currentUser.role);
    showToast(`Welcome to MADIVA CBO, ${currentUser.name}! 💜`);
}

/* ── Google OAuth Authentication ─────────────────────────────────── */
// These functions handle Google Sign-In integration using Firebase Auth.
async function ensureGoogleAuthReady() {
    if (window.firebaseAuthReady) return true;

    try {
        if (typeof initializeFirebase === 'function') {
            const initialized = await initializeFirebase();
            if (!initialized) {
                showToast('Firebase could not be initialized. Please refresh and try again.', 'error');
                return false;
            }
        }

        if (!window.firebase || !firebase.auth) {
            showToast('Firebase Auth is not available yet. Please refresh and try again.', 'error');
            return false;
        }

        const auth = firebase.auth();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        provider.setCustomParameters({ prompt: 'select_account' });

        window.firebaseAuthInstance = auth;
        window.googleAuthProvider = provider;
        window.firebaseAuthReady = true;
        return true;
    } catch (error) {
        console.error('Firebase Google auth setup failed:', error);
        showToast('Google sign-in could not be initialized.', 'error');
        return false;
    }
}

async function finalizeGoogleAuth(result, role) {
    const user = result?.user;
    if (!user) return;

    const googleId = user.providerData?.[0]?.uid || user.uid;
    const data = await apiCall('/auth/google/login', 'POST', {
        googleId,
        email: user.email,
        name: user.displayName || user.email,
        picture: user.photoURL,
        role,
    });

    if (!data.success) {
        showToast(data.message || 'Google sign-in failed.', 'error');
        return;
    }

    const authSession = authFlow.persistAuthSession(data.token, data.user);
    authToken = authSession?.token || data.token;
    currentUser = authSession?.user || data.user;
    currentUser = {
        ...currentUser,
        role: authFlow.resolveDashboardRole(currentUser?.role)
    };

    closePortal();
    openDashboard(currentUser.role);
    showToast(`Welcome to MADIVA CBO, ${currentUser.name}! 💜`);
}

async function signInWithGoogle(role) {
    if (!(await ensureGoogleAuthReady())) return;

    const auth = window.firebaseAuthInstance;
    const provider = window.googleAuthProvider;
    const buttonId = role === 'sponsor' ? 'sponsor-login-btn-text' : 'volunteer-login-btn-text';
    const button = document.getElementById(buttonId);
    if (button) button.textContent = 'Redirecting…';

    try {
        sessionStorage.setItem('pendingGoogleRole', role);
        await auth.signInWithRedirect(provider);
    } catch (error) {
        console.error('Google redirect sign-in failed:', error);
        const message = error?.code === 'auth/configuration-not-found' ?
            'Firebase Auth is not fully configured for this site. Add localhost and your app domain in Firebase Authentication > Settings > Authorized domains, then enable the Google provider.' :
            (error.message || 'Google sign-in could not be started.');
        showToast(message, 'error');
    } finally {
        if (button) button.textContent = 'Sign In →';
    }
}

async function handleRedirectGoogleAuth() {
    if (!(await ensureGoogleAuthReady())) return;

    try {
        const auth = window.firebaseAuthInstance;
        const result = await auth.getRedirectResult();
        const role = sessionStorage.getItem('pendingGoogleRole') || 'sponsor';
        if (result?.user) {
            sessionStorage.removeItem('pendingGoogleRole');
            await finalizeGoogleAuth(result, role);
        }
    } catch (error) {
        console.error('Redirect Google sign-in failed:', error);
        showToast(error.message || 'Google sign-in could not be completed.', 'error');
    }
}

async function initiateSponsorGoogleAuth() {
    await signInWithGoogle('sponsor');
}

async function initiateVolunteerGoogleAuth() {
    await signInWithGoogle('volunteer');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleRedirectGoogleAuth);
} else {
    handleRedirectGoogleAuth();
}

/**
 * Handle Google OAuth response for Sponsor
 * Call this after Google Sign-In returns an ID token
 */
async function handleGoogleAuthSponsor(googleToken) {
    await signInWithGoogle('sponsor');
}

/**
 * Handle Google OAuth response for Volunteer
 * Call this after Google Sign-In returns an ID token
 */
async function handleGoogleAuthVolunteer(googleToken) {
    await signInWithGoogle('volunteer');
}

/**
 * Simple JWT decoder (for client-side use only)
 * In production, always verify tokens on the backend
 */
function decodeJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Failed to decode JWT:', e);
        return null;
    }
}

/* ── Update showLoginForm to handle all roles ─────────────────────────────────── */
// Override the existing showLoginForm to handle Sponsor and Volunteer
function showLoginFormExtended(role) {
    currentRole = authFlow.resolveDashboardRole(role);
    document.getElementById('portal-role-select').style.display = 'none';
    document.getElementById('portal-login-form').style.display = 'none';
    document.getElementById('portal-sponsor-form').style.display = 'none';
    document.getElementById('portal-sponsor-register').style.display = 'none';
    document.getElementById('portal-volunteer-form').style.display = 'none';
    document.getElementById('portal-volunteer-register').style.display = 'none';

    if (currentRole === 'admin') {
        document.getElementById('portal-login-form').style.display = 'block';
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    } else if (currentRole === 'sponsor') {
        document.getElementById('portal-sponsor-form').style.display = 'block';
        document.getElementById('sponsor-login-error').style.display = 'none';
        document.getElementById('sponsor-login-email').value = '';
        document.getElementById('sponsor-login-password').value = '';
    } else if (currentRole === 'volunteer') {
        document.getElementById('portal-volunteer-form').style.display = 'block';
        document.getElementById('volunteer-login-error').style.display = 'none';
        document.getElementById('volunteer-login-email').value = '';
        document.getElementById('volunteer-login-password').value = '';
    }
}