const {
  json,
  readJson,
  rateLimit,
  verify,
  validMode,
  validInteger,
} = require('./_security');

function plausibleScore(body, session) {
  if (!validMode(body.mode) || body.mode !== session.mode) return false;
  if (!validInteger(body.score, 0, 250000)) return false;
  if (!validInteger(body.level, 1, 6)) return false;
  if (!validInteger(body.merges, 0, 10000)) return false;

  if (body.mode === 'classic') {
    if (!validInteger(body.elapsedSeconds, 0, 120)) return false;
    const ageSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
    if (body.elapsedSeconds > ageSeconds + 3) return false;
    if (body.score > Math.max(5000, body.elapsedSeconds * 2500)) return false;
  }

  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!rateLimit(req, 'score')) return json(res, 429, { error: 'rate_limited' });

  try {
    const body = await readJson(req);
    const session = verify(body.token);
    if (!session || body.sessionId !== session.sessionId) {
      console.warn('[security] rejected score: invalid token');
      return json(res, 401, { error: 'invalid_session' });
    }

    if (!plausibleScore(body, session)) {
      console.warn('[security] rejected score: implausible payload', {
        mode: body.mode,
        score: body.score,
        level: body.level,
        merges: body.merges,
      });
      return json(res, 400, { error: 'invalid_score' });
    }

    console.info('[score]', {
      sessionId: session.sessionId,
      mode: body.mode,
      score: body.score,
      level: body.level,
      merges: body.merges,
    });
    return json(res, 202, { ok: true });
  } catch (err) {
    return json(res, err.message === 'invalid_json' ? 400 : 500, { error: err.message });
  }
};
