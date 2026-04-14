const { json, readJson, rateLimit } = require('./_security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!rateLimit(req, 'log')) return json(res, 429, { error: 'rate_limited' });

  try {
    const body = await readJson(req);
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
    return json(res, err.message === 'invalid_json' ? 400 : 500, { error: err.message });
  }
};
