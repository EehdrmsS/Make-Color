const { adapt } = require('./_adapter');
const handler = require('../../api/session');

exports.handler = adapt(handler);
