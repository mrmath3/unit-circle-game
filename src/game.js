/**
 * game.js
 *
 * NOTE: This module uses Vite's `?raw` import to inline unit-circle.svg
 * as a string at build time. The SVG is injected into #svgWrapper before
 * the interactive circles are appended. If the SVG file changes, this
 * automatically picks up the new content on next build.
 *
 * Core game logic for the Unit Circle Click Game.
 *
 * Imports angle data from angles.js.
 * Calls auth.js and api.js for public leaderboard integration
 * (those calls are no-ops when the user is not signed in).
 */

import { ANGLE_KEYS, POINTS_LEGACY } from './angles.js';

import svgContent from '../unit-circle.svg?raw';

import { isSignedIn, getAuthToken, signOut } from './auth.js';
import { submitScore, fetchLeaderboard } from './api.js';

// ── Game state ────────────────────────────────────────────────────────────────
let currentAngle   = '';
let correctCount   = 0;
let totalCount     = 0;
let started        = false;
let timerID        = null;
let timeLeft       = 30;

// ── DOM references (resolved in initGame) ────────────────────────────────────
let promptDiv, feedbackDiv, startMsg, timer, resetBtn;
let ding, buzz;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick a new random angle, never repeating the previous one. */
function newPrompt() {
  const options = [...ANGLE_KEYS];
  let next;
  do {
    next = options[Math.floor(Math.random() * options.length)];
  } while (next === currentAngle && options.length > 1);

  currentAngle = next;
  promptDiv.innerHTML = `Click on \\(${currentAngle}\\)`;
  window.MathJax?.typesetPromise([promptDiv]).catch(console.error);
}

function updateTimerDisplay() {
  timer.textContent = `Time Left: ${timeLeft.toFixed(1)}s`;
}

// ── Public leaderboard ────────────────────────────────────────────────────────
let activePeriod = 'all_time';

function renderPublicLeaderboard(entries) {
  const tbody = document.querySelector('#publicScores tbody');
  const status = document.getElementById('publicLeaderboardStatus');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!entries || entries.length === 0) {
    if (status) status.textContent = 'No public scores yet.';
    return;
  }

  if (status) status.textContent = '';
  entries.forEach((entry, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${entry.displayName ?? entry.display_name}</td>
      <td>${entry.bestCorrect ?? entry.best_correct}</td>
      <td>${parseFloat(entry.accuracy).toFixed(1)}%</td>
      <td>${entry.gamesPlayed ?? entry.games_played}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadPublicLeaderboard(period = activePeriod) {
  activePeriod = period;

  // Update tab active state
  document.getElementById('tabAllTime')?.classList.toggle('active', period === 'all_time');
  document.getElementById('tabMonthly')?.classList.toggle('active', period === 'monthly');

  const status = document.getElementById('publicLeaderboardStatus');
  if (status) status.textContent = 'Loading…';

  try {
    const entries = await fetchLeaderboard({ period, gameMode: 'radian_location' });
    renderPublicLeaderboard(entries);
  } catch (err) {
    if (status) status.textContent = 'Public leaderboard unavailable (API not configured yet).';
    console.info('[api] Public leaderboard not available:', err.message);
  }
}

// ── Game lifecycle ────────────────────────────────────────────────────────────

async function endGame() {
  clearInterval(timerID);
  timer.textContent = "Time's up!";

  // Submit to public board if signed in
  if (isSignedIn()) {
    try {
      await submitScore({
        idToken:     await getAuthToken(),
        correctCount,
        totalCount,
        gameMode:    'radian_location',
        modeVariant: null,
        durationSec: 30,
      });
      // Refresh the public board after a successful submission
      await loadPublicLeaderboard(activePeriod);
    } catch (err) {
      console.warn('[api] Score submission failed:', err.message);
    }
  }

  resetBtn.style.display = 'none';
  started = false;
}

function startGame() {
  started      = true;
  correctCount = 0;
  totalCount   = 0;
  timeLeft     = 30;

  startMsg.style.display = 'none';
  resetBtn.style.display = 'inline';
  updateTimerDisplay();

  timerID = setInterval(() => {
    timeLeft -= 0.1;
    updateTimerDisplay();
    if (timeLeft <= 0) endGame();
  }, 100);
}

// ── SVG click handler ─────────────────────────────────────────────────────────

function handleAngleClick(clickedLatex) {
  if (!started) startGame();
  totalCount++;

  if (clickedLatex === currentAngle) {
    correctCount++;
    feedbackDiv.innerHTML = `✅ You correctly clicked \\(${currentAngle}\\)`;
    ding.currentTime = 0;
    ding.play();
    window.MathJax?.typesetPromise([feedbackDiv]).then(newPrompt).catch(console.error);
  } else {
    feedbackDiv.innerHTML =
      `❌ Incorrect. You clicked \\(${clickedLatex}\\) instead of \\(${currentAngle}\\)`;
    buzz.currentTime = 0;
    buzz.play();
    window.MathJax?.typesetPromise([feedbackDiv]).catch(console.error);
  }
}

// ── SVG initialization ────────────────────────────────────────────────────────

function buildSvgClickTargets() {
  const wrapper = document.getElementById('svgWrapper');
  if (!wrapper) return;

  // Inject the SVG if it hasn't been injected yet
  if (!wrapper.querySelector('svg')) {
    wrapper.innerHTML = svgContent;
  }

  const svg = wrapper.querySelector('svg');
  if (!svg) return;

  // Remove any previously injected circles (safe to re-call)
  svg.querySelectorAll('circle[data-angle]').forEach((el) => el.remove());

  for (const [latex, { x, y }] of Object.entries(POINTS_LEGACY)) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 15);
    circle.setAttribute('fill', 'white');
    circle.setAttribute('stroke', 'black');
    circle.setAttribute('data-angle', latex);
    circle.addEventListener('click', () => handleAngleClick(latex));
    svg.appendChild(circle);
  }
}

// ── Public init ───────────────────────────────────────────────────────────────

/**
 * Initialize the game. Called once from main.js after DOM is ready.
 */
export function initGame() {
  promptDiv   = document.getElementById('prompt');
  feedbackDiv = document.getElementById('feedback');
  startMsg    = document.getElementById('startMsg');
  timer       = document.getElementById('timer');
  resetBtn    = document.getElementById('resetBtn');
  ding        = document.getElementById('ding');
  buzz        = document.getElementById('buzz');

  // Reset button
  resetBtn?.addEventListener('click', () => {
    clearInterval(timerID);
    timer.textContent       = 'Game reset.';
    feedbackDiv.textContent = '';
    resetBtn.style.display  = 'none';
    started = false;
  });

  // Public leaderboard period tabs
  document.getElementById('tabAllTime')?.addEventListener('click', () => loadPublicLeaderboard('all_time'));
  document.getElementById('tabMonthly')?.addEventListener('click', () => loadPublicLeaderboard('monthly'));

  document.getElementById('signOutBtn')?.addEventListener('click', () => signOut());

  // Build SVG clickable points
  buildSvgClickTargets();

  // Initial prompt
  newPrompt();

  // Load public board (will show 'unavailable' until API is configured — graceful)
  loadPublicLeaderboard('all_time');

  // Typeset the initial prompt once MathJax is ready
  window.MathJax?.typesetPromise([promptDiv]).catch(console.error);
}

/** Called by main.js after a successful Google sign-in. */
export function onUserSignedIn(user) {
  console.info(`[game] Signed in as ${user.name}`);
  loadPublicLeaderboard(activePeriod);
}

/** Called by main.js after sign-out. */
export function onUserSignedOut() {
  console.info('[game] Signed out');
}
