const { adapt } = require('./_adapter');
const handler = require('../../api/submit-score');

exports.handler = adapt(handler);
