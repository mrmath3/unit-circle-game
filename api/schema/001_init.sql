-- ─────────────────────────────────────────────────────────────────────────────
-- 001_init.sql  —  Unit Circle Game leaderboard schema (Cloudflare D1 / SQLite)
-- Apply with:
--   npx wrangler d1 execute unit-circle-db --local  --file schema/001_init.sql
--   npx wrangler d1 execute unit-circle-db --remote --file schema/001_init.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- One canonical row per Google account.
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id    TEXT    NOT NULL UNIQUE,          -- JWT `sub` claim (stable forever)
  email        TEXT    NOT NULL,
  display_name TEXT    NOT NULL,                 -- JWT `name`, trimmed, max 50 chars
  is_banned    INTEGER NOT NULL DEFAULT 0,       -- 1 = banned; blocks submit + hides from board
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per completed game that the user chose to submit publicly.
CREATE TABLE IF NOT EXISTS scores (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
  total_count   INTEGER NOT NULL CHECK (total_count  >= 0),
  accuracy_pct  REAL    NOT NULL CHECK (accuracy_pct BETWEEN 0 AND 100),
  game_mode     TEXT    NOT NULL DEFAULT 'radian_location',
  mode_variant  TEXT,                            -- e.g. 'alternate_angles_enabled'
  duration_sec  INTEGER NOT NULL DEFAULT 30,
  month_bucket  TEXT    NOT NULL,                -- 'YYYY-MM', derived server-side
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),

  -- Moderation fields (soft controls — rows are never hard-deleted via API)
  hidden_at     TEXT,                            -- admin hides from leaderboard
  deleted_at    TEXT                             -- admin soft-deletes (strongest)
);

-- Leaderboard query indexes
CREATE INDEX IF NOT EXISTS idx_scores_game_mode
  ON scores (game_mode, deleted_at, hidden_at);

CREATE INDEX IF NOT EXISTS idx_scores_month_bucket
  ON scores (month_bucket, game_mode, deleted_at, hidden_at);

CREATE INDEX IF NOT EXISTS idx_scores_user_id
  ON scores (user_id);

CREATE INDEX IF NOT EXISTS idx_users_google_id
  ON users (google_id);
