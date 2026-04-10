/**
 * main.js — Vite entry point
 *
 * Responsibilities:
 *   1. Import styles (Vite bundles these)
 *   2. Initialize the game
 *   3. Initialize Firebase Auth (synchronous import — no polling needed)
 */

import './style.css';
import { initGame, onUserSignedIn, onUserSignedOut } from './game.js';
import { initAuth } from './auth.js';

// Initialize the game immediately (SVG injection, local scores, etc.)
initGame();

// Firebase Auth initializes from the ES module import; no SDK polling needed.
// onAuthStateChanged inside initAuth() fires automatically on page load.
initAuth({
  onSignIn:  onUserSignedIn,
  onSignOut: onUserSignedOut,
});
