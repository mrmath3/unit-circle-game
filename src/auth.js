/**
 * auth.js
 *
 * Google Sign-In using the Firebase Auth SDK (Google popup).
 *
 * SETUP REQUIRED:
 *   Add the Firebase project config values to .env.local:
 *     VITE_FIREBASE_API_KEY
 *     VITE_FIREBASE_AUTH_DOMAIN
 *     VITE_FIREBASE_PROJECT_ID
 *     VITE_FIREBASE_APP_ID
 *
 * Why Firebase instead of raw GIS:
 *   The website API (mr-sindel-math) verifies tokens with firebase-admin's
 *   verifyIdToken(), which requires a Firebase ID token — not a raw GIS credential.
 *   Using the Firebase SDK here ensures the token the game sends is exactly what
 *   the website backend expects.
 *
 * Public API (unchanged from previous version; game.js requires no edits):
 *   initAuth({ onSignIn, onSignOut })  — call once on load
 *   getAuthToken()                     — returns current Firebase ID token or null
 *   getCurrentUser()                   — returns { uid, name, email, picture } or null
 *   isSignedIn()                       — boolean
 *   signOut()                          — signs out and fires onSignOut callback
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

// ── Firebase config (from Vite env vars) ──────────────────────────────────────
const firebaseConfig = {
  apiKey:    import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:      import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseApp  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const firebaseAuth = getAuth(firebaseApp);

// ── Module state ──────────────────────────────────────────────────────────────
let _currentToken  = null;  // Firebase ID token (refreshed on demand)
let _currentUser   = null;  // { uid, name, email, picture }
let _firebaseUser  = null;  // raw Firebase User object (for token refresh)
let _onSignInCb    = null;
let _onSignOutCb   = null;

// ── Internal UI helper ────────────────────────────────────────────────────────

function updateSignInUI(signedIn) {
  const btnContainer = document.getElementById('googleSignInBtn');
  const userInfo     = document.getElementById('authUserInfo');
  const signOutBtn   = document.getElementById('signOutBtn');

  if (!btnContainer) return;

  if (signedIn && _currentUser) {
    btnContainer.style.display = 'none';
    if (userInfo) {
      userInfo.textContent   = `Signed in as ${_currentUser.name}`;
      userInfo.style.display = 'inline';
    }
    if (signOutBtn) signOutBtn.style.display = 'inline';
  } else {
    btnContainer.style.display = 'block';
    if (userInfo)    userInfo.style.display    = 'none';
    if (signOutBtn)  signOutBtn.style.display  = 'none';
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize Firebase Auth.
 * Call once from main.js after the page loads.
 * @param {{ onSignIn?: (user) => void, onSignOut?: () => void }} callbacks
 */
export function initAuth({ onSignIn, onSignOut } = {}) {
  _onSignInCb  = onSignIn  || null;
  _onSignOutCb = onSignOut || null;

  // Wire the sign-in button to trigger a Google popup
  const btn = document.getElementById('googleSignInBtn');
  if (btn) {
    // Replace the div with a real button so it's clickable immediately
    const signInBtn   = document.createElement('button');
    signInBtn.type    = 'button';
    signInBtn.textContent = 'Sign in with Google';
    signInBtn.id      = 'googleSignInBtnInner';
    btn.appendChild(signInBtn);
    signInBtn.addEventListener('click', () => {
      const provider = new GoogleAuthProvider();
      signInWithPopup(firebaseAuth, provider).catch(err => {
        console.error('[auth] Sign-in failed:', err.message);
      });
    });
  }

  // React to auth state changes (covers sign-in, sign-out, and page reload)
  onAuthStateChanged(firebaseAuth, async (fbUser) => {
    if (fbUser) {
      _firebaseUser = fbUser;
      _currentToken = await fbUser.getIdToken();
      _currentUser  = {
        uid:     fbUser.uid,
        name:    fbUser.displayName ?? fbUser.email ?? 'Player',
        email:   fbUser.email ?? '',
        picture: fbUser.photoURL ?? '',
      };
      updateSignInUI(true);
      if (_onSignInCb) _onSignInCb(_currentUser);
    } else {
      _firebaseUser  = null;
      _currentToken  = null;
      _currentUser   = null;
      updateSignInUI(false);
      if (_onSignOutCb) _onSignOutCb();
    }
  });
}

/** Returns the current user object, or null if not signed in. */
export function getCurrentUser() {
  return _currentUser;
}

/**
 * Returns a fresh Firebase ID token (auto-refreshed if near expiry), or null.
 * Always await this before submitting a score — Firebase tokens expire after 1 hour.
 */
export async function getAuthToken() {
  if (!_firebaseUser) return null;
  // getIdToken(true) forces a refresh if the token is near expiry
  _currentToken = await _firebaseUser.getIdToken();
  return _currentToken;
}

/** Returns true if the user is currently signed in. */
export function isSignedIn() {
  return _firebaseUser !== null;
}

/** Sign the user out. */
export async function signOut() {
  await firebaseSignOut(firebaseAuth);
  // onAuthStateChanged handles state cleanup and fires _onSignOutCb
}
