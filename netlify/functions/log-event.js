const { adapt } = require('./_adapter');
const handler = require('../../api/log-event');

exports.handler = adapt(handler);
