const crypto = require('crypto');
const { SESSION_TTL_MS, json, readJson, rateLimit, sign, validMode } = require('./_security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const body = await readJson(req);
    const limit = await rateLimit(req, 'session', body);
    if (!limit.allowed) {
      return json(res, 429, { error: 'rate_limited' }, { 'Retry-After': String(limit.retryAfter) });
    }

    if (!validMode(body.mode)) return json(res, 400, { error: 'invalid_mode' });

    const session = {
      sessionId: crypto.randomUUID(),
      mode: body.mode,
      startedAt: Date.now(),
    };

    return json(res, 200, {
      sessionId: session.sessionId,
      token: sign(session),
      expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000),
    });
  } catch (err) {
    if (err.message === 'invalid_json' || err.message === 'payload_too_large') {
      return json(res, err.message === 'invalid_json' ? 400 : 413, { error: err.message });
    }
    console.error('[security] session error', { message: err.message });
    return json(res, 500, { error: 'internal_error' });
  }
};
