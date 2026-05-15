// Ensure server/node_modules is in the module resolution path
const path = require('path');
const serverDir = path.join(__dirname, '..', 'server');
if (!module.paths.includes(path.join(serverDir, 'node_modules'))) {
  module.paths.unshift(path.join(serverDir, 'node_modules'));
}

const app = require('../server/index');
module.exports = app;
