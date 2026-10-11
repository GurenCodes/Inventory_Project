// lib/cors.js
// CORS origin parsing + middleware used by server.js (extracted in the
// 2026-10-11 Render-configuration audit so both are unit-testable).
//
// Contract with the hosting platform (Render):
//  - ALLOWED_ORIGINS is a comma-separated list of ORIGINS (scheme + host
//    + optional port), e.g. "https://my-app.vercel.app,https://api.example.com".
//    A trailing slash or surrounding whitespace is tolerated and stripped;
//    an origin is never a full API URL or a path.
//  - Unset or empty-string -> the development localhost defaults below.
//  - Set to whitespace/commas only -> parses to an EMPTY list: every
//    cross-origin request is rejected (fail-closed). This is intentional:
//    a misconfigured production variable must never widen access.

const DEFAULT_LOCALHOST_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

function normalizeOrigin(value) {
  return String(value).trim().replace(/\/+$/, '');
}

function parseAllowedOrigins(raw) {
  if (raw === undefined || raw === null) return [...DEFAULT_LOCALHOST_ORIGINS];
  if (String(raw).trim() === '') return [...DEFAULT_LOCALHOST_ORIGINS];
  return String(raw)
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

// The real CORS middleware. `allowedOrigins` must already be parsed.
// Behavior:
//  - No Origin header (same-origin, curl, server-to-server): allowed.
//  - Origin matches the allowlist (exact, after trailing-slash
//    normalization): allowed, echoed back, credentials enabled.
//  - Anything else: 403 JSON, including preflight OPTIONS.
function createCorsMiddleware(allowedOrigins) {
  const normalized = new Set(allowedOrigins.map(normalizeOrigin).filter(Boolean));
  return (req, res, next) => {
    const origin = req.headers.origin;

    const isAllowed = !origin || normalized.has(normalizeOrigin(origin));

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.header('Access-Control-Max-Age', '86400');
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      return res.status(403).json({ error: 'Not allowed by CORS' });
    }

    if (req.method === 'OPTIONS') {
      if (isAllowed) {
        return res.sendStatus(204);
      }
      return res.status(403).json({ error: 'Not allowed by CORS' });
    }

    next();
  };
}

module.exports = {
  DEFAULT_LOCALHOST_ORIGINS,
  normalizeOrigin,
  parseAllowedOrigins,
  createCorsMiddleware,
};
