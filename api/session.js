const crypto = require('crypto');
const { json, readJson, rateLimit, sign, validMode } = require('./_security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!rateLimit(req, 'session')) return json(res, 429, { error: 'rate_limited' });

  try {
    const body = await readJson(req);
    if (!validMode(body.mode)) return json(res, 400, { error: 'invalid_mode' });

    const session = {
      sessionId: crypto.randomUUID(),
      mode: body.mode,
      startedAt: Date.now(),
    };

    return json(res, 200, {
      sessionId: session.sessionId,
      token: sign(session),
    });
  } catch (err) {
    return json(res, err.message === 'invalid_json' ? 400 : 500, { error: err.message });
  }
};
