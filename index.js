'use strict';

const RokuAdapter = require('./lib/roku-adapter');

module.exports = (addonManager, manifest) => {
  new RokuAdapter(addonManager, manifest);
};
