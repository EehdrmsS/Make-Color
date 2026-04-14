const crypto = require('crypto');

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 20;
const buckets = new Map();

function getSecret() {
  const secret = process.env.SCORE_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SCORE_SIGNING_SECRET must be at least 32 characters.');
  }
  return secret;
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
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

function rateLimit(req, keyPrefix) {
  const now = Date.now();
  const key = `${keyPrefix}:${clientIp(req)}`;
  const bucket = buckets.get(key) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_WINDOW_MS;
  }
  bucket.count++;
  buckets.set(key, bucket);
  return bucket.count <= RATE_LIMIT;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  const body = base64url(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (typeof token !== 'string' || token.length > 2048 || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const a = Buffer.from(mac || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || Date.now() - payload.startedAt > SESSION_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function validMode(mode) {
  return mode === 'classic' || mode === 'extreme';
}

function validInteger(n, min, max) {
  return Number.isInteger(n) && n >= min && n <= max;
}

module.exports = {
  json,
  readJson,
  rateLimit,
  sign,
  verify,
  validMode,
  validInteger,
};
