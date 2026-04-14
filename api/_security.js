const crypto = require('crypto');

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 1000;
const RATE_LIMIT = 10;
const REPLAY_TTL_MS = SESSION_TTL_MS;
const MAX_REPLAY_CACHE = 32;
const memoryRateBuckets = new Map();
const memoryReplayCache = new Map();

function getActiveSecrets() {
  const current = process.env.SCORE_SECRET_CURRENT || process.env.SCORE_SIGNING_SECRET;
  const previous = process.env.SCORE_SECRET_PREVIOUS || '';
  const secrets = [
    { id: 'current', value: current },
    { id: 'previous', value: previous },
  ].filter(secret => secret.value);

  if (!current) throw new Error('SCORE_SECRET_CURRENT is required.');
  for (const secret of secrets) {
    if (Buffer.byteLength(secret.value, 'utf8') < 32) {
      throw new Error(`Weak ${secret.id} score secret. Use at least 32 bytes.`);
    }
  }
  return secrets;
}

function currentSecret() {
  return getActiveSecrets().find(secret => secret.id === 'current').value;
}

function json(res, status, body, headers = {}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 4096) {
        reject(new Error('payload_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function userAgent(req) {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 160) : 'unknown';
}

function bearerFromReq(req) {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return '';
}

function sessionKeyFromReq(req, body = {}) {
  const token = body.token || bearerFromReq(req) || '';
  if (typeof token !== 'string' || !token) return 'no-session';
  return crypto.createHash('sha256').update(token).digest('base64url').slice(0, 24);
}

function rateLimitKey(req, keyPrefix, body = {}) {
  const raw = `${keyPrefix}:${clientIp(req)}:${userAgent(req)}:${sessionKeyFromReq(req, body)}`;
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

function redisConfig() {
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && !token) throw new Error('REDIS_TOKEN is required when Redis is configured.');
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redisCommand(command) {
  const config = redisConfig();
  if (!config) return null;
  const res = await fetch(`${config.url}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!res.ok) throw new Error(`redis_${res.status}`);
  return res.json();
}

function memorySlidingWindow(key, now, limit, windowMs) {
  const cutoff = now - windowMs;
  const hits = (memoryRateBuckets.get(key) || []).filter(ts => ts > cutoff);
  hits.push(now);
  memoryRateBuckets.set(key, hits);
  return {
    allowed: hits.length <= limit,
    retryAfter: hits.length <= limit ? 0 : Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)),
  };
}

async function rateLimit(req, keyPrefix, body = {}, options = {}) {
  const limit = options.limit || RATE_LIMIT;
  const windowMs = options.windowMs || RATE_WINDOW_MS;
  const now = Date.now();
  const key = `rl:${rateLimitKey(req, keyPrefix, body)}`;

  if (redisConfig()) {
    const cutoff = now - windowMs;
    await redisCommand(['ZREMRANGEBYSCORE', key, '0', String(cutoff)]);
    await redisCommand(['ZADD', key, String(now), crypto.randomUUID()]);
    await redisCommand(['EXPIRE', key, String(Math.ceil(windowMs / 1000) + 5)]);
    const count = Number((await redisCommand(['ZCARD', key])).result || 0);
    if (count <= limit) return { allowed: true, retryAfter: 0 };
    const oldest = Number((await redisCommand(['ZRANGE', key, '0', '0', 'WITHSCORES'])).result?.[1] || now);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }

  return memorySlidingWindow(key, now, limit, windowMs);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload) {
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', currentSecret()).update(body).digest('base64url');
  return { payload: body, signature };
}

function verifySignature(payload, signature) {
  if (typeof payload !== 'string' || typeof signature !== 'string') return false;
  for (const secret of getActiveSecrets()) {
    const expected = crypto.createHmac('sha256', secret.value).update(payload).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

function sign(payload) {
  const signed = signPayload(payload);
  return `${signed.payload}.${signed.signature}`;
}

function verify(token) {
  if (typeof token !== 'string' || token.length > 2048 || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!verifySignature(payload, signature)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded || Date.now() - decoded.startedAt > SESSION_TTL_MS) return null;
    return decoded;
  } catch {
    return null;
  }
}

function scoreChecksum({ score, elapsedSeconds, mode, sessionId }, token) {
  const canonical = `${score}:${elapsedSeconds}:${mode}:${sessionId}`;
  return crypto.createHmac('sha256', token).update(canonical).digest('base64url');
}

function verifyScoreChecksum(body) {
  if (typeof body.checksum !== 'string' || typeof body.token !== 'string') return false;
  const expected = scoreChecksum(body, body.token);
  const a = Buffer.from(body.checksum);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function seenReplay(sessionId, checksum) {
  const replayKey = `replay:${sessionId}`;
  const now = Date.now();
  if (redisConfig()) {
    const key = `${replayKey}:${checksum}`;
    const exists = Number((await redisCommand(['EXISTS', key])).result || 0) === 1;
    if (exists) return true;
    await redisCommand(['SET', key, '1', 'EX', String(Math.ceil(REPLAY_TTL_MS / 1000))]);
    return false;
  }

  const entries = (memoryReplayCache.get(replayKey) || []).filter(item => now - item.ts < REPLAY_TTL_MS);
  if (entries.some(item => item.checksum === checksum)) {
    memoryReplayCache.set(replayKey, entries);
    return true;
  }
  entries.push({ checksum, ts: now });
  while (entries.length > MAX_REPLAY_CACHE) entries.shift();
  memoryReplayCache.set(replayKey, entries);
  return false;
}

function validMode(mode) {
  return mode === 'classic' || mode === 'extreme';
}

function validInteger(n, min, max) {
  return Number.isInteger(n) && n >= min && n <= max;
}

module.exports = {
  SESSION_TTL_MS,
  getActiveSecrets,
  signPayload,
  verifySignature,
  json,
  readJson,
  rateLimit,
  sign,
  verify,
  scoreChecksum,
  verifyScoreChecksum,
  seenReplay,
  validMode,
  validInteger,
};
