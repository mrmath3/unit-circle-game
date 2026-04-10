/**
 * angles.js
 *
 * Single source of truth for all unit circle angle data.
 *
 * Each canonical angle carries:
 *   latex     — LaTeX string used to render the prompt and look up SVG positions
 *   radians   — exact radian value (for computation / future inverse-trig mode)
 *   cos       — exact x coordinate on the unit circle  (not pixel — normalized [-1, 1])
 *   sin       — exact y coordinate on the unit circle  (not pixel — normalized [-1, 1])
 *   degrees   — for display in future degree mode
 *   svgX/svgY — pixel coordinates in the current hardcoded SVG (keep for now; removed in Phase 4)
 *
 * alternateAngles maps a display LaTeX string → the latex key of the canonical angle it resolves to.
 * This lets the game prompt alternate forms while the click still validates against the canonical key.
 */

const S2 = Math.SQRT2 / 2;   // √2/2
const S3 = Math.sqrt(3) / 2; // √3/2
const PI = Math.PI;

// ─── Canonical angles (16 standard positions) ─────────────────────────────────

export const CANONICAL_ANGLES = [
  {
    latex:   '0',
    radians: 0,
    cos: 1, sin: 0,
    degrees: 0,
    svgX: 776, svgY: 440,
  },
  {
    latex:   '\\frac{\\pi}{6}',
    radians: PI / 6,
    cos: S3, sin: 0.5,
    degrees: 30,
    svgX: 730, svgY: 263,
  },
  {
    latex:   '\\frac{\\pi}{4}',
    radians: PI / 4,
    cos: S2, sin: S2,
    degrees: 45,
    svgX: 672, svgY: 190,
  },
  {
    latex:   '\\frac{\\pi}{3}',
    radians: PI / 3,
    cos: 0.5, sin: S3,
    degrees: 60,
    svgX: 600, svgY: 133,
  },
  {
    latex:   '\\frac{\\pi}{2}',
    radians: PI / 2,
    cos: 0, sin: 1,
    degrees: 90,
    svgX: 423, svgY: 86,
  },
  {
    latex:   '\\frac{2\\pi}{3}',
    radians: (2 * PI) / 3,
    cos: -0.5, sin: S3,
    degrees: 120,
    svgX: 246, svgY: 133,
  },
  {
    latex:   '\\frac{3\\pi}{4}',
    radians: (3 * PI) / 4,
    cos: -S2, sin: S2,
    degrees: 135,
    svgX: 173, svgY: 190,
  },
  {
    latex:   '\\frac{5\\pi}{6}',
    radians: (5 * PI) / 6,
    cos: -S3, sin: 0.5,
    degrees: 150,
    svgX: 117, svgY: 263,
  },
  {
    latex:   '\\pi',
    radians: PI,
    cos: -1, sin: 0,
    degrees: 180,
    svgX: 69, svgY: 440,
  },
  {
    latex:   '\\frac{7\\pi}{6}',
    radians: (7 * PI) / 6,
    cos: -S3, sin: -0.5,
    degrees: 210,
    svgX: 117, svgY: 617,
  },
  {
    latex:   '\\frac{5\\pi}{4}',
    radians: (5 * PI) / 4,
    cos: -S2, sin: -S2,
    degrees: 225,
    svgX: 173, svgY: 690,
  },
  {
    latex:   '\\frac{4\\pi}{3}',
    radians: (4 * PI) / 3,
    cos: -0.5, sin: -S3,
    degrees: 240,
    svgX: 246, svgY: 747,
  },
  {
    latex:   '\\frac{3\\pi}{2}',
    radians: (3 * PI) / 2,
    cos: 0, sin: -1,
    degrees: 270,
    svgX: 423, svgY: 793,
  },
  {
    latex:   '\\frac{5\\pi}{3}',
    radians: (5 * PI) / 3,
    cos: 0.5, sin: -S3,
    degrees: 300,
    svgX: 600, svgY: 746,
  },
  {
    latex:   '\\frac{7\\pi}{4}',
    radians: (7 * PI) / 4,
    cos: S2, sin: -S2,
    degrees: 315,
    svgX: 672, svgY: 690,
  },
  {
    latex:   '\\frac{11\\pi}{6}',
    radians: (11 * PI) / 6,
    cos: S3, sin: -0.5,
    degrees: 330,
    svgX: 730, svgY: 617,
  },
];

/**
 * Fast lookup: latex string → canonical angle object.
 * Used by game logic to resolve a click or prompt in O(1).
 */
export const ANGLE_BY_LATEX = Object.fromEntries(
  CANONICAL_ANGLES.map((a) => [a.latex, a])
);

/**
 * Legacy points map (same shape as old `points` const) — kept so existing
 * SVG click logic doesn't need to change yet.
 * Removed in Phase 4 when the renderer computes its own pixel positions.
 */
export const POINTS_LEGACY = Object.fromEntries(
  CANONICAL_ANGLES.map((a) => [a.latex, { x: a.svgX, y: a.svgY }])
);

// ─── Alternate angles ─────────────────────────────────────────────────────────

/**
 * Maps a display LaTeX string for a non-standard angle
 * to the latex key of the canonical angle it resolves to.
 *
 * e.g. "-\\frac{\\pi}{6}" resolves to "\\frac{11\\pi}{6}"
 */
export const ALTERNATE_ANGLES = {
  '2\\pi':                  '0',
  '-\\frac{\\pi}{6}':       '\\frac{11\\pi}{6}',
  '-\\frac{\\pi}{4}':       '\\frac{7\\pi}{4}',
  '-\\frac{\\pi}{3}':       '\\frac{5\\pi}{3}',
  '-\\frac{\\pi}{2}':       '\\frac{3\\pi}{2}',
  '-\\pi':                  '\\pi',
  '-\\frac{3\\pi}{2}':      '\\frac{\\pi}{2}',
  '-2\\pi':                 '0',
  '\\frac{13\\pi}{6}':      '\\frac{\\pi}{6}',
  '\\frac{17\\pi}{6}':      '\\frac{5\\pi}{6}',
};

/** Flat list of canonical latex strings for use in game logic. */
export const ANGLE_KEYS = CANONICAL_ANGLES.map((a) => a.latex);

/** Flat list of alternate-angle display strings. */
export const ALTERNATE_KEYS = Object.keys(ALTERNATE_ANGLES);
