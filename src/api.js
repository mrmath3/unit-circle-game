/**
 * api.js
 *
 * Public leaderboard API client.
 *
 * SETUP REQUIRED:
 *   Replace API_BASE_URL with the full URL of your website's API endpoint.
 *   The server must implement:
 *     POST /api/games/unit-circle/scores   — submit a score
 *     GET  /api/games/unit-circle/scores   — fetch leaderboard
 *
 * The server validates the Google ID token on every POST, so scores can't be
 * fabricated client-side.
 */

// ── Configuration ─────────────────────────────────────────────────────────────
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'https://mrsindelmath.com/api/games/unit-circle';

// ── Score submission ──────────────────────────────────────────────────────────

/**
 * Submit a completed game score to the public leaderboard.
 *
 * @param {object} params
 * @param {string} params.idToken        — Google ID token from getAuthToken()
 * @param {number} params.correctCount   — number of correct answers
 * @param {number} params.totalCount     — total answers attempted
 * @param {string} params.gameMode       — e.g. 'radian_location'
 * @param {string} [params.modeVariant]  — e.g. 'alternate_angles_enabled'
 * @param {number} [params.durationSec]  — game duration in seconds (default 30)
 * @returns {Promise<{ success: boolean, displayName: string, rank?: number }>}
 */
export async function submitScore({
  idToken,
  correctCount,
  totalCount,
  gameMode     = 'radian_location',
  modeVariant  = null,
  durationSec  = 30,
}) {
  const accuracy = totalCount > 0
    ? parseFloat(((correctCount / totalCount) * 100).toFixed(2))
    : 0;

  const res = await fetch(`${API_BASE_URL}/scores`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      correct_count: correctCount,
      total_count:   totalCount,
      accuracy,
      game_mode:     gameMode,
      mode_variant:  modeVariant,
      duration_sec:  durationSec,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Score submission failed (${res.status})`);
  }

  return res.json();
}

// ── Leaderboard fetch ─────────────────────────────────────────────────────────

/**
 * Fetch the public leaderboard.
 *
 * @param {object} [params]
 * @param {'all_time'|'monthly'} [params.period]   — default 'all_time'
 * @param {string}               [params.gameMode]  — filter by mode; default 'radian_location'
 * @param {number}               [params.limit]     — number of entries; default 10
 * @returns {Promise<Array<{ rank, displayName, bestCorrect, accuracy, gamesPlayed }>>}
 */
export async function fetchLeaderboard({
  period   = 'all_time',
  gameMode = 'radian_location',
  limit    = 10,
} = {}) {
  const params = new URLSearchParams({ period, game_mode: gameMode, limit });
  const res = await fetch(`${API_BASE_URL}/scores?${params}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to load leaderboard (${res.status})`);
  }

  return res.json(); // expected: Array<LeaderboardEntry>
}
