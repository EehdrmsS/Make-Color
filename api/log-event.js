const { json, readJson, rateLimit } = require('./_security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const body = await readJson(req);
    const limit = await rateLimit(req, 'log', body);
    if (!limit.allowed) {
      return json(res, 429, { error: 'rate_limited' }, { 'Retry-After': String(limit.retryAfter) });
    }

    const type = typeof body.type === 'string' ? body.type.slice(0, 80) : 'unknown';
    console.warn('[client-security-event]', {
      type,
      mode: body.mode,
      score: body.score,
      timeLeft: body.timeLeft,
      ts: body.ts,
    });
    return json(res, 202, { ok: true });
  } catch (err) {
    if (err.message === 'invalid_json' || err.message === 'payload_too_large') {
      return json(res, err.message === 'invalid_json' ? 400 : 413, { error: err.message });
    }
    console.error('[security] log error', { message: err.message });
    return json(res, 500, { error: 'internal_error' });
  }
};
