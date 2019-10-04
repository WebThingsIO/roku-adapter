'use strict';

const RokuAdapter = require('./lib/roku-adapter');

module.exports = (addonManager) => {
  new RokuAdapter(addonManager);
};
