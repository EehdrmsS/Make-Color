const { EventEmitter } = require('events');

function createReq(event) {
  const req = new EventEmitter();
  req.method = event.httpMethod;
  req.headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  req.socket = {
    remoteAddress:
      req.headers['x-nf-client-connection-ip'] ||
      req.headers['client-ip'] ||
      req.headers['x-forwarded-for'] ||
      'unknown',
  };

  process.nextTick(() => {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '';
    if (body) req.emit('data', body);
    req.emit('end');
  });

  return req;
}

function createRes(resolve) {
  const headers = {};
  return {
    statusCode: 200,
    setHeader(key, value) {
      headers[key] = String(value);
    },
    end(body = '') {
      resolve({
        statusCode: this.statusCode,
        headers,
        body: String(body),
      });
    },
  };
}

function adapt(handler) {
  return event => new Promise(resolve => {
    const req = createReq(event);
    const res = createRes(resolve);
    Promise.resolve(handler(req, res)).catch(err => {
      console.error('[netlify-function]', { message: err.message });
      resolve({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({ error: 'internal_error' }),
      });
    });
  });
}

module.exports = { adapt };
