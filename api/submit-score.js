const {
  json,
  readJson,
  rateLimit,
  seenReplay,
  verify,
  verifyScoreChecksum,
  validMode,
  validInteger,
} = require('./_security');

const SCORE_THRESHOLD = 2500;

function computeExpectedScore(input) {
  const elapsedSeconds = Math.max(1, input.elapsedSeconds);
  const modeRate = input.mode === 'classic' ? 2600 : 1800;
  const scoreFromTime = elapsedSeconds * modeRate;
  const scoreFromMerges = Math.max(1, input.merges) * 2200;
  const levelAllowance = input.level * 5000;
  return Math.min(250000, Math.max(scoreFromTime, scoreFromMerges) + levelAllowance);
}

function validateScore(body, session) {
  if (!validMode(body.mode) || body.mode !== session.mode) return { ok: false, reason: 'mode' };
  if (!validInteger(body.score, 0, 250000)) return { ok: false, reason: 'score' };
  if (!validInteger(body.level, 1, 6)) return { ok: false, reason: 'level' };
  if (!validInteger(body.merges, 0, 10000)) return { ok: false, reason: 'merges' };
  if (!validInteger(body.elapsedSeconds, 0, 7200)) return { ok: false, reason: 'elapsed' };

  const ageSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
  if (body.elapsedSeconds > ageSeconds + 3) return { ok: false, reason: 'elapsed_age' };
  if (body.mode === 'classic') {
    if (body.elapsedSeconds > 120) return { ok: false, reason: 'classic_elapsed' };
  }

  const expectedScore = computeExpectedScore({
    mode: body.mode,
    elapsedSeconds: body.elapsedSeconds,
    merges: body.merges,
    level: body.level,
  });
  const diff = body.score - expectedScore;
  if (diff > SCORE_THRESHOLD) {
    return { ok: false, reason: 'score_delta', expectedScore, diff };
  }

  return { ok: true, expectedScore, diff };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const body = await readJson(req);
    const limit = await rateLimit(req, 'score', body);
    if (!limit.allowed) {
      return json(res, 429, { error: 'rate_limited' }, { 'Retry-After': String(limit.retryAfter) });
    }

    const session = verify(body.token);
    if (!session || body.sessionId !== session.sessionId) {
      console.warn('[security] rejected score: invalid token');
      return json(res, 401, { error: 'invalid_session' });
    }

    if (!verifyScoreChecksum(body)) {
      console.warn('[security] rejected score: checksum mismatch', {
        sessionId: session.sessionId,
        mode: body.mode,
      });
      return json(res, 400, { error: 'invalid_checksum' });
    }

    if (await seenReplay(session.sessionId, body.checksum)) {
      console.warn('[security] rejected score: replay', {
        sessionId: session.sessionId,
        mode: body.mode,
      });
      return json(res, 409, { error: 'duplicate_submission' });
    }

    const validation = validateScore(body, session);
    if (!validation.ok) {
      console.warn('[security] rejected score: invalid payload', {
        mode: body.mode,
        score: body.score,
        level: body.level,
        merges: body.merges,
        reason: validation.reason,
      });
      return json(res, 400, { error: 'invalid_score' });
    }

    console.info('[score]', {
      sessionId: session.sessionId,
      mode: body.mode,
      score: body.score,
      level: body.level,
      merges: body.merges,
      expectedScore: validation.expectedScore,
    });
    return json(res, 202, { ok: true });
  } catch (err) {
    if (err.message === 'invalid_json' || err.message === 'payload_too_large') {
      return json(res, err.message === 'invalid_json' ? 400 : 413, { error: err.message });
    }
    console.error('[security] score error', { message: err.message });
    return json(res, 500, { error: 'internal_error' });
  }
};

module.exports.computeExpectedScore = computeExpectedScore;
