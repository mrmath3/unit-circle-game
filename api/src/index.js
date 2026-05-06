/**
 * src/index.js — Unit Circle Game leaderboard Worker
 *
 * Routes:
 *   POST   /api/games/unit-circle/scores               — submit a score (auth required)
 *   GET    /api/games/unit-circle/scores               — fetch leaderboard (public)
 *   DELETE /api/games/unit-circle/scores/:id           — soft-delete a score (admin)
 *   PATCH  /api/games/unit-circle/scores/:id/hide      — hide a score (admin)
 *   PATCH  /api/games/unit-circle/users/:gid/ban       — ban a user (admin)
 *
 * Env bindings (set via wrangler.toml + secrets):
 *   env.DB              — D1 database
 *   env.GOOGLE_CLIENT_ID — used to validate `aud` on ID tokens
 *   env.ADMIN_SECRET    — bearer secret for moderation routes
 *   env.ALLOWED_ORIGINS — comma-separated CORS origins
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const LEADERBOARD_MAX_LIMIT = 100;
const DISPLAY_NAME_MAX_LEN  = 50;

// ── CORS helpers ───────────────────────────────────────────────────────────────

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin  = request.headers.get('Origin') || '';
  const allowed = getAllowedOrigins(env);
  const isOk    = allowed.includes(origin) || allowed.includes('*');
  return {
    'Access-Control-Allow-Origin':  isOk ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Secret',
    'Access-Control-Max-Age':       '86400',
  };
}

function response(body, status = 200, extra = {}) {
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...extra,
      },
    }
  );
}

// ── Google token verification ──────────────────────────────────────────────────

/**
 * Verify an ID token by calling Google's tokeninfo endpoint.
 * Returns the token payload on success, throws on failure.
 *
 * Note: tokeninfo is simple and reliable for server-side verification without
 * additional libraries. For high-throughput production use, switch to
 * Google Auth Library or verify the JWT signature locally.
 */
async function verifyGoogleToken(idToken, clientId) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res  = await fetch(url);

  if (!res.ok) {
    throw new Error('Google token verification failed');
  }

  const payload = await res.json();

  if (payload.error_description) {
    throw new Error(`Invalid token: ${payload.error_description}`);
  }

  if (payload.aud !== clientId) {
    throw new Error('Token audience mismatch');
  }

  // Require name + sub (google_id) to be present
  if (!payload.sub || !payload.email) {
    throw new Error('Token missing required fields');
  }

  return payload; // { sub, email, name, picture, ... }
}

// ── Auth middleware helper ─────────────────────────────────────────────────────

async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing Authorization header' };
  }
  const token = authHeader.slice(7).trim();

  let payload;
  try {
    payload = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID);
  } catch (err) {
    throw { status: 401, message: err.message || 'Invalid token' };
  }

  return payload; // Google JWT payload
}

function requireAdmin(request, env) {
  const secret = request.headers.get('X-Admin-Secret');
  if (!secret || secret !== env.ADMIN_SECRET) {
    throw { status: 403, message: 'Forbidden — invalid admin secret' };
  }
}

// ── User upsert ────────────────────────────────────────────────────────────────

async function upsertUser(db, googlePayload) {
  const google_id    = googlePayload.sub;
  const email        = googlePayload.email || '';
  const display_name = (googlePayload.name || email).slice(0, DISPLAY_NAME_MAX_LEN).trim();

  // Try to find existing user
  const existing = await db
    .prepare('SELECT id, is_banned, display_name FROM users WHERE google_id = ?')
    .bind(google_id)
    .first();

  if (existing) {
    // Update display_name + email in case they changed on Google's side
    await db
      .prepare('UPDATE users SET display_name = ?, email = ? WHERE google_id = ?')
      .bind(display_name, email, google_id)
      .run();
    return { ...existing, display_name };
  }

  // Insert new user
  const result = await db
    .prepare('INSERT INTO users (google_id, email, display_name) VALUES (?, ?, ?)')
    .bind(google_id, email, display_name)
    .run();

  return {
    id:           result.meta.last_row_id,
    google_id,
    is_banned:    0,
    display_name,
  };
}

// ── Current month bucket ───────────────────────────────────────────────────────

function monthBucket() {
  const now = new Date();
  const y   = now.getUTCFullYear();
  const m   = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ── Route handlers ─────────────────────────────────────────────────────────────

// POST /api/games/unit-circle/scores
async function handlePostScore(request, env, corsHdrs) {
  const googlePayload = await requireAuth(request, env);

  let body;
  try {
    body = await request.json();
  } catch {
    return response({ message: 'Invalid JSON body' }, 400, corsHdrs);
  }

  const { correct_count, total_count, accuracy, game_mode, mode_variant, duration_sec } = body;

  // Basic validation
  if (
    typeof correct_count !== 'number' || correct_count < 0 ||
    typeof total_count   !== 'number' || total_count   < 0 ||
    correct_count > total_count
  ) {
    return response({ message: 'Invalid score values' }, 422, corsHdrs);
  }

  const accuracyPct  = typeof accuracy === 'number'
    ? Math.min(100, Math.max(0, parseFloat(accuracy.toFixed(2))))
    : total_count > 0 ? parseFloat(((correct_count / total_count) * 100).toFixed(2)) : 0;
  const gm           = typeof game_mode    === 'string' ? game_mode    : 'radian_location';
  const mv           = typeof mode_variant === 'string' ? mode_variant : null;
  const dur          = typeof duration_sec === 'number' ? Math.abs(Math.floor(duration_sec)) : 30;

  // Upsert user
  const user = await upsertUser(env.DB, googlePayload);

  if (user.is_banned) {
    return response({ message: 'Account is banned' }, 403, corsHdrs);
  }

  // Insert score
  await env.DB
    .prepare(`
      INSERT INTO scores
        (user_id, correct_count, total_count, accuracy_pct, game_mode, mode_variant, duration_sec, month_bucket)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(user.id, correct_count, total_count, accuracyPct, gm, mv, dur, monthBucket())
    .run();

  // Compute rough rank (all-time, same game mode)
  const rankResult = await env.DB
    .prepare(`
      SELECT COUNT(DISTINCT user_id) + 1 AS rank
      FROM scores
      WHERE game_mode   = ?
        AND deleted_at  IS NULL
        AND hidden_at   IS NULL
        AND correct_count > ?
        AND user_id IN (SELECT id FROM users WHERE is_banned = 0)
    `)
    .bind(gm, correct_count)
    .first();

  return response({
    success:     true,
    displayName: user.display_name,
    rank:        rankResult?.rank ?? null,
  }, 201, corsHdrs);
}

// GET /api/games/unit-circle/scores
async function handleGetScores(request, env, corsHdrs) {
  const url      = new URL(request.url);
  const period   = url.searchParams.get('period')    || 'all_time';
  const gameMode = url.searchParams.get('game_mode') || 'radian_location';
  const limit    = Math.min(
    parseInt(url.searchParams.get('limit') || '10', 10) || 10,
    LEADERBOARD_MAX_LIMIT
  );

  const baseWhere = `
    WHERE s.game_mode  = ?
      AND s.deleted_at IS NULL
      AND s.hidden_at  IS NULL
      AND u.is_banned  = 0
  `;

  let sql, bindings;

  if (period === 'monthly') {
    sql = `
      SELECT
        u.display_name                          AS displayName,
        MAX(s.correct_count)                    AS bestCorrect,
        ROUND(AVG(s.accuracy_pct), 2)           AS accuracy,
        COUNT(*)                                AS gamesPlayed
      FROM scores s
      JOIN users u ON u.id = s.user_id
      ${baseWhere}
        AND s.month_bucket = ?
      GROUP BY s.user_id
      ORDER BY bestCorrect DESC, accuracy DESC
      LIMIT ?
    `;
    bindings = [gameMode, monthBucket(), limit];
  } else {
    // all_time
    sql = `
      SELECT
        u.display_name                          AS displayName,
        MAX(s.correct_count)                    AS bestCorrect,
        ROUND(AVG(s.accuracy_pct), 2)           AS accuracy,
        COUNT(*)                                AS gamesPlayed
      FROM scores s
      JOIN users u ON u.id = s.user_id
      ${baseWhere}
      GROUP BY s.user_id
      ORDER BY bestCorrect DESC, accuracy DESC
      LIMIT ?
    `;
    bindings = [gameMode, limit];
  }

  const { results } = await env.DB.prepare(sql).bind(...bindings).all();

  // Add rank numbers
  const ranked = results.map((row, i) => ({ rank: i + 1, ...row }));

  return response(ranked, 200, corsHdrs);
}

// DELETE /api/games/unit-circle/scores/:id
async function handleDeleteScore(request, env, corsHdrs, id) {
  requireAdmin(request, env);

  const result = await env.DB
    .prepare(`UPDATE scores SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`)
    .bind(Number(id))
    .run();

  if (result.meta.changes === 0) {
    return response({ message: 'Score not found or already deleted' }, 404, corsHdrs);
  }

  return response({ success: true, id: Number(id) }, 200, corsHdrs);
}

// PATCH /api/games/unit-circle/scores/:id/hide
async function handleHideScore(request, env, corsHdrs, id) {
  requireAdmin(request, env);

  const result = await env.DB
    .prepare(`UPDATE scores SET hidden_at = datetime('now') WHERE id = ? AND hidden_at IS NULL`)
    .bind(Number(id))
    .run();

  if (result.meta.changes === 0) {
    return response({ message: 'Score not found or already hidden' }, 404, corsHdrs);
  }

  return response({ success: true, id: Number(id) }, 200, corsHdrs);
}

// PATCH /api/games/unit-circle/users/:google_id/ban
async function handleBanUser(request, env, corsHdrs, google_id) {
  requireAdmin(request, env);

  const result = await env.DB
    .prepare(`UPDATE users SET is_banned = 1 WHERE google_id = ?`)
    .bind(google_id)
    .run();

  if (result.meta.changes === 0) {
    return response({ message: 'User not found' }, 404, corsHdrs);
  }

  return response({ success: true, google_id }, 200, corsHdrs);
}

// ── Router ─────────────────────────────────────────────────────────────────────

const BASE = '/api/games/unit-circle';

export default {
  async fetch(request, env) {
    const corsHdrs = corsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHdrs });
    }

    const url      = new URL(request.url);
    const path     = url.pathname;
    const method   = request.method;

    try {
      // POST /scores
      if (method === 'POST' && path === `${BASE}/scores`) {
        return await handlePostScore(request, env, corsHdrs);
      }

      // GET /scores
      if (method === 'GET' && path === `${BASE}/scores`) {
        return await handleGetScores(request, env, corsHdrs);
      }

      // DELETE /scores/:id
      const deleteMatch = path.match(/^\/api\/games\/unit-circle\/scores\/(\d+)$/);
      if (method === 'DELETE' && deleteMatch) {
        return await handleDeleteScore(request, env, corsHdrs, deleteMatch[1]);
      }

      // PATCH /scores/:id/hide
      const hideMatch = path.match(/^\/api\/games\/unit-circle\/scores\/(\d+)\/hide$/);
      if (method === 'PATCH' && hideMatch) {
        return await handleHideScore(request, env, corsHdrs, hideMatch[1]);
      }

      // PATCH /users/:google_id/ban
      const banMatch = path.match(/^\/api\/games\/unit-circle\/users\/(.+)\/ban$/);
      if (method === 'PATCH' && banMatch) {
        return await handleBanUser(request, env, corsHdrs, banMatch[1]);
      }

      return response({ message: 'Not found' }, 404, corsHdrs);

    } catch (err) {
      // Structured throws from requireAuth / requireAdmin
      if (err && err.status) {
        return response({ message: err.message }, err.status, corsHdrs);
      }
      // Unexpected errors
      console.error('[worker] Unhandled error:', err);
      return response({ message: 'Internal server error' }, 500, corsHdrs);
    }
  },
};
